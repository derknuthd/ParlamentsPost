const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router();

// Log-Level aus der .env-Datei
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";

// Konstante zum Aktivieren/Deaktivieren des Filters
const FILTER_PARTEIEN = true; // Setze auf `false`, um den Filter zu deaktivieren

// Liste der Parteien, die gefiltert werden sollen
const GEFILTERTE_PARTEIEN = ["Alternative für Deutschland","AfD"];

// Logging-Funktion
const logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
function log(level, message, data = null) {
  if (logLevels.indexOf(level) >= logLevels.indexOf(LOG_LEVEL)) {
    const logMessage = `[${level}] ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
}

// Hilfsfunktion zur Wahlkreis-Validierung
function validateWahlkreis(wahlkreis) {
  if (!wahlkreis) {
    return { valid: true }; // Wahlkreis ist optional
  }
  
  // Prüfen, ob es sich um ein Array oder eine Komma-getrennte Liste handelt
  const wahlkreise = Array.isArray(wahlkreis) ? wahlkreis : wahlkreis.split(",");
  
  for (const wk of wahlkreise) {
    // Erlaubte Zeichen: Zahlen und führende Nullen
    const validPattern = /^\d{1,3}$/;
    if (!validPattern.test(wk.trim())) {
      return { 
        valid: false, 
        error: `Wahlkreis '${wk}' ungültig. Wahlkreise müssen 1-3 Ziffern enthalten.` 
      };
    }
  }
  
  return { valid: true };
}

// Hilfsfunktion zur Wohnort-Validierung
function validateWohnort(wohnort) {
  if (!wohnort) {
    return { valid: true }; // Wohnort ist optional
  }
  
  // Prüfen, ob es sich um ein Array oder eine Komma-getrennte Liste handelt
  const wohnorte = Array.isArray(wohnort) ? wohnort : wohnort.split(",");
  
  for (const ort of wohnorte) {
    const trimmedOrt = ort.trim();
    
    // Erlaubte Zeichen: Buchstaben, Umlaute, Leerzeichen, Bindestriche
    const validPattern = /^[a-zA-ZäöüÄÖÜß\s\-]+$/;
    if (!validPattern.test(trimmedOrt)) {
      return { 
        valid: false, 
        error: `Wohnort '${trimmedOrt}' ungültig. Nur Buchstaben, Leerzeichen und Bindestriche erlaubt.` 
      };
    }
    
    // Mindest- und Maximallänge prüfen
    if (trimmedOrt.length < 2 || trimmedOrt.length > 50) {
      return { 
        valid: false, 
        error: `Wohnort '${trimmedOrt}' ungültig. Muss zwischen 2 und 50 Zeichen lang sein.` 
      };
    }
  }
  
  return { valid: true };
}

// Hilfsfunktion zur Sanitierung des Wohnorts
function sanitizeWohnort(wohnort) {
  if (!wohnort) return [];
  
  const wohnorte = Array.isArray(wohnort) ? wohnort : wohnort.split(",");
  
  return wohnorte.map(ort => 
    ort
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[-]+/g, '-')
  );
}

// Hilfsfunktion zur Sanitierung der Wahlkreis-IDs
function sanitizeWahlkreis(wahlkreis) {
  if (!wahlkreis) return [];
  
  const wahlkreise = Array.isArray(wahlkreis) ? wahlkreis : wahlkreis.split(",");
  
  return wahlkreise.map(wk => {
    const trimmed = wk.trim();
    // Wahlkreise mit führenden Nullen normalisieren (z.B. "001" -> "1")
    return trimmed.replace(/^0+/, '') || "0";
  });
}

// API-Route
router.get("/:wahl/abgeordnete", (req, res) => {
  const { wahl } = req.params;
  const { wahlkreis, wohnort } = req.query;

  log("DEBUG", "Eingehende Anfrage", { wahl, wahlkreis, wohnort });

  // Validierung des Wahl-Parameters
  if (!wahl || !wahl.match(/^[a-zA-Z0-9]+$/)) {
    log("WARN", "Ungültiger Wahl-Parameter", { wahl });
    return res.status(400).json({ 
      error: "Ungültiger Parameter 'wahl'. Erlaubt sind nur Buchstaben und Zahlen." 
    });
  }

  // Mindestens Wahlkreis oder Wohnort muss angegeben sein
  if (!wahlkreis && !wohnort) {
    log("WARN", "Wahlkreis- und Wohnort-Parameter fehlen");
    return res.status(400).json({
      error: "Es muss mindestens ein Wahlkreis oder ein Wohnort angegeben werden.",
    });
  }

  // Validierung der Wahlkreis-Parameter
  const wahlkreisValidation = validateWahlkreis(wahlkreis);
  if (!wahlkreisValidation.valid) {
    log("WARN", "Ungültiger Wahlkreis-Parameter", { 
      wahlkreis, 
      error: wahlkreisValidation.error 
    });
    return res.status(400).json({ error: wahlkreisValidation.error });
  }

  // Validierung des Wohnort-Parameters
  const wohnortValidation = validateWohnort(wohnort);
  if (!wohnortValidation.valid) {
    log("WARN", "Ungültiger Wohnort-Parameter", { 
      wohnort, 
      error: wohnortValidation.error 
    });
    return res.status(400).json({ error: wohnortValidation.error });
  }

  // Sanitierung der Parameter
  const sanitizedWahlkreise = sanitizeWahlkreis(wahlkreis);
  const sanitizedWohnorte = sanitizeWohnort(wohnort);
  
  log("DEBUG", "Sanitized Parameter", { 
    wahlkreise: sanitizedWahlkreise, 
    wohnorte: sanitizedWohnorte 
  });

  // Sicherheitscheck für den dynamischen Pfad
  const safeWahl = wahl.replace(/[^a-zA-Z0-9]/g, ''); // Nur alphanumerische Zeichen zulassen
  if (safeWahl !== wahl) {
    log("ERROR", "Versuchte Path Traversal erkannt", { wahl, safeWahl });
    return res.status(400).json({ error: "Ungültiger Wahl-Parameter" });
  }

  // Dynamischer Pfad zur JSON-Datei basierend auf der Wahl
  const abgeordneteIndexPath = path.join(
    __dirname,
    `../../data/${safeWahl}/abgeordneteIndex.json`
  );
  log("DEBUG", "Pfad zur JSON-Datei", { abgeordneteIndexPath });

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(abgeordneteIndexPath)) {
    log("ERROR", `Keine Daten für die Wahl "${safeWahl}" gefunden.`);
    return res
      .status(404)
      .json({ error: `Keine Daten für die Wahl "${safeWahl}" gefunden.` });
  }

  // JSON-Daten laden
  let abgeordneteIndex;
  try {
    const rawData = fs.readFileSync(abgeordneteIndexPath, "utf8");
    let parsedData;
    
    try {
      parsedData = JSON.parse(rawData);
    } catch (parseError) {
      log("ERROR", "Fehler beim Parsen der JSON-Datei", { 
        error: parseError.message,
        abgeordneteIndexPath 
      });
      return res.status(500).json({ 
        error: "Die Abgeordnetendaten sind fehlerhaft formatiert. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    // Überprüfung der JSON-Struktur
    if (!parsedData || !parsedData.wahlkreise || !parsedData.wohnorte || 
        typeof parsedData.wahlkreise !== 'object' || typeof parsedData.wohnorte !== 'object') {
      log("ERROR", "Ungültige JSON-Struktur", { 
        abgeordneteIndexPath,
        structure: parsedData ? Object.keys(parsedData) : 'null' 
      });
      return res.status(500).json({ 
        error: "Die Abgeordnetendaten haben eine ungültige Struktur. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    abgeordneteIndex = parsedData;
    log("INFO", "JSON-Datei erfolgreich geladen");
    log("DEBUG", "Geladene Daten", {
      wahlkreise: Object.keys(abgeordneteIndex.wahlkreise || {}),
      wohnorte: Object.keys(abgeordneteIndex.wohnorte || {}),
    });
  } catch (error) {
    log("ERROR", "Fehler beim Laden der JSON-Datei", { error: error.message });
    return res
      .status(500)
      .json({ error: "Daten konnten nicht geladen werden" });
  }

  // Ergebnisse sammeln
  const results = new Set();

  // Suche nach Wahlkreis-IDs
  if (sanitizedWahlkreise.length > 0) {
    log("DEBUG", "Wahlkreis-IDs", { wahlkreisIds: sanitizedWahlkreise });

    sanitizedWahlkreise.forEach((id) => {
      if (abgeordneteIndex.wahlkreise[id]) {
        log("DEBUG", `Abgeordnete für Wahlkreis-ID "${id}" gefunden`, {
          abgeordnete: abgeordneteIndex.wahlkreise[id],
        });
        abgeordneteIndex.wahlkreise[id].forEach((abgeordneter) =>
          results.add(JSON.stringify(abgeordneter))
        );
      } else {
        log("WARN", `Keine Abgeordneten für Wahlkreis-ID "${id}" gefunden.`);
      }
    });
  }

  // Suche nach Wohnorten
  if (sanitizedWohnorte.length > 0) {
    log("DEBUG", "Wohnorte", { wohnorte: sanitizedWohnorte });

    sanitizedWohnorte.forEach((ort) => {
      if (abgeordneteIndex.wohnorte[ort]) {
        log("DEBUG", `Abgeordnete für Wohnort "${ort}" gefunden`, {
          abgeordnete: abgeordneteIndex.wohnorte[ort],
        });
        abgeordneteIndex.wohnorte[ort].forEach((abgeordneter) =>
          results.add(JSON.stringify(abgeordneter))
        );
      } else {
        log("WARN", `Keine Abgeordneten für Wohnort "${ort}" gefunden.`);
      }
    });
  }

  // Antwort zurückgeben
  if (results.size > 0) {
    // Ergebnisse in ein Array umwandeln
    let uniqueResults = Array.from(results).map((item) => JSON.parse(item));

    // Filter anwenden, falls aktiviert
    if (FILTER_PARTEIEN) {
      uniqueResults = uniqueResults.filter(
        (person) => !GEFILTERTE_PARTEIEN.includes(person.partei)
      );
      log(
        "INFO",
        `Filter angewendet: ${GEFILTERTE_PARTEIEN.join(", ")} ausgeschlossen`
      );
    }

    log("INFO", "Abgeordnete gefunden (nach Filterung)", {
      count: uniqueResults.length,
    });
    res.json(uniqueResults);
  } else {
    log("WARN", "Keine Abgeordneten gefunden");
    res.status(404).json({ error: "Keine Abgeordneten gefunden." });
  }
});

// Server starten (falls benötigt)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use("/api/v1", router); // Verwende den Router
  app.listen(PORT, () => {
    log("INFO", `Abgeordnete-API läuft auf http://localhost:${PORT}`);
  });
}

module.exports = router;