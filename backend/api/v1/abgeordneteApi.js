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
router.get("/:wahl/abgeordnete", (req, res) => {
  const { wahl } = req.params;
  const { wahlkreis, wohnort } = req.query;

  log("DEBUG", "Eingehende Anfrage", { wahl, wahlkreis, wohnort });

  // Validierung der Eingaben
  if (!wahlkreis && !wohnort) {
    log("WARN", "Wahlkreis- und Wohnort-Parameter fehlen");
    return res.status(400).json({
      error:
        "Es muss mindestens ein Wahlkreis oder ein Wohnort angegeben werden.",
    });
  }

  // Dynamischer Pfad zur JSON-Datei basierend auf der Wahl
  const abgeordneteIndexPath = path.join(
    __dirname,
    `../../data/${wahl}/abgeordneteIndex.json`
  );
  log("DEBUG", "Pfad zur JSON-Datei", { abgeordneteIndexPath });

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(abgeordneteIndexPath)) {
    log("ERROR", `Keine Daten für die Wahl "${wahl}" gefunden.`);
    return res
      .status(404)
      .json({ error: `Keine Daten für die Wahl "${wahl}" gefunden.` });
  }

  // JSON-Daten laden
  let abgeordneteIndex;
  try {
    const rawData = fs.readFileSync(abgeordneteIndexPath, "utf8");
    abgeordneteIndex = JSON.parse(rawData);
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
  if (wahlkreis) {
    const wahlkreisIds = Array.isArray(wahlkreis)
      ? wahlkreis
      : wahlkreis.split(",");
    log("DEBUG", "Wahlkreis-IDs", { wahlkreisIds });

    wahlkreisIds.forEach((id) => {
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
  if (wohnort) {
    const wohnorte = Array.isArray(wohnort) ? wohnort : wohnort.split(",");
    log("DEBUG", "Wohnorte", { wohnorte });

    wohnorte.forEach((ort) => {
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
    const uniqueResults = Array.from(results).map((item) => JSON.parse(item));
    log("INFO", "Abgeordnete gefunden", { count: uniqueResults.length });
    res.json(uniqueResults);
  } else {
    log("WARN", "Keine Abgeordneten gefunden");
    res.status(404).json({ error: "Keine Abgeordneten gefunden." });
  }
});

// Server starten (falls benötigt)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    log("INFO", `Abgeordnete-API läuft auf http://localhost:${PORT}`);
  });
}

module.exports = router;
