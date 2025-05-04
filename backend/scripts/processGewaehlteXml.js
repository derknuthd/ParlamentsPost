const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

// Pfad zur XML-Datei
const xmlFilePath = path.join(__dirname, "../data/BTW25/gewaehlte_02.xml");

// Neuer Pfad zur Ausgabe-JSON-Datei
const outputJsonPath = path.join(
  __dirname,
  "../data/BTW25/abgeordneteIndex.json"
);

// Funktion, um die XML-Daten zu parsen
function parseXmlToJson(xmlData) {
  const parser = new xml2js.Parser({ explicitArray: false });
  return new Promise((resolve, reject) => {
    parser.parseString(xmlData, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Funktion, um den vollständigen Namen zu formatieren
function formatFullName(titel, rufname, vorname, namensbestandteile, name) {
  const titelTeil = titel ? `${titel} ` : "";
  const namensbestandteileTeil = namensbestandteile
    ? `${namensbestandteile} `
    : "";
  const rufnameTeil =
    rufname && !vorname.toLowerCase().includes(rufname.toLowerCase())
      ? `"${rufname}" `
      : "";
  return `${titelTeil}${rufnameTeil}${vorname} ${namensbestandteileTeil}${name}`.trim();
}

// Funktion zum Normalisieren des Wohnorts für Index-Zwecke
function normalizeWohnort(wohnort) {
  return wohnort
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[-]+/g, '-');
}

// Funktion, um die Daten zu verarbeiten
function processKandidatenData(parsedData) {
  const wahlkreise = {};
  const wohnorte = {};
  const idMap = new Map(); // Map zur Speicherung von IDs
  let currentId = 1; // Start-ID

  // Kandidaten Array sicherstellen
  const kandidaten = parsedData.Kandidaten.Kandidat;
  const kandidatenArray = Array.isArray(kandidaten) ? kandidaten : [kandidaten];

  kandidatenArray.forEach((kandidat) => {
    const personendaten = kandidat.Personendaten;
    const wahldaten = kandidat.Wahldaten;

    // Partei aus Liste holen, falls vorhanden
    let partei = "Unbekannt";
    if (wahldaten.Liste) {
      partei = wahldaten.Liste.$.Gruppenname;
    } else if (wahldaten.Direkt) {
      partei = wahldaten.Direkt.$.Gruppenname;
    }

    // Wahlkreis aus Verknüpfung holen
    let wahlkreisNummer = "ohneWahlkreis";
    let wahlkreisName = "Unbekannt";
    if (
      wahldaten.Verknuepfung &&
      wahldaten.Verknuepfung.$.Gebietsart === "WAHLKREIS"
    ) {
      wahlkreisNummer = wahldaten.Verknuepfung.$.Gebietsnummer;
      wahlkreisName = wahldaten.Verknuepfung.$.Gebietsname || "Unbekannt";
    } else if (
      wahldaten.Direkt &&
      wahldaten.Direkt.$.Gebietsart === "WAHLKREIS"
    ) {
      wahlkreisNummer = wahldaten.Direkt.$.Gebietsnummer;
      wahlkreisName = wahldaten.Direkt.$.Gebietsname || "Unbekannt";
    }

    // Wohnort1 extrahieren
    const wohnort1 = personendaten.$.Wohnort1 || "ohneWohnort";
    // Normalisierter Wohnort für den Index
    const wohnort1Normalized = normalizeWohnort(wohnort1);

    // Geschlecht extrahieren
    const geschlecht = personendaten.$.Geschlecht || "unbekannt";

    // Titel, Rufname, Vorname, Namensbestandteile und Name extrahieren
    const titel = personendaten.$.Titel || "";
    const rufname = personendaten.$.Rufname || "";
    const vorname = personendaten.$.Vorname || "";
    const namensbestandteile = personendaten.$.Namensbestandteile || "";
    const name = personendaten.$.Name || "Unbekannt";

    // Voller Name zusammensetzen
    const vollerName = formatFullName(
      titel,
      rufname,
      vorname,
      namensbestandteile,
      name
    );

    // Abgeordneter-Daten extrahieren
    const abgeordneterKey = `${titel}|${rufname}|${vorname}|${namensbestandteile}|${name}|${partei}|${wahlkreisName}|${wohnort1}`;
    let id;

    // Prüfen, ob die Person bereits eine ID hat
    if (idMap.has(abgeordneterKey)) {
      id = idMap.get(abgeordneterKey);
    } else {
      id = currentId++;
      idMap.set(abgeordneterKey, id);
    }

    const abgeordneter = {
      id,
      titel,
      rufname,
      vorname,
      namensbestandteile,
      name,
      vollerName, // Voller Name hinzufügen
      partei,
      wahlkreis: wahlkreisName,
      wohnort: wohnort1, // Original-Wohnort für Anzeige
      geschlecht,
    };

    // Nach Wahlkreis gruppieren
    if (!wahlkreise[wahlkreisNummer]) {
      wahlkreise[wahlkreisNummer] = [];
    }
    wahlkreise[wahlkreisNummer].push(abgeordneter);

    // Nach normalisiertem Wohnort gruppieren
    if (!wohnorte[wohnort1Normalized]) {
      wohnorte[wohnort1Normalized] = [];
    }
    wohnorte[wohnort1Normalized].push(abgeordneter);
  });

  // Wohnorte alphabetisch sortieren
  const sortedWohnorte = Object.keys(wohnorte)
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
    .reduce((acc, key) => {
      acc[key] = wohnorte[key];
      return acc;
    }, {});

  return { wahlkreise, wohnorte: sortedWohnorte };
}

// Hauptfunktion
async function main() {
  try {
    console.log("Lese XML-Datei ein...");
    const xmlData = fs.readFileSync(xmlFilePath, "utf8");

    console.log("Parsen der XML-Daten...");
    const parsedData = await parseXmlToJson(xmlData);

    console.log("Verarbeite Kandidaten-Daten...");
    const processedData = processKandidatenData(parsedData);

    console.log("Speichere JSON-Datei...");
    fs.writeFileSync(outputJsonPath, JSON.stringify(processedData, null, 2));
    console.log(`JSON-Datei gespeichert unter: ${outputJsonPath}`);
  } catch (error) {
    console.error("Fehler:", error.message);
  }
}

main();