// backend/wahlkreisService.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');

let cachedWahlkreisMapping = null;

// Eigene Funktion zur Entfernung des BOM
function removeBom() {
  let bomRemoved = false;
  return new Transform({
    transform(chunk, encoding, callback) {
      const str = chunk.toString('utf8');
      if (!bomRemoved) {
        const stripped = str.replace(/^\uFEFF/, '');
        this.push(stripped);
        bomRemoved = true;
      } else {
        this.push(str);
      }
      callback();
    }
  });
}

// Funktion zum Laden und Parsen der CSV-Datei
const loadWahlkreisMapping = () => {
  return new Promise((resolve, reject) => {
    if (cachedWahlkreisMapping) {
      console.log('Verwende gecachte Wahlkreis-Mapping.');
      return resolve(cachedWahlkreisMapping);
    }

    const mapping = {};

    // Setze den Pfad zur echten CSV-Datei
    const csvFilePath = path.join(__dirname, 'Wahlkreise', '20200415_btw21_wkr_gemeinden_utf8.csv');
    console.log(`Versuche, CSV-Datei zu laden: ${csvFilePath}`);

    // Überprüfe, ob die Datei existiert
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV-Datei nicht gefunden: ${csvFilePath}`);
      return reject(new Error(`CSV-Datei nicht gefunden: ${csvFilePath}`));
    }

    fs.createReadStream(csvFilePath)
      .pipe(removeBom()) // Entferne BOM
      .pipe(csv({ 
        separator: ';'
      }))
      .on('headers', (headers) => {
        console.log('CSV headers:', headers);
        // Überprüfe, ob die erforderlichen Header vorhanden sind
        if (!headers.includes('Wahlkreis-Nr') || !headers.includes('Gemeindename')) {
          const errorMsg = 'CSV-Datei fehlt erforderliche Header: "Wahlkreis-Nr" und/oder "Gemeindename"';
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      })
      .on('data', (row) => {
        console.log('Gelesene Zeile:', row);
        const gemeinde = row['Gemeindename'] ? row['Gemeindename'].trim().toLowerCase() : '';
        const wkrNummer = row['Wahlkreis-Nr'] ? row['Wahlkreis-Nr'].trim() : '';

        console.log(`Gemeinde: "${gemeinde}", Wahlkreis-Nr: "${wkrNummer}"`); // Zusätzliche Debug-Logs

        // Validierung der Datenzeile
        if (!gemeinde || !wkrNummer) {
          console.warn('Ungültige Zeile übersprungen:', row);
          return; // Überspringe ungültige Zeilen
        }

        if (!mapping[gemeinde]) {
          mapping[gemeinde] = new Set();
        }
        mapping[gemeinde].add(wkrNummer);
      })
      .on('end', () => {
        // Konvertiere die Sets zu Arrays
        for (const gemeinde in mapping) {
          mapping[gemeinde] = Array.from(mapping[gemeinde]);
        }
        cachedWahlkreisMapping = mapping;
        console.log('CSV-Datei erfolgreich verarbeitet.');
        console.log('Wahlkreis Mapping:', mapping); // Debug-Log
        resolve(cachedWahlkreisMapping);
      })
      .on('error', (error) => {
        console.error('Fehler beim Parsen der CSV-Datei:', error);
        reject(error);
      });
  });
};

// Funktion zum Finden der Wahlkreisnummern basierend auf dem Gemeindennamen
const findWahlkreisNummern = async (gemeindeName) => {
  const mapping = await loadWahlkreisMapping();

  // Normalisiere den Gemeindennamen: Kleinbuchstaben und entferne alles nach dem ersten Komma
  const normalizedGemeinde = gemeindeName.split(',')[0].trim().toLowerCase().replace(/,\s*stadt$/, '');
  console.log(`Suche nach Wahlkreisnummern für Gemeinde: "${normalizedGemeinde}"`);

  // Suche nach exakter Übereinstimmung
  if (mapping[normalizedGemeinde]) {
    console.log(`Gefundene Wahlkreisnummern: ${mapping[normalizedGemeinde]}`);
    return mapping[normalizedGemeinde];
  }

  // Suche nach Teilübereinstimmungen (einfaches Substring Matching)
  const matchingWkr = [];
  for (const [gemeinde, wkrNummern] of Object.entries(mapping)) {
    if (gemeinde.includes(normalizedGemeinde)) {
      matchingWkr.push(...wkrNummern);
    }
  }

  console.log(`Teilübereinstimmungen gefunden: ${matchingWkr.length > 0 ? matchingWkr.join(',') : 'Keine'}`);
  return matchingWkr.length > 0 ? Array.from(new Set(matchingWkr)) : [];
};

module.exports = {
  findWahlkreisNummern
};
