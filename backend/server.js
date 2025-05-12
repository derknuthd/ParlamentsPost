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
const rateLimiter = require('./services/rateLimitService');

console.log("[DEBUG] [server.js] Rate-Limiter eingerichtet.");

/**
 * ===========================
 * 4) API-Routen mit datenschutzfreundlichem Rate-Limiter
 * ===========================
 */

// Standard-Rate-Limiting-Middleware für alle API-Anfragen außer KI
app.use("/api/v1", (req, res, next) => {
  // KI-Endpunkte ausschließen, diese werden separat limitiert
  if (req.path === '/genai-brief') {
    return next();
  }
  
  if (!rateLimiter.isAllowed(req)) {
    console.log("[WARN] Standard Rate-Limit erreicht");
    return res.status(429).json({ 
      error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut."
    });
  }
  
  next();
}, wahlkreisApi, abgeordneteApi, topicApi);

// Spezielles Rate-Limiting für KI-Anfragen
app.use("/api/v1", (req, res, next) => {
  if (req.path === '/genai-brief' && !rateLimiter.isAllowed(req, true)) {
    console.log("[WARN] AI Rate-Limit erreicht");
    return res.status(429).json({ 
      error: "Zu viele KI-Anfragen. Bitte versuchen Sie es in einigen Minuten erneut."
    });
  }
  
  next();
}, genaiApi);



// Server starten
app.listen(PORT, () => {
  console.log(`[DEBUG] [server.js] Server läuft auf Port ${PORT}`);
});