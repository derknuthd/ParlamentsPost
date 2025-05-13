const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router();

// Import Service-Module
const logService = require('../../services/logService');

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

// Neue Hilfsfunktion: Fuzzy-Suche für Wohnorte
// Diese Funktion findet sowohl exakte Übereinstimmungen als auch Wohnorte, die den Suchbegriff enthalten
function findMatchingWohnorte(gemeindeIndex, sanitizedWohnort) {
  let matches = [];
  
  // 1. Exakte Übereinstimmung prüfen
  if (gemeindeIndex[sanitizedWohnort]) {
    matches.push({
      wohnort: sanitizedWohnort,
      wahlkreisBez: gemeindeIndex[sanitizedWohnort].wahlkreisBez,
      wahlkreisNr: gemeindeIndex[sanitizedWohnort].wahlkreisNr || null,
      matchType: "exact"
    });
  }
  
  // 2. Partielle Übereinstimmungen suchen (nur wenn keine exakte Übereinstimmung gefunden wurde)
  if (matches.length === 0) {
    for (const wohnort in gemeindeIndex) {
      // Fall 1: Suchbegriff ist am Beginn des vollständigen Wohnorts 
      // (z.B. "Ludwigshafen" in "ludwigshafen am rhein")
      if (wohnort.startsWith(sanitizedWohnort + " ")) {
        matches.push({
          wohnort: wohnort,
          wahlkreisBez: gemeindeIndex[wohnort].wahlkreisBez,
          wahlkreisNr: gemeindeIndex[wohnort].wahlkreisNr || null,
          matchType: "partial"
        });
      }
      
      // Fall 2: Suchbegriff ist exakt der erste Teil eines zusammengesetzten Namens 
      // (z.B. "Frankenthal" in "frankenthal (pfalz)")
      if (wohnort.match(new RegExp(`^${sanitizedWohnort}\\s*\\([^)]+\\)$`))) {
        matches.push({
          wohnort: wohnort,
          wahlkreisBez: gemeindeIndex[wohnort].wahlkreisBez,
          wahlkreisNr: gemeindeIndex[wohnort].wahlkreisNr || null,
          matchType: "partial"
        });
      }
    }
  }
  
  return matches;
}

// API-Route
router.get("/:wahl/wahlkreis", (req, res) => {
  const { wahl } = req.params;
  const { wohnort } = req.query;

  logService.debug("Eingehende Anfrage", { wahl, wohnort });

  // Validierung des Wahl-Parameters
  if (!wahl || !wahl.match(/^[a-zA-Z0-9]+$/)) {
    logService.warn("Ungültiger Wahl-Parameter", { wahl });
    return res.status(400).json({ 
      error: "Eingabefehler", 
      message: "Ungültiger Parameter 'wahl'. Erlaubt sind nur Buchstaben und Zahlen." 
    });
  }

  // Validierung des Wohnort-Parameters mit der neuen Funktion
  const wohnortValidation = validateWohnort(wohnort);
  if (!wohnortValidation.valid) {
    logService.warn("Ungültiger Wohnort-Parameter", { 
      wohnort, 
      error: wohnortValidation.error 
    });
    return res.status(400).json({ 
      error: "Eingabefehler", 
      message: wohnortValidation.error 
    });
  }

  // Sanitierung des Wohnort-Parameters
  const sanitizedWohnort = wohnort
    .trim()                    // Whitespace am Anfang und Ende entfernen
    .toLowerCase()             // Alles kleinschreiben
    .replace(/\s+/g, ' ')      // Mehrfache Leerzeichen auf eines reduzieren
    .replace(/[-]+/g, '-');    // Mehrfache Bindestriche auf einen reduzieren

  logService.debug("Sanitized Wohnort", { wohnort, sanitizedWohnort });

  // Sicherheitscheck für den dynamischen Pfad
  const safeWahl = wahl.replace(/[^a-zA-Z0-9]/g, ''); // Nur alphanumerische Zeichen zulassen
  if (safeWahl !== wahl) {
    logService.error("Versuchte Path Traversal erkannt", { wahl, safeWahl });
    return res.status(400).json({ 
      error: "Sicherheitsverletzung", 
      message: "Ungültiger Wahl-Parameter" 
    });
  }
  
  // Dynamischer Pfad zur JSON-Datei basierend auf der Wahl
  const gemeindeIndexPath = path.join(
    __dirname,
    `../../data/${safeWahl}/gemeindeIndex.json`
  );
  logService.debug("Pfad zur JSON-Datei", { gemeindeIndexPath });

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(gemeindeIndexPath)) {
    logService.error(`Keine Daten für die Wahl "${safeWahl}" gefunden.`);
    return res.status(404).json({ 
      error: "Daten nicht gefunden", 
      message: `Keine Daten für die Wahl "${safeWahl}" gefunden.` 
    });
  }

  // JSON-Daten laden
  let gemeindeIndex;
  try {
    const rawData = fs.readFileSync(gemeindeIndexPath, "utf8");
    let parsedData;
    
    try {
      parsedData = JSON.parse(rawData);
    } catch (parseError) {
      logService.error("Fehler beim Parsen der JSON-Datei", { 
        error: parseError.message,
        gemeindeIndexPath 
      });
      return res.status(500).json({ 
        error: "Datenformatfehler", 
        message: "Die Wahlkreisdaten sind fehlerhaft formatiert. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    // Überprüfung der JSON-Struktur
    if (!parsedData || !parsedData.gemeindeIndex || typeof parsedData.gemeindeIndex !== 'object') {
      logService.error("Ungültige JSON-Struktur", { 
        gemeindeIndexPath,
        structure: parsedData ? Object.keys(parsedData) : 'null' 
      });
      return res.status(500).json({ 
        error: "Datenstrukturfehler", 
        message: "Die Wahlkreisdaten haben eine ungültige Struktur. Bitte wenden Sie sich an den Administrator." 
      });
    }
    
    gemeindeIndex = parsedData.gemeindeIndex;
    logService.debug("Geladene Daten", {
      gemeindeIndexKeys: Object.keys(gemeindeIndex),
    });
    logService.info("JSON-Datei erfolgreich geladen");
  } catch (error) {
    logService.error("Fehler beim Laden der JSON-Datei", { error: error.message });
    return res.status(500).json({ 
      error: "Datenzugriffsfehler", 
      message: "Daten konnten nicht geladen werden" 
    });
  }

  // Hier verwendet die angepasste Suchfunktion für die Wahlkreise
  const matches = findMatchingWohnorte(gemeindeIndex, sanitizedWohnort);
  logService.debug("Gefundene Übereinstimmungen", { matches });

  if (matches.length > 0) {
    // Wenn es exakte und partielle Übereinstimmungen gibt, priorisieren wir die exakten
    const exactMatches = matches.filter(match => match.matchType === "exact");
    
    if (exactMatches.length > 0) {
      logService.info("Exakte Übereinstimmungen gefunden", { matches: exactMatches });
      
      // Wenn es nur eine exakte Übereinstimmung gibt, dann diese zurückgeben
      if (exactMatches.length === 1) {
        const match = exactMatches[0];
        res.json({
          wohnort: match.wohnort,
          wahlkreisBez: match.wahlkreisBez,
          wahlkreisNr: match.wahlkreisNr
        });
      } else {
        // Wenn es mehrere exakte Übereinstimmungen gibt, dann alle als Array zurückgeben
        res.json(exactMatches.map(match => ({
          wohnort: match.wohnort,
          wahlkreisBez: match.wahlkreisBez,
          wahlkreisNr: match.wahlkreisNr
        })));
      }
    } else {
      // Nur partielle Übereinstimmungen
      logService.info("Partielle Übereinstimmungen gefunden", { matches });
      
      // Wenn es nur eine partielle Übereinstimmung gibt, dann diese zurückgeben
      if (matches.length === 1) {
        const match = matches[0];
        res.json({
          wohnort: match.wohnort,
          wahlkreisBez: match.wahlkreisBez,
          wahlkreisNr: match.wahlkreisNr
        });
      } else {
        // Wenn es mehrere partielle Übereinstimmungen gibt, dann alle als Array zurückgeben
        res.json(matches.map(match => ({
          wohnort: match.wohnort,
          wahlkreisBez: match.wahlkreisBez,
          wahlkreisNr: match.wahlkreisNr
        })));
      }
    }
  } else {
    logService.warn(`Kein Wahlkreis für den Wohnort "${sanitizedWohnort}" gefunden.`);
    res.status(404).json({
      error: "Keine Daten",
      message: `Kein Wahlkreis für den Wohnort "${sanitizedWohnort}" gefunden.`
    });
  }
});

// Server starten (falls benötigt)
if (require.main === module) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use("/api/v1", router); // Verwende den Router
  app.listen(PORT, () => {
    logService.info(`Wahlkreis-API läuft auf http://localhost:${PORT}`);
  });
}

module.exports = router; // Exportiere den Router