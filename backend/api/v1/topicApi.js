// topicApi.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Logging-Funktion (wie in deinen anderen APIs)
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";
const logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
function log(level, message, data = null) {
  if (logLevels.indexOf(level) >= logLevels.indexOf(LOG_LEVEL)) {
    const logMessage = `[${level}] ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
}

// Hilfsfunktion zum Laden der Themen-Daten
function loadTopicsData() {
  try {
    const topicsPath = path.join(__dirname, "../../data/topics.json");
    if (!fs.existsSync(topicsPath)) {
      log("ERROR", "topics.json nicht gefunden", { path: topicsPath });
      throw new Error("topics.json nicht gefunden");
    }
    return JSON.parse(fs.readFileSync(topicsPath, "utf8"));
  } catch (error) {
    log("ERROR", "Fehler beim Laden der Themendaten", { error: error.message });
    throw error;
  }
}

// GET /api/v1/topics - Alle Topics abrufen
router.get("/topics", (req, res) => {
  try {
    const topicsData = loadTopicsData();
    log("INFO", "Topics erfolgreich geladen", { count: topicsData.topics.length });
    
    // Optional: Subtopics aus der Antwort entfernen, wenn sie nicht benötigt werden
    const topicsWithoutSubtopics = topicsData.topics.map(topic => {
      const { subtopics, ...topicWithoutSubtopics } = topic;
      return topicWithoutSubtopics;
    });
    
    res.json(topicsWithoutSubtopics);
  } catch (error) {
    log("ERROR", "Fehler beim Abrufen der Topics", { error: error.message });
    res.status(500).json({ error: "Fehler beim Abrufen der Topics: " + error.message });
  }
});

// GET /api/v1/topics/:id - Einzelnes Topic abrufen
router.get("/topics/:id", (req, res) => {
  try {
    const { id } = req.params;
    const topicsData = loadTopicsData();
    const topic = topicsData.topics.find(t => t.id === id);
    
    if (!topic) {
      log("WARN", `Topic mit ID ${id} nicht gefunden`);
      return res.status(404).json({ error: `Topic mit ID ${id} nicht gefunden` });
    }
    
    log("INFO", `Topic ${id} erfolgreich geladen`);
    res.json(topic);
  } catch (error) {
    log("ERROR", "Fehler beim Abrufen des Topics", { error: error.message });
    res.status(500).json({ error: "Fehler beim Abrufen des Topics: " + error.message });
  }
});

// GET /api/v1/topics/:id/subtopics - Alle Subtopics eines Topics abrufen
router.get("/topics/:id/subtopics", (req, res) => {
  try {
    const { id } = req.params;
    const topicsData = loadTopicsData();
    const topic = topicsData.topics.find(t => t.id === id);
    
    if (!topic) {
      log("WARN", `Topic mit ID ${id} nicht gefunden`);
      return res.status(404).json({ error: `Topic mit ID ${id} nicht gefunden` });
    }
    
    if (!topic.subtopics || topic.subtopics.length === 0) {
      log("INFO", `Keine Subtopics für Topic ${id} gefunden`);
      return res.json([]);
    }
    
    log("INFO", `Subtopics für Topic ${id} erfolgreich geladen`, { count: topic.subtopics.length });
    res.json(topic.subtopics);
  } catch (error) {
    log("ERROR", "Fehler beim Abrufen der Subtopics", { error: error.message });
    res.status(500).json({ error: "Fehler beim Abrufen der Subtopics: " + error.message });
  }
});

// GET /api/v1/subtopics/:id - Einzelnes Subtopic abrufen
router.get("/subtopics/:id", (req, res) => {
  try {
    const { id } = req.params;
    const topicsData = loadTopicsData();
    
    let foundSubtopic = null;
    
    // Suche das Subtopic in allen Topics
    for (const topic of topicsData.topics) {
      if (topic.subtopics) {
        const subtopic = topic.subtopics.find(s => s.id === id);
        if (subtopic) {
          foundSubtopic = subtopic;
          break;
        }
      }
    }
    
    if (!foundSubtopic) {
      log("WARN", `Subtopic mit ID ${id} nicht gefunden`);
      return res.status(404).json({ error: `Subtopic mit ID ${id} nicht gefunden` });
    }
    
    log("INFO", `Subtopic ${id} erfolgreich geladen`);
    res.json(foundSubtopic);
  } catch (error) {
    log("ERROR", "Fehler beim Abrufen des Subtopics", { error: error.message });
    res.status(500).json({ error: "Fehler beim Abrufen des Subtopics: " + error.message });
  }
});

module.exports = router;