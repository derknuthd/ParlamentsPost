const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
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

// API-Route
router.get("/:wahl/wahlkreis", async (req, res) => {
  console.log("[DEBUG] [wahlkreisApi] Anfrage erhalten:");
  console.log(`[DEBUG] Wahl: ${req.params.wahl}`);
  console.log(`[DEBUG] Wohnort: ${req.query.wohnort}`);

  try {
    // Deine Logik hier...
    res.json({ wahlkreisNr: "123", wahlkreisBez: "Beispiel-Wahlkreis" });
  } catch (error) {
    console.error("[ERROR] [wahlkreisApi] Fehler:", error);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

app.use("/api/v1", router);

// Server starten (falls benötigt)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    log("INFO", `Wahlkreis-API läuft auf http://localhost:${PORT}`);
  });
}

module.exports = app;
