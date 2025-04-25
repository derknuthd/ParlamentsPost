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

    // Gemeindenamen nach Länge sortieren
    const sortierteGemeinden = gemeinden.sort((a, b) => a.length - b.length);

    // Top 50 kürzeste Gemeindenamen auswählen
    const top50 = sortierteGemeinden.slice(0, 100);

    // Ergebnis ausgeben
    console.log("Top 50 kürzeste Gemeindenamen:");
    top50.forEach((gemeinde, index) => {
      console.log(`${index + 1}. ${gemeinde} (${gemeinde.length} Zeichen)`);
    });

    console.log(`Analyse abgeschlossen. Insgesamt analysierte Gemeinden: ${gemeinden.length}`);
  })
  .on("error", (error) => {
    console.error("Fehler beim Einlesen der CSV-Datei:", error.message);
  });