const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router(); // Ändere von `app` zu `router`

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

// API-Route
router.get("/:wahl/wahlkreis", (req, res) => {
  const { wahl } = req.params;
  const { wohnort } = req.query;

  log("DEBUG", "Eingehende Anfrage", { wahl, wohnort });

  // Validierung der Eingaben
  if (!wohnort) {
    log("WARN", "Wohnort-Parameter fehlt");
    return res.status(400).json({ error: "Wohnort ist erforderlich" });
  }

  // Dynamischer Pfad zur JSON-Datei basierend auf der Wahl
  const gemeindeIndexPath = path.join(
    __dirname,
    `../../data/${wahl}/gemeindeIndex.json`
  );
  log("DEBUG", "Pfad zur JSON-Datei", { gemeindeIndexPath });

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(gemeindeIndexPath)) {
    log("ERROR", `Keine Daten für die Wahl "${wahl}" gefunden.`);
    return res
      .status(404)
      .json({ error: `Keine Daten für die Wahl "${wahl}" gefunden.` });
  }

  // JSON-Daten laden
  let gemeindeIndex;
  try {
    const rawData = fs.readFileSync(gemeindeIndexPath, "utf8");
    const parsedData = JSON.parse(rawData);
    gemeindeIndex = parsedData.gemeindeIndex; // Zugriff auf die verschachtelte Ebene
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

  // Wohnort normalisieren (case-insensitive Suche)
  const normalizedWohnort = wohnort.trim().toLowerCase();
  log("DEBUG", "Normalisierter Wohnort", { normalizedWohnort });

  // Suche im gemeindeIndex
  const result = gemeindeIndex[normalizedWohnort];

  if (result) {
    log("INFO", "Wohnort gefunden", { wohnort, result });
    res.json({
      wohnort,
      wahlkreisBez: result.wahlkreisBez,
      wahlkreisNr: result.wahlkreisNr || null, // Falls wahlkreisNr fehlt, wird null zurückgegeben
    });
  } else {
    log("WARN", `Kein Wahlkreis für den Wohnort "${wohnort}" gefunden.`);
    res.status(404).json({
      error: `Kein Wahlkreis für den Wohnort "${wohnort}" gefunden.`,
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
