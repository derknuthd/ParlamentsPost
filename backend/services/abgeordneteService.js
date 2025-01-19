// backend/services/abgeordneteService.js

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { getWahlkreisBezeichnung } = require('./wahlkreisService');

let cachedAbgeordnete = null;
let lastModified = null;

// Funktion zum Abrufen gefilterter Abgeordneten basierend auf Wahlkreisnummern
const getFilteredAbgeordnete = async (wkrNummern = []) => {
  const abgeordnetePath = path.join(__dirname, '../data/MDB_STAMMDATEN.XML');
  const stats = fs.statSync(abgeordnetePath);
  const modifiedTime = stats.mtimeMs;

  console.log(`[DEBUG] [getFilteredAbgeordnete] Pfad zur XML-Datei: ${abgeordnetePath}`);
  console.log(`[DEBUG] [getFilteredAbgeordnete] Letzte Änderung der XML-Datei: ${new Date(modifiedTime).toISOString()}`);

  // Cache
  if (cachedAbgeordnete && lastModified === modifiedTime) {
    console.log('[DEBUG] [getFilteredAbgeordnete] Verwende gecachte Abgeordnete.');
    if (wkrNummern.length > 0) {
      return cachedAbgeordnete.filter(mdb => wkrNummern.includes(mdb.wkr_nummer));
    }
    return cachedAbgeordnete;
  }

  console.log('[DEBUG] [getFilteredAbgeordnete] Lade und parse die XML-Datei.');
  const xmlData = fs.readFileSync(abgeordnetePath, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: true,
    trimValues: true,
  });
  const jsonObj = parser.parse(xmlData);
  console.log('[DEBUG] [getFilteredAbgeordnete] XML-Datei erfolgreich geparst.');

  let abgeordnete = jsonObj.DOCUMENT.MDB;
  abgeordnete = Array.isArray(abgeordnete) ? abgeordnete : [abgeordnete];
  console.log(`[DEBUG] [getFilteredAbgeordnete] Gesamtzahl der Abgeordneten in XML: ${abgeordnete.length}`);

  // Nur WP=20
  const gefilterteAbgeordnete = abgeordnete.filter(abg => {
    if (abg.WAHLPERIODEN && abg.WAHLPERIODEN.WAHLPERIODE) {
      const wahlperioden = Array.isArray(abg.WAHLPERIODEN.WAHLPERIODE)
        ? abg.WAHLPERIODEN.WAHLPERIODE
        : [abg.WAHLPERIODEN.WAHLPERIODE];

      return wahlperioden.some(wp => String(wp.WP).trim() === '20');
    }
    return false;
  });
  console.log(`[DEBUG] [getFilteredAbgeordnete] Anzahl der Abgeordneten in Wahlperiode 20: ${gefilterteAbgeordnete.length}`);

  // Daten bereinigen und Wahlkreisbezeichnung holen
  const bereinigteAbgeordnete = [];
  for (const abg of gefilterteAbgeordnete) {
    const namen = abg.NAMEN.NAME;
    const nameArray = Array.isArray(namen) ? namen : [namen];
    const ersterName = nameArray[0];
    const name = `${ersterName.VORNAME} ${ersterName.NACHNAME}`;
    const partei = abg.BIOGRAFISCHE_ANGABEN?.PARTEI_KURZ || 'Unbekannt';
    const id = abg.ID || 'Unbekannt';

    // WP=20
    const wahlperiode20 = Array.isArray(abg.WAHLPERIODEN.WAHLPERIODE)
      ? abg.WAHLPERIODEN.WAHLPERIODE.find(wp => String(wp.WP).trim() === '20')
      : (String(abg.WAHLPERIODEN.WAHLPERIODE.WP).trim() === '20'
        ? abg.WAHLPERIODEN.WAHLPERIODE
        : null);

    let wkr_nummer = null;
    if (wahlperiode20 && typeof wahlperiode20.WKR_NUMMER === 'string') {
      wkr_nummer = wahlperiode20.WKR_NUMMER.trim().padStart(3, '0');
    } else if (wahlperiode20 && typeof wahlperiode20.WKR_NUMMER === 'number') {
      wkr_nummer = String(wahlperiode20.WKR_NUMMER).padStart(3, '0');
    }

    let wkr_bezeichnung = 'Wahlkreis unbekannt';
    if (wkr_nummer) {
      wkr_bezeichnung = await getWahlkreisBezeichnung(wkr_nummer);
    }

    bereinigteAbgeordnete.push({
      id,
      name,
      partei,
      wkr_nummer,
      wkr_bezeichnung
    });
  }

  // **NEU**: Sortieren nach wkr_nummer (numerisch)
  bereinigteAbgeordnete.sort((a, b) => {
    const numA = a.wkr_nummer ? parseInt(a.wkr_nummer, 10) : 0;
    const numB = b.wkr_nummer ? parseInt(b.wkr_nummer, 10) : 0;
    return numA - numB;
  });

  // Cache aktualisieren
  cachedAbgeordnete = bereinigteAbgeordnete;
  lastModified = modifiedTime;

  // Falls wir nach bestimmten Nummern filtern
  if (wkrNummern.length > 0) {
    console.log(`[DEBUG] [getFilteredAbgeordnete] Filtere nach Wahlkreisnummern: ${wkrNummern.join(', ')}`);
    return cachedAbgeordnete.filter(mdb => wkrNummern.includes(mdb.wkr_nummer));
  }

  return cachedAbgeordnete;
};

module.exports = { getFilteredAbgeordnete };
