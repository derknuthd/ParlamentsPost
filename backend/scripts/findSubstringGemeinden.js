const fs = require("fs");
const csvParser = require("csv-parser");
const path = require("path");

// Pfad zur CSV-Datei
const csvFilePath = path.join(
  __dirname,
  "../data/BTW25/btw25_wkr_gemeinden_20241130_utf8.csv"
);

// Liste aller Gemeindenamen
const gemeinden = [];

// CSV-Datei einlesen
fs.createReadStream(csvFilePath)
  .pipe(csvParser({ separator: ";" }))
  .on("data", (row) => {
    if (row["Gemeindename"]) {
      gemeinden.push(row["Gemeindename"].trim());
    }
  })
  .on("end", () => {
    console.log("CSV-Datei erfolgreich eingelesen. Starte Analyse...");

    // Gemeindenamen analysieren
    const teilstringGemeinden = [];
    for (let i = 0; i < gemeinden.length; i++) {
      for (let j = 0; j < gemeinden.length; j++) {
        if (i !== j && gemeinden[j].includes(gemeinden[i])) {
          teilstringGemeinden.push({
            teilstring: gemeinden[i],
            vollstring: gemeinden[j],
          });
        }
      }
    }

    // Ergebnis ausgeben
    console.log("Gefundene Teilstrings:");
    teilstringGemeinden.forEach((item) => {
      console.log(`"${item.teilstring}" ist Teil von "${item.vollstring}"`);
    });

    console.log(`Analyse abgeschlossen. Gefundene Teilstrings: ${teilstringGemeinden.length}`);
  })
  .on("error", (error) => {
    console.error("Fehler beim Einlesen der CSV-Datei:", error.message);
  });