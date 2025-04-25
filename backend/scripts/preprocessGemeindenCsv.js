const fs = require("fs");
const csvParser = require("csv-parser");
const path = require("path");

// Pfad zur CSV-Datei
const csvFilePath = path.join(
  __dirname,
  "../data/BTW25/btw25_wkr_gemeinden_20241130_utf8.csv"
);

// Pfad zur Ausgabe-JSON-Datei
const outputJsonPath = path.join(__dirname, "../data/BTW25/gemeindeIndex.json");

// Funktion, um Zusätze wie ", Stadt" aus Gemeindenamen zu entfernen
function normalizeName(name) {
  return name.split(",")[0].trim().toLowerCase();
}

// Index für die optimierten Daten
const gemeindeIndex = {};

// CSV-Datei einlesen und verarbeiten
fs.createReadStream(csvFilePath)
  .pipe(csvParser({ separator: ";" }))
  .on("data", (row) => {
    const wahlkreisNr = row["Wahlkreis-Nr"]?.trim();
    const wahlkreisBez = row["Wahlkreis-Bez"]?.trim();
    const gemeindename = row["Gemeindename"]?.trim();
    const gemeindeverband = row["GemVerband-Name"]?.trim();

    if (wahlkreisNr && wahlkreisBez) {
      // Gemeindename normalisieren und hinzufügen
      if (gemeindename) {
        const normalizedGemeindename = normalizeName(gemeindename);
        if (!gemeindeIndex[normalizedGemeindename]) {
          gemeindeIndex[normalizedGemeindename] = {
            wahlkreisNr,
            wahlkreisBez,
          };
        }
      }

      // Gemeindeverband normalisieren und hinzufügen
      if (gemeindeverband) {
        const normalizedGemeindeverband = normalizeName(gemeindeverband);
        if (!gemeindeIndex[normalizedGemeindeverband]) {
          gemeindeIndex[normalizedGemeindeverband] = {
            wahlkreisNr,
            wahlkreisBez,
          };
        }
      }
    }
  })
  .on("end", () => {
    console.log("CSV-Datei erfolgreich verarbeitet. Speichere JSON...");

    // JSON-Datei speichern
    fs.writeFileSync(
      outputJsonPath,
      JSON.stringify({ gemeindeIndex }, null, 2)
    );
    console.log(`JSON-Datei gespeichert unter: ${outputJsonPath}`);
  })
  .on("error", (error) => {
    console.error("Fehler beim Einlesen der CSV-Datei:", error.message);
  });
