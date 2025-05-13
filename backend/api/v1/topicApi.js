// topicApi.js - Optimierte Version
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Import Service-Module
const logService = require('../../services/logService');

// Hilfsfunktion zum Laden der Themen-Daten
function loadTopicsData() {
  try {
    const topicsPath = path.join(__dirname, "../../data/topics.json");
    
    if (!fs.existsSync(topicsPath)) {
      logService.error("Themendaten-Datei nicht gefunden", { path: topicsPath });
      throw new Error("Themendaten-Datei nicht gefunden");
    }
    
    const fileContent = fs.readFileSync(topicsPath, "utf8");
    return JSON.parse(fileContent);
  } catch (error) {
    logService.error("Fehler beim Laden der Themendaten", { error: error.message });
    throw error;
  }
}

// GET /api/v1/topics - Alle Topics abrufen
router.get("/topics", (req, res) => {
  try {
    const topicsData = loadTopicsData();
    logService.info("Topics erfolgreich geladen", { count: topicsData.topics.length });
    
    // Optional: Subtopics aus der Antwort entfernen, wenn sie nicht benötigt werden
    const topicsWithoutSubtopics = topicsData.topics.map(topic => {
      const { subtopics, ...topicWithoutSubtopics } = topic;
      return topicWithoutSubtopics;
    });
    
    res.json(topicsWithoutSubtopics);
  } catch (error) {
    logService.error("Fehler beim Abrufen der Topics", { error: error.message });
    res.status(500).json({ 
      error: "Datenzugriffsfehler", 
      message: "Fehler beim Abrufen der Topics." 
    });
  }
});

// GET /api/v1/topics/:id - Einzelnes Topic abrufen
router.get("/topics/:id", (req, res) => {
  try {
    const { id } = req.params;
    const topicsData = loadTopicsData();
    const topic = topicsData.topics.find(t => t.id === id);
    
    if (!topic) {
      logService.warn(`Topic mit ID ${id} nicht gefunden`);
      return res.status(404).json({ 
        error: "Nicht gefunden", 
        message: `Topic mit ID ${id} nicht gefunden` 
      });
    }
    
    logService.info(`Topic ${id} erfolgreich geladen`);
    res.json(topic);
  } catch (error) {
    logService.error("Fehler beim Abrufen des Topics", { error: error.message });
    res.status(500).json({ 
      error: "Datenzugriffsfehler", 
      message: "Fehler beim Abrufen des Topics." 
    });
  }
});

// GET /api/v1/topics/:id/subtopics - Alle Subtopics eines Topics abrufen
router.get("/topics/:id/subtopics", (req, res) => {
  try {
    const { id } = req.params;
    const topicsData = loadTopicsData();
    const topic = topicsData.topics.find(t => t.id === id);
    
    if (!topic) {
      logService.warn(`Topic mit ID ${id} nicht gefunden`);
      return res.status(404).json({ 
        error: "Nicht gefunden", 
        message: `Topic mit ID ${id} nicht gefunden` 
      });
    }
    
    if (!topic.subtopics || topic.subtopics.length === 0) {
      logService.info(`Keine Subtopics für Topic ${id} gefunden`);
      return res.json([]);
    }
    
    logService.info(`Subtopics für Topic ${id} erfolgreich geladen`, { count: topic.subtopics.length });
    res.json(topic.subtopics);
  } catch (error) {
    logService.error("Fehler beim Abrufen der Subtopics", { error: error.message });
    res.status(500).json({ 
      error: "Datenzugriffsfehler", 
      message: "Fehler beim Abrufen der Subtopics." 
    });
  }
});

module.exports = router;