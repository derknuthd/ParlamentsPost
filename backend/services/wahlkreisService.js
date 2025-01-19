// backend/services/wahlkreisService.js

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Transform } = require('stream');

let cachedWahlkreisMapping = null; // Enthält später sowohl das gemeinde->wahlkreis Mapping als auch das wahlkreisNr->wahlkreisBez Mapping.
let isLoading = false;

/**
 * Entfernt ein etwaiges BOM (Byte Order Mark).
 */
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

/**
 * Lädt die CSV-Datei und befüllt:
 * 1) ein Gemeindename->Wahlkreisnummern Mapping
 * 2) ein Wahlkreisnummer->Wahlkreisbezeichnung Mapping
 */
function loadWahlkreisMapping() {
  return new Promise((resolve, reject) => {
    if (cachedWahlkreisMapping) {
      console.log('[DEBUG] Verwende gecachtes Wahlkreis-Mapping.');
      return resolve(cachedWahlkreisMapping);
    }

    if (isLoading) {
      // Falls bereits ein Ladevorgang läuft, warten wir kurz und versuchen es erneut
      setTimeout(() => resolve(loadWahlkreisMapping()), 200);
      return;
    }

    isLoading = true;
    const gemeindeToWkrMap = {};
    const wkrBezMap = {};

    // Pfad zur echten CSV-Datei
    const csvFilePath = path.join(__dirname, '../data/20200415_btw21_wkr_gemeinden_utf8.csv');
    console.log(`[DEBUG] Lade CSV-Datei: ${csvFilePath}`);

    if (!fs.existsSync(csvFilePath)) {
      console.error(`[ERROR] CSV-Datei nicht gefunden: ${csvFilePath}`);
      return reject(new Error(`CSV-Datei nicht gefunden: ${csvFilePath}`));
    }

    fs.createReadStream(csvFilePath)
      .pipe(removeBom()) // Entferne BOM
      .pipe(csv({ separator: ';' }))
      .on('headers', (headers) => {
        console.log('[DEBUG] CSV headers:', headers);
        // Überprüfe, ob die benötigten Header existieren
        if (!headers.includes('Wahlkreis-Nr') || !headers.includes('Gemeindename') || !headers.includes('Wahlkreis-Bez')) {
          const errorMsg = 'CSV-Datei fehlt erforderlicher Header: "Wahlkreis-Nr", "Gemeindename" oder "Wahlkreis-Bez"';
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      })
      .on('data', (row) => {
        // Gemeindename und Wahlkreisnummer rausziehen
        const gemeinde = (row['Gemeindename'] || '').trim().toLowerCase();
        const wkrNummer = (row['Wahlkreis-Nr'] || '').trim().padStart(3, '0');
        const wkrBez = (row['Wahlkreis-Bez'] || '').trim();

        // Debug-Log
        // console.log(`Gemeinde: "${gemeinde}", WKR-Nr: "${wkrNummer}", WKR-Bez: "${wkrBez}"`);

        // Ungültige Zeilen überspringen
        if (!gemeinde || !wkrNummer) return;

        // 1) Gemeindename->Set aus Wahlkreisnummern
        if (!gemeindeToWkrMap[gemeinde]) {
          gemeindeToWkrMap[gemeinde] = new Set();
        }
        gemeindeToWkrMap[gemeinde].add(wkrNummer);

        // 2) Wahlkreisnummer->Wahlkreisbezeichnung (merken wir uns für später)
        if (!wkrBezMap[wkrNummer]) {
          wkrBezMap[wkrNummer] = wkrBez;
        }
      })
      .on('end', () => {
        // Konvertiere die Sets zu Arrays
        for (const gemeindeKey in gemeindeToWkrMap) {
          gemeindeToWkrMap[gemeindeKey] = Array.from(gemeindeToWkrMap[gemeindeKey]);
        }

        // In einem Objekt zwischenspeichern
        cachedWahlkreisMapping = {
          gemeindeToWkrMap,
          wkrBezMap
        };

        isLoading = false;
        console.log('[DEBUG] CSV-Datei erfolgreich verarbeitet.');
        resolve(cachedWahlkreisMapping);
      })
      .on('error', (error) => {
        isLoading = false;
        console.error('[ERROR] Fehler beim Parsen der CSV-Datei:', error);
        reject(error);
      });
  });
}

/**
 * Findet alle Wahlkreisnummern für eine bestimmte Gemeinde.
 */
async function findWahlkreisNummern(gemeindeName) {
  const { gemeindeToWkrMap } = await loadWahlkreisMapping();

  // Normalisiere den Gemeindennamen
  const normalized = gemeindeName.split(',')[0].trim().toLowerCase().replace(/,\s*stadt$/, '');
  console.log(`[DEBUG] Suche Wahlkreisnummern für Gemeinde: "${normalized}"`);

  // 1) Exakte Übereinstimmung
  if (gemeindeToWkrMap[normalized]) {
    return gemeindeToWkrMap[normalized];
  }

  // 2) Teilübereinstimmung
  const matching = [];
  for (const [key, wkrNummern] of Object.entries(gemeindeToWkrMap)) {
    if (key.includes(normalized)) {
      matching.push(...wkrNummern);
    }
  }

  return matching.length > 0 ? Array.from(new Set(matching)) : [];
}

/**
 * Gibt die Wahlkreis-Bezeichnung für eine Wahlkreisnummer zurück.
 */
async function getWahlkreisBezeichnung(wkrNummer) {
  const { wkrBezMap } = await loadWahlkreisMapping();

  // Falls wir nichts finden, geben wir „Unbekannt“ zurück
  return wkrBezMap[wkrNummer] || 'Unbekannter Wahlkreis';
}

module.exports = {
  findWahlkreisNummern,
  getWahlkreisBezeichnung
};
