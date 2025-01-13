const express = require('express');
const bodyParser = require('body-parser');
const { findWahlkreisNummern } = require('./wahlkreisService');
const { getFilteredAbgeordnete } = require('./abgeordneteService');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

console.log('[DEBUG] [server.js] Express-App und Middleware eingerichtet.');

// GET /api/wahlkreise - Gibt alle Wahlkreisnummern zurück
app.get('/api/wahlkreise', async (req, res) => {
  try {
    console.log('[DEBUG] [server.js] Anfrage erhalten: GET /api/wahlkreise');
    const wahlkreise = await findWahlkreisNummern('');
    console.log(`[DEBUG] [server.js] Gefundene Wahlkreise: ${wahlkreise.length}`);
    res.json(wahlkreise);
  } catch (error) {
    console.error('[ERROR] [server.js] Fehler bei GET /api/wahlkreise:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/abgeordnete-by-adresse - Gibt Abgeordnete basierend auf der Adresse zurück
app.post('/api/abgeordnete-by-adresse', async (req, res) => {
  try {
    console.log('[DEBUG] [server.js] Anfrage erhalten: POST /api/abgeordnete-by-adresse');
    const { ort } = req.body;

    if (!ort) {
      console.warn('[WARN] [server.js] Kein Ort angegeben.');
      return res.status(400).json({ error: 'Ort ist erforderlich' });
    }

    console.log(`[DEBUG] [server.js] Suche Wahlkreisnummern für Ort: ${ort}`);
    const wahlkreisNummern = await findWahlkreisNummern(ort);

    if (wahlkreisNummern.length === 0) {
      console.warn(`[WARN] [server.js] Kein Wahlkreis für Ort "${ort}" gefunden.`);
      return res.status(404).json({ error: 'Kein Wahlkreis für die angegebene Adresse gefunden' });
    }

    console.log(`[DEBUG] [server.js] Gefundene Wahlkreisnummern: ${wahlkreisNummern.join(', ')}`);
    const abgeordnete = await getFilteredAbgeordnete(wahlkreisNummern);

    console.log(`[DEBUG] [server.js] Anzahl der gefundenen Abgeordneten: ${abgeordnete.length}`);
    res.json(abgeordnete);
  } catch (error) {
    console.error('[ERROR] [server.js] Fehler bei POST /api/abgeordnete-by-adresse:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// Starte den Server
app.listen(PORT, () => {
  console.log(`[DEBUG] [server.js] Server läuft auf Port ${PORT}`);
});
