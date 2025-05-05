// server.js
require("dotenv").config(); // Lädt die .env aus dem Projekt-Root

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

// Import der API-Logik
const wahlkreisApi = require("./api/v1/wahlkreisApi");
const abgeordneteApi = require("./api/v1/abgeordneteApi");
const topicApi = require("./api/v1/topicApi");
const genaiApi = require("./api/v1/genaiApi");

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
 * 3) Zentrale Rate-Limiter-Definitionen
 * ===========================
 */
const rateLimiters = {
  // Standard-Limiter für reguläre API-Anfragen
  standard: rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10) * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || "20", 10),
    message: "Too many requests. Bitte später erneut versuchen.",
    keyGenerator: (req) => req.ip + '_standard'
  }),
  
  // Spezifischer Limiter für KI-Anfragen
  ai: rateLimit({
    windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS || "300", 10) * 1000,
    max: parseInt(process.env.AI_RATE_LIMIT_MAX || "5", 10),
    message: "Zu viele KI-Anfragen. Bitte warten Sie einige Minuten.",
    keyGenerator: (req) => req.ip + '_ai'
  })
};

console.log("[DEBUG] [server.js] Rate-Limiter eingerichtet.");

/**
 * ===========================
 * 4) API-Routen mit spezifischen Rate-Limitern
 * ===========================
 */

// Standard-APIs mit Standard-Rate-Limiter
app.use("/api/v1", rateLimiters.standard, wahlkreisApi);
app.use("/api/v1", rateLimiters.standard, abgeordneteApi);
app.use("/api/v1", rateLimiters.standard, topicApi);

// KI-API mit speziellem Rate-Limiter
app.use("/api/v1", rateLimiters.ai, genaiApi);

// Server starten
app.listen(PORT, () => {
  console.log(`[DEBUG] [server.js] Server läuft auf Port ${PORT}`);
});