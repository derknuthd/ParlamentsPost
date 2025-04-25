require("dotenv").config(); // Lädt die .env aus dem Projekt-Root

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

// Import der API-Logik
const wahlkreisApi = require("./api/v1/wahlkreisApi");
const abgeordneteApi = require("./api/v1/abgeordneteApi");

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * ===========================
 * 1) CORS nur für definierte Domains
 * ===========================
 */
let allowedOrigins = [];
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
}

app.use(
  cors({
    origin: (origin, callback) => {
      console.log(`[DEBUG] Anfrage von Origin: ${origin}`);
      console.log(`[DEBUG] Erlaubte Ursprünge: ${allowedOrigins}`);
      if (!origin || allowedOrigins.includes(origin)) {
        console.log("[DEBUG] Origin erlaubt.");
        return callback(null, true);
      }
      console.error(`[ERROR] CORS Error: Origin ${origin} not allowed!`);
      callback(new Error(`CORS Error: Origin not allowed!`));
    },
  })
);

/**
 * ===========================
 * 2) Middleware
 * ===========================
 */
app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log("[DEBUG] Neue Anfrage:");
  console.log(`[DEBUG] Methode: ${req.method}`);
  console.log(`[DEBUG] URL: ${req.url}`);
  console.log(`[DEBUG] Headers:`, req.headers);
  console.log(`[DEBUG] Body:`, req.body);
  next();
});

console.log("[DEBUG] [server.js] Express-App und Middleware eingerichtet.");

/**
 * ===========================
 * 3) Rate-Limiter
 * ===========================
 */
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10) * 1000, // Zeitfenster in Millisekunden
  max: parseInt(process.env.RATE_LIMIT_MAX || "10", 10), // Maximale Anfragen pro Zeitfenster
  message: "Too many requests. Bitte später erneut versuchen.",
});

console.log("[DEBUG] [server.js] Rate-Limiter eingerichtet.");

/**
 * ===========================
 * 4) API-Routen
 * ===========================
 */

// Einbindung der separaten API-Routen
app.use(
  "/api/v1/:wahl/wahlkreis",
  rateLimiter,
  (req, res, next) => {
    console.log(`[DEBUG] Anfrage an /api/v1/${req.params.wahl}/wahlkreis`);
    next();
  },
  wahlkreisApi
);

app.use(
  "/api/v1/:wahl/abgeordnete",
  rateLimiter,
  (req, res, next) => {
    console.log(`[DEBUG] Anfrage an /api/v1/${req.params.wahl}/abgeordnete`);
    next();
  },
  abgeordneteApi
);

// POST /api/genai-brief
app.post("/api/genai-brief", rateLimiter, async (req, res) => {
  try {
    console.log("DEBUG: Request Body:", req.body); // Debugging

    const { userData } = req.body;
    console.log(
      "[DEBUG] [server.js] Anfrage erhalten: POST /api/genai-brief",
      userData
    );

    if (!userData || !userData.freitext) {
      return res.status(400).json({ error: "Freitext oder userData fehlt." });
    }

    const model = process.env.OPENAI_MODEL;
    const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || "1200", 10);

    const prompt = `
Du bist eine Hilfs-KI, die einen formalen Brief an einen Abgeordneten schreiben soll. 
Erstelle nur den reinen Brieftext, also den Hauptinhalt des Schreibens. 
Folgende Informationen sind bereits im Rahmen des Briefes enthalten und müssen von dir NICHT generiert werden:
- Absender
- Ort und Datum
- Empfängerinformationen
- Anrede (z. B. "Sehr geehrte/r Frau/Herr [Nachname]")
- Grußformel (z. B. "Mit freundlichen Grüßen")
- Unterschrift
- Name unter der Unterschrift

Das Rahmendokument enthält bereits die Anrede und die Grußformel. Dein Beitrag beginnt nach der Anrede und endet vor der Grußformel.

Informationen zu den Themen:
${
  Array.isArray(userData.themen)
    ? userData.themen.join(", ")
    : "Keine spezifischen Themen angegeben."
}

Freitext vom Nutzer:
${userData.freitext || "Kein zusätzlicher Freitext angegeben."}

Formuliere den Hauptinhalt des Briefes auf Basis dieser Informationen. Nutze dabei einen höflichen und respektvollen Ton, der sich für ein formales Schreiben eignet. Schreibe sachlich, prägnant und ohne Wiederholungen.
      `;

    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const generatedText =
      openaiResponse.data.choices?.[0]?.message?.content ||
      "(Konnte keinen Text generieren)";
    console.log("[DEBUG] [server.js] KI-Text generiert.");

    return res.json({ briefText: generatedText });
  } catch (error) {
    console.error(
      "[ERROR] [server.js] Fehler bei POST /api/genai-brief:",
      error
    );
    res.status(500).json({ error: "Interner Serverfehler bei KI-Abfrage" });
  }
});

// Server starten
app.listen(PORT, () => {
  console.log(`[DEBUG] [server.js] Server läuft auf Port ${PORT}`);
});
