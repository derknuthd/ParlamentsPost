require("dotenv").config(); // Lädt die .env aus dem Projekt-Root

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

// Import der API-Logik aus wahlkreisApi.js
const wahlkreisApi = require("./api/v1/wahlkreisApi");

const { getFilteredAbgeordnete } = require("./services/abgeordneteService");

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
      if (!origin)
        return callback(new Error(`CORS Error: Origin not allowed!`));
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS Error: Origin ${origin} not allowed!`));
    },
  })
);

/**
 * ===========================
 * 2) Middleware
 * ===========================
 */
app.use(bodyParser.json());

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

// Neue Route: /api/v1/:wahl/wahlkreis
// Die Logik wird aus wahlkreisApi.js eingebunden
app.use("/api/v1/:wahl/wahlkreis", rateLimiter, wahlkreisApi);

// POST /api/abgeordnete-by-adresse
app.post("/api/abgeordnete-by-adresse", rateLimiter, async (req, res) => {
  try {
    console.log(
      "[DEBUG] [server.js] Anfrage erhalten: POST /api/abgeordnete-by-adresse"
    );
    const { ort } = req.body;

    if (!ort) {
      console.warn("[WARN] [server.js] Kein Ort angegeben.");
      return res.status(400).json({ error: "Ort ist erforderlich" });
    }

    // Standardwahl auf BTW25 setzen
    const wahl = "BTW25";

    // Funktionalität aus wahlkreisApi.js direkt nutzen
    const gemeindeIndexPath = `./data/${wahl}/gemeindeIndex.json`;
    const fs = require("fs");
    const path = require("path");

    if (!fs.existsSync(path.join(__dirname, gemeindeIndexPath))) {
      console.warn(
        `[WARN] [server.js] Datei nicht gefunden: ${gemeindeIndexPath}`
      );
      return res
        .status(404)
        .json({ error: `Daten für die Wahl "${wahl}" nicht gefunden.` });
    }

    const rawData = fs.readFileSync(
      path.join(__dirname, gemeindeIndexPath),
      "utf8"
    );
    const gemeindeIndex = JSON.parse(rawData).gemeindeIndex;

    const normalizedWohnort = ort.trim().toLowerCase();
    const result = gemeindeIndex[normalizedWohnort];

    if (!result || !result.wahlkreisNr) {
      console.warn(
        `[WARN] [server.js] Kein Wahlkreis für Ort "${ort}" gefunden.`
      );
      return res
        .status(404)
        .json({ error: "Kein Wahlkreis für die angegebene Adresse gefunden" });
    }

    const wahlkreisNummern = [result.wahlkreisNr];

    // Abgeordnete basierend auf den Wahlkreisnummern filtern
    const abgeordnete = await getFilteredAbgeordnete(wahlkreisNummern);
    console.log(
      `[DEBUG] [server.js] Anzahl der gefundenen Abgeordneten: ${abgeordnete.length}`
    );
    res.json(abgeordnete);
  } catch (error) {
    console.error(
      "[ERROR] [server.js] Fehler bei POST /api/abgeordnete-by-adresse:",
      error
    );
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

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

//
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
