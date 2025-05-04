const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router();

// Log-Level aus der .env-Datei
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";

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

// Hilfsfunktion zur Wohnort-Validierung
function validateWohnort(wohnort) {
  if (!wohnort) {
    return { valid: false, error: "Wohnort ist erforderlich" };
  }
  
  // Erlaubte Zeichen: Buchstaben, Umlaute, Leerzeichen, Bindestriche
  const validPattern = /^[a-zA-ZäöüÄÖÜß\s\-]+$/;
  if (!validPattern.test(wohnort)) {
    return { 
      valid: false, 
      error: "Wohnort darf nur Buchstaben, Leerzeichen und Bindestriche enthalten" 
    };
  }
  
  // Mindest- und Maximallänge prüfen
  if (wohnort.length < 2 || wohnort.length > 50) {
    return { 
      valid: false, 
      error: "Wohnort muss zwischen 2 und 50 Zeichen lang sein" 
    };
  }
  
  return { valid: true };
}

// API-Route
router.get("/:wahl/wahlkreis", (req, res) => {
  const { wahl } = req.params;
  const { wohnort } = req.query;

  log("DEBUG", "Eingehende Anfrage", { wahl, wohnort });

  // Validierung des Wahl-Parameters
  if (!wahl || !wahl.match(/^[a-zA-Z0-9]+$/)) {
    log("WARN", "Ungültiger Wahl-Parameter", { wahl });
    return res.status(400).json({ 
      error: "Ungültiger Parameter 'wahl'. Erlaubt sind nur Buchstaben und Zahlen." 
    });
  }

  // Validierung des Wohnort-Parameters mit der neuen Funktion
  const wohnortValidation = validateWohnort(wohnort);
  if (!wohnortValidation.valid) {
    log("WARN", "Ungültiger Wohnort-Parameter", { 
      wohnort, 
      error: wohnortValidation.error 
    });
    return res.status(400).json({ error: wohnortValidation.error });
  }

  // Sanitierung des Wohnort-Parameters
  const sanitizedWohnort = wohnort
    .trim()                    // Whitespace am Anfang und Ende entfernen
    .toLowerCase()             // Alles kleinschreiben
    .replace(/\s+/g, ' ')      // Mehrfache Leerzeichen auf eines reduzieren
    .replace(/[-]+/g, '-');    // Mehrfache Bindestriche auf einen reduzieren

  log("DEBUG", "Sanitized Wohnort", { wohnort, sanitizedWohnort });

  // Sicherheitscheck für den dynamischen Pfad
  const safeWahl = wahl.replace(/[^a-zA-Z0-9]/g, ''); // Nur alphanumerische Zeichen zulassen
  if (safeWahl !== wahl) {
    log("ERROR", "Versuchte Path Traversal erkannt", { wahl, safeWahl });
    return res.status(400).json({ error: "Ungültiger Wahl-Parameter" });
  }
  
  // Dynamischer Pfad zur JSON-Datei basierend auf der Wahl
  const gemeindeIndexPath = path.join(
    __dirname,
    `../../data/${safeWahl}/gemeindeIndex.json`
  );
  log("DEBUG", "Pfad zur JSON-Datei", { gemeindeIndexPath });

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(gemeindeIndexPath)) {
    log("ERROR", `Keine Daten für die Wahl "${safeWahl}" gefunden.`);
    return res
      .status(404)
      .json({ error: `Keine Daten für die Wahl "${safeWahl}" gefunden.` });
  }

  // JSON-Daten laden
  let gemeindeIndex;
  try {
    const rawData = fs.readFileSync(gemeindeIndexPath, "utf8");
    let parsedData;
    
    try {
      parsedData = JSON.parse(rawData);
    } catch (parseError) {
      log("ERROR", "Fehler beim Parsen der JSON-Datei", { 
        error: parseError.message,
        gemeindeIndexPath 
      });
      return res.status(500).json({ 
        error: "Die Wahlkreisdaten sind fehlerhaft formatiert. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    // Überprüfung der JSON-Struktur
    if (!parsedData || !parsedData.gemeindeIndex || typeof parsedData.gemeindeIndex !== 'object') {
      log("ERROR", "Ungültige JSON-Struktur", { 
        gemeindeIndexPath,
        structure: parsedData ? Object.keys(parsedData) : 'null' 
      });
      return res.status(500).json({ 
        error: "Die Wahlkreisdaten haben eine ungültige Struktur. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    gemeindeIndex = parsedData.gemeindeIndex;
    log("DEBUG", "Geladene Daten", {
      gemeindeIndexKeys: Object.keys(gemeindeIndex),
    });
    log("INFO", "JSON-Datei erfolgreich geladen");
  } catch (error) {
    log("ERROR", "Fehler beim Laden der JSON-Datei", { error: error.message });
    return res
      .status(500)
      .json({ error: "Daten konnten nicht geladen werden" });
  }

  // Suche im gemeindeIndex
  const result = gemeindeIndex[sanitizedWohnort];

  if (result) {
    log("INFO", "Wohnort gefunden", { wohnort: sanitizedWohnort, result });
    res.json({
      wohnort: sanitizedWohnort,
      wahlkreisBez: result.wahlkreisBez,
      wahlkreisNr: result.wahlkreisNr || null, // Falls wahlkreisNr fehlt, wird null zurückgegeben
    });
  } else {
    log("WARN", `Kein Wahlkreis für den Wohnort "${sanitizedWohnort}" gefunden.`);
    res.status(404).json({
      error: `Kein Wahlkreis für den Wohnort "${sanitizedWohnort}" gefunden.`,
    });
  }
});

// Server starten (falls benötigt)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use("/api/v1", router); // Verwende den Router
  app.listen(PORT, () => {
    log("INFO", `Wahlkreis-API läuft auf http://localhost:${PORT}`);
  });
}

module.exports = router; // Exportiere den Router