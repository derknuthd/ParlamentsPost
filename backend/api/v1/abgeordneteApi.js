const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router();

// Import Service-Module
const logService = require('../../services/logService');

// Konstante zum Aktivieren/Deaktivieren des Filters
const FILTER_PARTEIEN = true; // Setze auf `false`, um den Filter zu deaktivieren

// Liste der Parteien, die gefiltert werden sollen
const GEFILTERTE_PARTEIEN = ["Alternative für Deutschland","AfD"];

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

  logService.debug("Eingehende Anfrage für Abgeordnete", { wahl, wahlkreis, wohnort });

  // Validierung des Wahl-Parameters
  if (!wahl || !wahl.match(/^[a-zA-Z0-9]+$/)) {
    logService.warn("Ungültiger Wahl-Parameter", { wahl, validierung: "fehlgeschlagen" });
    return res.status(400).json({ 
      error: "Eingabefehler", 
      message: "Ungültiger Parameter 'wahl'. Erlaubt sind nur Buchstaben und Zahlen."
    });
  }

  // Mindestens Wahlkreis oder Wohnort muss angegeben sein
  if (!wahlkreis && !wohnort) {
    logService.warn("Wahlkreis- und Wohnort-Parameter fehlen", { wahlkreis, wohnort });
    return res.status(400).json({
      error: "Eingabefehler",
      message: "Es muss mindestens ein Wahlkreis oder ein Wohnort angegeben werden."
    });
  }

  // Validierung der Wahlkreis-Parameter
  const wahlkreisValidation = validateWahlkreis(wahlkreis);
  if (!wahlkreisValidation.valid) {
    logService.warn("Ungültiger Wahlkreis-Parameter", { 
      wahlkreis, 
      error: wahlkreisValidation.error,
      validierung: "fehlgeschlagen" 
    });
    return res.status(400).json({ 
      error: "Eingabefehler", 
      message: wahlkreisValidation.error 
    });
  }

  // Validierung des Wohnort-Parameters
  const wohnortValidation = validateWohnort(wohnort);
  if (!wohnortValidation.valid) {
    logService.warn("Ungültiger Wohnort-Parameter", { 
      wohnort, 
      error: wohnortValidation.error,
      validierung: "fehlgeschlagen" 
    });
    return res.status(400).json({ 
      error: "Eingabefehler", 
      message: wohnortValidation.error 
    });
  }

  // Validierung erfolgreich
  logService.debug("Validierung erfolgreich", { wahl, wahlkreis, wohnort });

  // Sanitierung der Parameter
  const sanitizedWahlkreise = sanitizeWahlkreis(wahlkreis);
  const sanitizedWohnorte = sanitizeWohnort(wohnort);
  
  logService.debug("Parameter sanitiert", { 
    wahlkreise: sanitizedWahlkreise, 
    wohnorte: sanitizedWohnorte 
  });

  // Sicherheitscheck für den dynamischen Pfad
  const safeWahl = wahl.replace(/[^a-zA-Z0-9]/g, ''); // Nur alphanumerische Zeichen zulassen
  if (safeWahl !== wahl) {
    logService.error("Versuchte Path Traversal erkannt", { wahl, safeWahl, sicherheit: "verletzt" });
    return res.status(400).json({ 
      error: "Sicherheitsverletzung", 
      message: "Ungültiger Wahl-Parameter" 
    });
  }

  // Dynamischer Pfad zur JSON-Datei basierend auf der Wahl
  const abgeordneteIndexPath = path.join(
    __dirname,
    `../../data/${safeWahl}/abgeordneteIndex.json`
  );
  logService.debug("Pfad zur JSON-Datei bestimmt", { abgeordneteIndexPath });

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(abgeordneteIndexPath)) {
    logService.error(`Keine Daten für die Wahl "${safeWahl}" gefunden.`, { 
      pfad: abgeordneteIndexPath, 
      existiert: false 
    });
    return res.status(404).json({ 
      error: "Daten nicht gefunden", 
      message: `Keine Daten für die Wahl "${safeWahl}" gefunden.` 
    });
  }

  // JSON-Daten laden
  let abgeordneteIndex;
  try {
    const rawData = fs.readFileSync(abgeordneteIndexPath, "utf8");
    let parsedData;
    
    try {
      parsedData = JSON.parse(rawData);
    } catch (parseError) {
      logService.error("Fehler beim Parsen der JSON-Datei", { 
        error: parseError.message,
        abgeordneteIndexPath,
        daten: "korrupt" 
      });
      return res.status(500).json({ 
        error: "Datenformatfehler", 
        message: "Die Abgeordnetendaten sind fehlerhaft formatiert. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    // Überprüfung der JSON-Struktur
    if (!parsedData || !parsedData.wahlkreise || !parsedData.wohnorte || 
        typeof parsedData.wahlkreise !== 'object' || typeof parsedData.wohnorte !== 'object') {
      logService.error("Ungültige JSON-Struktur", { 
        abgeordneteIndexPath,
        struktur: parsedData ? Object.keys(parsedData) : 'null',
        daten: "ungültig" 
      });
      return res.status(500).json({ 
        error: "Datenstrukturfehler", 
        message: "Die Abgeordnetendaten haben eine ungültige Struktur. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    abgeordneteIndex = parsedData;
    logService.info("JSON-Datei erfolgreich geladen", { dateipfad: abgeordneteIndexPath });
    logService.debug("Geladene Daten-Struktur", {
      wahlkreise: Object.keys(abgeordneteIndex.wahlkreise || {}).length,
      wohnorte: Object.keys(abgeordneteIndex.wohnorte || {}).length,
    });
  } catch (error) {
    logService.error("Fehler beim Laden der JSON-Datei", { 
      error: error.message, 
      dateipfad: abgeordneteIndexPath,
      operation: "dateilesen" 
    });
    return res.status(500).json({ 
      error: "Datenzugriffsfehler", 
      message: "Daten konnten nicht geladen werden" 
    });
  }

  // Ergebnisse sammeln
  const results = new Set();

  // Suche nach Wahlkreis-IDs
  if (sanitizedWahlkreise.length > 0) {
    logService.debug("Durchsuche nach Wahlkreis-IDs", { wahlkreisIds: sanitizedWahlkreise });

    sanitizedWahlkreise.forEach((id) => {
      if (abgeordneteIndex.wahlkreise[id]) {
        logService.debug(`Abgeordnete für Wahlkreis-ID "${id}" gefunden`, {
          anzahl: abgeordneteIndex.wahlkreise[id].length,
        });
        abgeordneteIndex.wahlkreise[id].forEach((abgeordneter) =>
          results.add(JSON.stringify(abgeordneter))
        );
      } else {
        logService.info(`Keine Abgeordneten für Wahlkreis-ID "${id}" gefunden.`, {
          wahlkreis: id,
          gefunden: false
        });
      }
    });
  }

  // Suche nach Wohnorten
  if (sanitizedWohnorte.length > 0) {
    logService.debug("Durchsuche nach Wohnorten", { wohnorte: sanitizedWohnorte });

    sanitizedWohnorte.forEach((ort) => {
      if (abgeordneteIndex.wohnorte[ort]) {
        logService.debug(`Abgeordnete für Wohnort "${ort}" gefunden`, {
          anzahl: abgeordneteIndex.wohnorte[ort].length,
        });
        abgeordneteIndex.wohnorte[ort].forEach((abgeordneter) =>
          results.add(JSON.stringify(abgeordneter))
        );
      } else {
        logService.info(`Keine Abgeordneten für Wohnort "${ort}" gefunden.`, {
          wohnort: ort,
          gefunden: false
        });
      }
    });
  }

  // Antwort zurückgeben
  if (results.size > 0) {
    // Ergebnisse in ein Array umwandeln
    let uniqueResults = Array.from(results).map((item) => JSON.parse(item));
    
    logService.debug("Unfiltered results", { count: uniqueResults.length });

    // Filter anwenden, falls aktiviert
    if (FILTER_PARTEIEN) {
      const originalCount = uniqueResults.length;
      uniqueResults = uniqueResults.filter(
        (person) => !GEFILTERTE_PARTEIEN.includes(person.partei)
      );
      const filteredCount = originalCount - uniqueResults.length;
      logService.info(`Parteienfilter angewendet`, {
        gefilterte_parteien: GEFILTERTE_PARTEIEN.join(", "),
        ausgeschlossene_abgeordnete: filteredCount,
        ursprüngliche_anzahl: originalCount,
        verbleibende_anzahl: uniqueResults.length
      });
    }

    logService.info("Anfrage erfolgreich", {
      status: "erfolg",
      anzahl_abgeordnete: uniqueResults.length,
    });
    res.json(uniqueResults);
  } else {
    logService.warn("Keine Abgeordneten gefunden", {
      wahlkreise: sanitizedWahlkreise,
      wohnorte: sanitizedWohnorte,
      status: "leer" 
    });
    return res.status(404).json({ 
      error: "Keine Daten", 
      message: "Keine Abgeordneten gefunden." 
    });
  }
});

// Server starten (falls benötigt)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use("/api/v1", router); // Verwende den Router
  app.listen(PORT, () => {
    logService.info(`Abgeordnete-API läuft auf http://localhost:${PORT}`, { port: PORT });
  });
}

module.exports = router;