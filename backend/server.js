// backend/server.js
require('dotenv').config(); // Lädt die .env aus dem Projekt-Root

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const { findWahlkreisNummern } = require('./services/wahlkreisService');
const { getFilteredAbgeordnete } = require('./services/abgeordneteService');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * ===========================
 * 1) CORS nur für definierte Domains
 * ===========================
 */
let allowedOrigins = [];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}

// Falls ALLOWED_ORIGINS fehlt, lassen wir notfalls alles durch (oder blocken alles, je nach Wunsch)
app.use(cors({
  origin: (origin, callback) => {
    // Kein Origin? (z.B. Postman) -> Erlauben
    if (!origin) return callback(null, true);

    // Wenn in .env-Liste -> erlauben
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Sonst blocken
    callback(new Error(`CORS Error: Origin ${origin} not allowed!`));
  }
}));

/**
 * ===========================
 * 2) Rate-Limiter konfigurieren
 * ===========================
 * Steht in .env:
 * RATE_LIMIT_WINDOW_SECONDS=60
 * RATE_LIMIT_MAX=3
 */
const windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10);
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '3', 10);

const genAiLimiter = rateLimit({
  windowMs: windowSeconds * 1000, // z.B. 60 Sekunden
  max: maxRequests,               // z.B. 3 Requests pro Fenster
  message: 'Too many requests. Bitte später erneut versuchen.'
});

// Middleware
app.use(bodyParser.json());

console.log('[DEBUG] [server.js] Express-App und Middleware eingerichtet.');

// GET /api/wahlkreise
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

// POST /api/abgeordnete-by-adresse
app.post('/api/abgeordnete-by-adresse', async (req, res) => {
  try {
    console.log('[DEBUG] [server.js] Anfrage erhalten: POST /api/abgeordnete-by-adresse');
    const { ort } = req.body;

    if (!ort) {
      console.warn('[WARN] [server.js] Kein Ort angegeben.');
      return res.status(400).json({ error: 'Ort ist erforderlich' });
    }

    const wahlkreisNummern = await findWahlkreisNummern(ort);
    if (wahlkreisNummern.length === 0) {
      console.warn(`[WARN] [server.js] Kein Wahlkreis für Ort "${ort}" gefunden.`);
      return res.status(404).json({ error: 'Kein Wahlkreis für die angegebene Adresse gefunden' });
    }

    const abgeordnete = await getFilteredAbgeordnete(wahlkreisNummern);
    console.log(`[DEBUG] [server.js] Anzahl der gefundenen Abgeordneten: ${abgeordnete.length}`);
    res.json(abgeordnete);
  } catch (error) {
    console.error('[ERROR] [server.js] Fehler bei POST /api/abgeordnete-by-adresse:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

/**
 * ===========================
 * 3) POST /api/genai-brief
 * ===========================
 * - mit Rate-Limiter
 * - mit Modell und max_tokens aus .env
 */
app.post('/api/genai-brief', genAiLimiter, async (req, res) => {
  try {
    const { userData } = req.body;
    console.log('[DEBUG] [server.js] Anfrage erhalten: POST /api/genai-brief', userData);

    if (!userData || !userData.freitext) {
      return res.status(400).json({ error: 'Freitext oder userData fehlt.' });
    }

    // Modell aus .env
    const model = process.env.OPENAI_MODEL;
    // max_tokens aus .env (Default: 1200)
    const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '1200', 10);

    // Prompt
    const prompt = `
Du bist eine Hilfs-KI, die einen Brief an einen Abgeordneten schreiben soll.
Themen: ${Array.isArray(userData.themen) ? userData.themen.join(', ') : 'Keine'}
Abgeordneter: ${userData.abgeordneteName || 'Unbekannt'}

Freitext vom Nutzer:
${userData.freitext}

Formuliere einen höflichen Brief mit diesen Infos.
Achte auf eine formale, aber respektvolle Anrede.
`;

    // OpenAI-Aufruf
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,  // Aus .env
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedText = openaiResponse.data.choices?.[0]?.message?.content || '(Konnte keinen Text generieren)';
    console.log('[DEBUG] [server.js] KI-Text generiert.');

    return res.json({ briefText: generatedText });
  } catch (error) {
    console.error('[ERROR] [server.js] Fehler bei POST /api/genai-brief:', error);
    res.status(500).json({ error: 'Interner Serverfehler bei KI-Abfrage' });
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`[DEBUG] [server.js] Server läuft auf Port ${PORT}`);
});
