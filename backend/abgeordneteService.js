// backend/abgeordneteService.js
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { findWahlkreisNummern } = require('./wahlkreisService');

let cachedAbgeordnete = null;
let lastModified = null;

// Funktion zum Abrufen gefilterter Abgeordneten basierend auf Wahlkreisnummer
const getFilteredAbgeordnete = async (wkrNummer = null) => {
  const abgeordnetePath = path.join(__dirname, 'MdB-Stammdaten', 'MDB_STAMMDATEN.XML');
  const stats = fs.statSync(abgeordnetePath);
  const modifiedTime = stats.mtimeMs;

  if (cachedAbgeordnete && lastModified === modifiedTime) {
    if (wkrNummer) {
      // wkrNummer kann ein Array sein
      if (Array.isArray(wkrNummer)) {
        return cachedAbgeordnete.filter(mdb => wkrNummer.includes(mdb.wkr_nummer));
      } else {
        return cachedAbgeordnete.filter(mdb => mdb.wkr_nummer === wkrNummer);
      }
    }
    return cachedAbgeordnete;
  }

  const xmlData = fs.readFileSync(abgeordnetePath, 'utf8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: true,
    trimValues: true
  });
  const jsonObj = parser.parse(xmlData);

  // Zugriff auf die Abgeordneten
  let abgeordnete = jsonObj.DOCUMENT.MDB;

  // Sicherstellen, dass abgeordnete ein Array ist
  abgeordnete = Array.isArray(abgeordnete) ? abgeordnete : [abgeordnete];

  // Filtern der Abgeordneten der Wahlperiode 20
  const gefilterteAbgeordnete = abgeordnete.filter(abgeordneter => {
    if (abgeordneter.WAHLPERIODEN && abgeordneter.WAHLPERIODEN.WAHLPERIODE) {
      const wahlperioden = Array.isArray(abgeordneter.WAHLPERIODEN.WAHLPERIODE)
        ? abgeordneter.WAHLPERIODEN.WAHLPERIODE
        : [abgeordneter.WAHLPERIODEN.WAHLPERIODE];
      return wahlperioden.some(wp => wp.WP === '20');
    }
    return false;
  });

  // Bereinigung der Daten (nur benötigte Felder)
  const bereinigteAbgeordnete = gefilterteAbgeordnete.map(abgeordneter => {
    // Extrahiere Namen
    const namen = abgeordneter.NAMEN.NAME;
    const nameArray = Array.isArray(namen) ? namen : [namen];
    const ersterName = nameArray[0]; // Nimm den ersten Namenseintrag

    const name = `${ersterName.VORNAME} ${ersterName.NACHNAME}`;
    const partei = abgeordneter.BIOGRAFISCHE_ANGABEN.PARTEI_KURZ || 'Unbekannt';
    const id = abgeordneter.ID || 'Unbekannt';

    // Extrahiere WKR_NUMMER aus der Wahlperiode 20
    let wkr_nummer = '';
    const wahlperiode20 = abgeordneter.WAHLPERIODEN.WAHLPERIODE.find(wp => wp.WP === '20');
    if (wahlperiode20 && wahlperiode20.WKR_NUMMER) {
      wkr_nummer = wahlperiode20.WKR_NUMMER;
    }

    return {
      id,
      name,
      partei,
      wkr_nummer
      // Füge weitere benötigte Felder hinzu, z.B. Geburtsdatum, Geschlecht etc.
    };
  });

  cachedAbgeordnete = bereinigteAbgeordnete;
  lastModified = modifiedTime;

  if (wkrNummer) {
    if (Array.isArray(wkrNummer)) {
      return cachedAbgeordnete.filter(mdb => wkrNummer.includes(mdb.wkr_nummer));
    } else {
      return cachedAbgeordnete.filter(mdb => mdb.wkr_nummer === wkrNummer);
    }
  }

  return cachedAbgeordnete;
};

module.exports = {
  getFilteredAbgeordnete
};
