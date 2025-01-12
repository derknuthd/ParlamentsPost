// backend/server.js
const express = require('express');
const bodyParser = require('body-parser');
const { findWahlkreisNummern } = require('./wahlkreisService');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// GET /api/wahlkreise - Gibt alle Wahlkreisnummern zurück
app.get('/api/wahlkreise', async (req, res) => {
  try {
    // Hier übergeben wir einen leeren String, um alle Wahlkreisnummern abzurufen
    const wahlkreise = await findWahlkreisNummern('');
    res.json(wahlkreise);
  } catch (error) {
    console.error('Fehler bei GET /api/wahlkreise:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/abgeordnete-by-adresse - Gibt Abgeordnete basierend auf der Adresse zurück
app.post('/api/abgeordnete-by-adresse', async (req, res) => {
  try {
    const { ort } = req.body;
    if (!ort) {
      return res.status(400).json({ error: 'Ort ist erforderlich' });
    }

    const wahlkreisNummern = await findWahlkreisNummern(ort);
    
    // Hier solltest du eine Funktion aufrufen, die Abgeordnete basierend auf den Wahlkreisnummern zurückgibt
    // Beispiel: const abgeordnete = await getAbgeordneteByWahlkreise(wahlkreisNummern);
    // Für dieses Beispiel nehmen wir an, dass eine solche Funktion existiert

    // Dummy-Daten für das Beispiel
    const abgeordnete = [
      {
        "id": "1",
        "name": "Max Mustermann",
        "partei": "SPD",
        "wkr_nummer": "001"
      },
      {
        "id": "2",
        "name": "Erika Musterfrau",
        "partei": "CDU",
        "wkr_nummer": "002"
      },
      // Weitere Abgeordnete...
    ];

    // Filtere Abgeordnete basierend auf den gefundenen Wahlkreisnummern
    const gefilterteAbgeordnete = abgeordnete.filter(abgeordneter => wahlkreisNummern.includes(abgeordneter.wkr_nummer));

    res.json(gefilterteAbgeordnete);
  } catch (error) {
    console.error('Fehler bei POST /api/abgeordnete-by-adresse:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Starte den Server
app.listen(PORT, () => {
  console.log('Express-App und Middleware eingerichtet.');
  console.log(`Server läuft auf Port ${PORT}`);
});
