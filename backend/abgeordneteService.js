const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

let cachedAbgeordnete = null;
let lastModified = null;

// Funktion zum Abrufen gefilterter Abgeordneten basierend auf Wahlkreisnummern
const getFilteredAbgeordnete = async (wkrNummern = []) => {
  const abgeordnetePath = path.join(__dirname, 'MdB-Stammdaten', 'MDB_STAMMDATEN.XML');
  const stats = fs.statSync(abgeordnetePath);
  const modifiedTime = stats.mtimeMs;

  console.log(`[DEBUG] [getFilteredAbgeordnete] Pfad zur XML-Datei: ${abgeordnetePath}`);
  console.log(`[DEBUG] [getFilteredAbgeordnete] Letzte Änderung der XML-Datei: ${new Date(modifiedTime).toISOString()}`);

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

  // Sicherstellen, dass abgeordnete ein Array ist
  abgeordnete = Array.isArray(abgeordnete) ? abgeordnete : [abgeordnete];
  console.log(`[DEBUG] [getFilteredAbgeordnete] Gesamtzahl der Abgeordneten in XML: ${abgeordnete.length}`);

  // Filtern der Abgeordneten der Wahlperiode 20
  const gefilterteAbgeordnete = abgeordnete.filter(abgeordneter => {
    if (abgeordneter.WAHLPERIODEN && abgeordneter.WAHLPERIODEN.WAHLPERIODE) {
      const wahlperioden = Array.isArray(abgeordneter.WAHLPERIODEN.WAHLPERIODE)
        ? abgeordneter.WAHLPERIODEN.WAHLPERIODE
        : [abgeordneter.WAHLPERIODEN.WAHLPERIODE];

      console.log(`[DEBUG] [getFilteredAbgeordnete] Abgeordneter ID: ${abgeordneter.ID}, Wahlperioden:`, wahlperioden.map(wp => wp.WP));

      return wahlperioden.some(wp => String(wp.WP).trim() === '20');
    }
    return false;
  });

  console.log(`[DEBUG] [getFilteredAbgeordnete] Anzahl der Abgeordneten in Wahlperiode 20: ${gefilterteAbgeordnete.length}`);

  // Bereinigung der Daten (nur benötigte Felder)
  const bereinigteAbgeordnete = gefilterteAbgeordnete.map(abgeordneter => {
    const namen = abgeordneter.NAMEN.NAME;
    const nameArray = Array.isArray(namen) ? namen : [namen];
    const ersterName = nameArray[0];
    const name = `${ersterName.VORNAME} ${ersterName.NACHNAME}`;
    const partei = abgeordneter.BIOGRAFISCHE_ANGABEN.PARTEI_KURZ || 'Unbekannt';
    const id = abgeordneter.ID || 'Unbekannt';
  
    const wahlperiode20 = Array.isArray(abgeordneter.WAHLPERIODEN.WAHLPERIODE)
      ? abgeordneter.WAHLPERIODEN.WAHLPERIODE.find(wp => String(wp.WP).trim() === '20')
      : (String(abgeordneter.WAHLPERIODEN.WAHLPERIODE.WP).trim() === '20'
        ? abgeordneter.WAHLPERIODEN.WAHLPERIODE
        : null);
  
    let wkr_nummer = null;
  
    if (wahlperiode20 && typeof wahlperiode20.WKR_NUMMER === 'string') {
      wkr_nummer = wahlperiode20.WKR_NUMMER.trim().padStart(3, '0');
    } else if (wahlperiode20 && typeof wahlperiode20.WKR_NUMMER === 'number') {
      wkr_nummer = String(wahlperiode20.WKR_NUMMER).padStart(3, '0');
    } else {
      console.log(`[DEBUG] Abgeordneter ID: ${id} hat keine gültige Wahlkreisnummer.`);
    }
  
    return { id, name, partei, wkr_nummer };
  });  

  console.log(`[DEBUG] [getFilteredAbgeordnete] Wahlkreisnummern der bereinigten Abgeordneten:`);
  bereinigteAbgeordnete.forEach(mdb => console.log(`Abgeordneter ID: ${mdb.id}, Wahlkreisnummer: ${mdb.wkr_nummer}`));

  console.log(`[DEBUG] [getFilteredAbgeordnete] Anzahl der bereinigten Abgeordnetendaten: ${bereinigteAbgeordnete.length}`);

  cachedAbgeordnete = bereinigteAbgeordnete;
  lastModified = modifiedTime;

  if (wkrNummern.length > 0) {
    console.log(`[DEBUG] [getFilteredAbgeordnete] Filtere nach Wahlkreisnummern: ${wkrNummern.join(', ')}`);
    wkrNummern.forEach(wkr => {
      const matches = cachedAbgeordnete.filter(mdb => mdb.wkr_nummer === wkr);
      console.log(`[DEBUG] Wahlkreisnummer: ${wkr}, Treffer: ${matches.length}`);
    });
    return cachedAbgeordnete.filter(mdb => wkrNummern.includes(mdb.wkr_nummer));
  }

  return cachedAbgeordnete;
};

module.exports = { getFilteredAbgeordnete };
