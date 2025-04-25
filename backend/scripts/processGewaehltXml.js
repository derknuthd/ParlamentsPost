const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

// Pfad zur XML-Datei
const xmlFilePath = path.join(__dirname, "../data/BTW25/gewaehlte_02.xml");

// Pfad zur Ausgabe-JSON-Datei
const outputJsonPath = path.join(
  __dirname,
  "../data/BTW25/processedGewaehlt.json"
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
function formatFullName(personendaten) {
  const titel = personendaten.$.Titel ? `${personendaten.$.Titel} ` : "";
  const rufname = personendaten.$.Rufname ? `"${personendaten.$.Rufname}" ` : "";
  const vorname = personendaten.$.Vorname || "";
  const name = personendaten.$.Name || "Unbekannt";
  return `${titel}${rufname}${vorname} ${name}`.trim();
}

// Funktion, um die Daten zu verarbeiten
function processKandidatenData(parsedData) {
  const wahlkreise = {};
  const ohneWahlkreis = []; // Sammlung für Abgeordnete ohne Wahlkreis
  
  // Kandidaten Array sicherstellen
  const kandidaten = parsedData.Kandidaten.Kandidat;
  const kandidatenArray = Array.isArray(kandidaten) ? kandidaten : [kandidaten];
  
  kandidatenArray.forEach((kandidat, index) => {
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
    let wahlkreisNummer = "ohne";
    if (wahldaten.Verknuepfung && 
        wahldaten.Verknuepfung.$.Gebietsart === "WAHLKREIS") {
      wahlkreisNummer = wahldaten.Verknuepfung.$.Gebietsnummer;
    } else if (wahldaten.Direkt && 
               wahldaten.Direkt.$.Gebietsart === "WAHLKREIS") {
      wahlkreisNummer = wahldaten.Direkt.$.Gebietsnummer;
    }
    
    // Debugging-Log für jeden Kandidaten
    console.log(`Verarbeite Kandidat ${index + 1}:`, 
                personendaten.$.Name, 
                "Wahlkreis:", wahlkreisNummer, 
                "Partei:", partei);
    
    // Abgeordneter-Daten extrahieren
    const abgeordneter = {
      name: formatFullName(personendaten),
      partei,
    };
    
    // Abgeordnete ohne Wahlkreis sammeln
    if (wahlkreisNummer === "ohne") {
      ohneWahlkreis.push(abgeordneter);
    } else {
      // Abgeordnete nach Wahlkreis gruppieren
      if (!wahlkreise[wahlkreisNummer]) {
        wahlkreise[wahlkreisNummer] = [];
      }
      wahlkreise[wahlkreisNummer].push(abgeordneter);
    }
  });
  
  return { wahlkreise, ohneWahlkreis };
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