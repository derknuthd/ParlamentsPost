require("dotenv").config(); // Lädt die .env-Datei

const express = require("express");
const fs = require("fs");
const csvParser = require("csv-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Logging-Level (z. B. DEBUG, INFO, WARN, ERROR)
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";

// Logging-Funktion basierend auf dem Level
function log(level, message) {
  const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
  if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
    console.log(`[${level}] ${message}`);
  }
}

// Middleware to parse JSON requests
app.use(express.json());

// Endpoint to get Wahlkreis-Nr by Gemeindename und Wahl
app.get("/api/v1/:wahl/wahlkreis", async (req, res) => {
  const { wahl } = req.params; // Wahl (z. B. "BTW25") aus der URL
  const gemeindename = req.query.gemeindename;

  log("DEBUG", `Anfrage erhalten: Wahl=${wahl}, Gemeindename=${gemeindename}`);

  if (!gemeindename) {
    log("ERROR", "Kein Gemeindename angegeben.");
    return res.status(400).json({ error: "Gemeindename ist erforderlich" });
  }

  // Dynamischer Pfad zur CSV-Datei basierend auf der Wahl
  const csvFilePath = path.join(
    __dirname,
    `../../data/${wahl}/btw25_wkr_gemeinden_20241130_utf8.csv`
  );

  log("DEBUG", `CSV-Dateipfad: ${csvFilePath}`);

  // Überprüfen, ob die Datei existiert
  if (!fs.existsSync(csvFilePath)) {
    log("ERROR", `Datei nicht gefunden: ${csvFilePath}`);
    return res
      .status(404)
      .json({ error: `Daten für die Wahl "${wahl}" nicht gefunden.` });
  }

  try {
    const results = [];
    log("INFO", "Beginne mit dem Einlesen der CSV-Datei...");

    const stream = fs
      .createReadStream(csvFilePath)
      .pipe(csvParser({ separator: ";" }))
      .on("data", (row) => {
        log("DEBUG", `Gelesene Zeile: ${JSON.stringify(row)}`);

        // Prüfen, ob der Gemeindename teilweise übereinstimmt, aber mit Mindestlänge
        if (
          gemeindename.trim().length >= 3 && // Mindestlänge von 3 Zeichen
          row["Gemeindename"]
            ?.trim()
            .toLowerCase()
            .includes(gemeindename.trim().toLowerCase())
        ) {
          log("DEBUG", `Treffer gefunden: ${JSON.stringify(row)}`);
          results.push(row["Wahlkreis-Nr"]?.trim()); // Trimmen des Werts
        }
      })
      .on("end", () => {
        log("INFO", "Einlesen der CSV-Datei abgeschlossen.");
        if (results.length > 0) {
          log("INFO", `Ergebnisse gefunden: ${results}`);
          res.json({ gemeindename, wahlkreisNr: results });
        } else {
          log(
            "WARN",
            `Kein Wahlkreis für die Gemeinde "${gemeindename}" gefunden.`
          );
          res.status(404).json({
            error: `Kein Wahlkreis für die Gemeinde "${gemeindename}" gefunden.`,
          });
        }
      });
  } catch (error) {
    log("ERROR", `Fehler beim Lesen der CSV-Datei: ${error.message}`);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

// Start the server
app.listen(PORT, () => {
  log("INFO", `Server läuft auf http://localhost:${PORT}`);
});
