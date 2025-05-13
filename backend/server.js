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

// Import Service-Module
const logService = require('./services/logService');

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
      logService.debug(`Anfrage von Origin: ${origin}`);
      logService.debug(`Erlaubte Ursprünge: ${allowedOrigins}`);
      if (!origin || allowedOrigins.includes(origin)) {
        logService.debug("Origin erlaubt.");
        return callback(null, true);
      }
      logService.error(`CORS Error: Origin ${origin} not allowed!`);
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
  logService.debug("Neue Anfrage:");
  logService.debug(`Methode: ${req.method}`, req.method);
  logService.debug(`URL: ${req.url}`, req.url);
  logService.debug(`Headers:`, req.headers);
  logService.debug(`Body:`, req.body);
  next();
});

logService.debug("[server.js] Express-App und Middleware eingerichtet.");

/**
 * ===========================
 * 3) Zentrale Rate-Limiter-Definitionen
 * ===========================
 */
const rateLimiter = require('./services/rateLimitService');

logService.debug("[server.js] Rate-Limiter eingerichtet.");

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
  
  const result = rateLimiter.isAllowed(req);
  
  // Wenn eine Warnung ausgegeben werden soll
  if (result.warning) {
    res.setHeader('X-RateLimit-Warning', result.message);
    logService.debug("Rate-Limit-Warning Header gesetzt:", result.message);
  }
  
  // Wenn nicht erlaubt
  if (!result.allowed) {
    logService.warn("Standard Rate-Limit erreicht");
    return res.status(429).json({ 
      error: result.message,
      resetTimeSeconds: result.resetTimeSeconds
    });
  }
  
  next();
}, wahlkreisApi, abgeordneteApi, topicApi);

// Spezielles Rate-Limiting für KI-Anfragen
app.use("/api/v1", (req, res, next) => {
  if (req.path === '/genai-brief') {
    const result = rateLimiter.isAllowed(req, true);
    
    // Wenn eine Warnung ausgegeben werden soll
    if (result.warning) {
      res.setHeader('X-RateLimit-Warning', result.message);
    }
    
    // Wenn nicht erlaubt
    if (!result.allowed) {
      logService.warn("AI Rate-Limit erreicht");
      return res.status(429).json({ 
        error: result.message,
        resetTimeSeconds: result.resetTimeSeconds
      });
    }
  }
  
  next();
}, genaiApi);

// Server starten
app.listen(PORT, () => {
  logService.debug(`[server.js] Server läuft auf Port ${PORT}`);
});