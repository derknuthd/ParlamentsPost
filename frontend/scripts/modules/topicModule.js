// topicModule.js
import { logService } from '../services/logService.js';
import { apiService } from '../services/apiService.js';
import { cacheService } from '../services/cacheService.js';
import { notificationService } from '../services/notificationService.js';

export function topicModule() {
  return {
    // Topic-System
    topic: "afd_parteiverbotsverfahren", // Standard-Topic
    topics: [],
    topicData: null,
    availableSubtopics: [],
    
    // Themen und Freitext
    themen: [],
    freitext: "",
    
    // Cache-Status-Indikatoren
    topicLoadedFromCache: false,
    subtopicsLoadedFromCache: false,
    
    // Topic auswählen und zugehörige Subtopics laden
    async waehleTopic(topicId) {
      if (this.topic === topicId) return; // Keine Änderung, wenn gleiches Topic
      
      this.topic = topicId;
      logService.info(`Topic gewechselt zu ${topicId}`);
      
      // Themen zurücksetzen, da wir neue Subtopics laden werden
      this.themen = [];
      
      // Subtopics für das neue Topic laden
      await this.loadSubtopics();
      
      // Nach dem Laden der Subtopics zum Formular scrollen
      setTimeout(() => {
        const formElement = document.getElementById("user-form");
        if (formElement) {
          formElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    },
    
    // Topics im Hintergrund laden
    async loadInitialDataInBackground() {
      try {
        // Cache für Topics überprüfen
        const cachedTopics = cacheService.getTopicsCache();
        if (cachedTopics) {
          this.topics = cachedTopics;
          this.topicLoadedFromCache = true;
          logService.info("Topics aus Cache für initiale Anzeige geladen", { count: cachedTopics.length });
          
          // Wenn ein Topic gesetzt ist, sofort auch die Topic-Daten und Subtopics laden
          if (this.topic) {
            // Zuerst versuchen, das vollständige Topic zu laden
            try {
              const topicData = await apiService.getTopic(this.topic);
              this.topicData = topicData;
              logService.info("Topic-Daten initial geladen", { 
                topicId: this.topic,
                fromCache: topicData._fromCache === true
              });
              console.log("Initial geladene Topic-Daten:", this.topicData);
              
              // Dann Subtopics laden
              const cachedSubtopics = cacheService.getSubtopicsCache(this.topic);
              if (cachedSubtopics) {
                this.availableSubtopics = cachedSubtopics;
                this.subtopicsLoadedFromCache = true;
                logService.info("Subtopics aus Cache für initiale Anzeige geladen", { count: cachedSubtopics.length });
              } else {
                // Wenn keine Subtopics im Cache, direkt laden
                const subtopics = await apiService.getSubtopics(this.topic);
                this.availableSubtopics = subtopics;
                logService.info("Subtopics initial geladen", { count: subtopics.length });
              }
            } catch (error) {
              logService.warn("Fehler beim initialen Laden der Topic-Daten", { 
                error: error.message,
                topicId: this.topic
              });
            }
          }
          
          // Im Hintergrund aktualisieren, wenn online
          if (apiService.isOnline) {
            this.updateTopicsInBackground();
          }
        } else {
          // Wenn kein Cache vorhanden, dann Topics laden, aber ohne Ladeindikator
          try {
            const topics = await apiService.getTopics();
            this.topics = topics;
            
            // Wenn topics vorhanden, erstes Topic setzen und Topic-Daten und Subtopics laden
            if (topics && topics.length > 0) {
              if (!this.topic) {
                this.topic = topics[0].id;
              }
              
              // Vollständige Topic-Daten laden
              try {
                const topicData = await apiService.getTopic(this.topic);
                this.topicData = topicData;
                logService.info("Topic-Daten initial geladen", { topicId: this.topic });
                console.log("Initial geladene Topic-Daten:", this.topicData);
                
                // Subtopics im Hintergrund laden
                const subtopics = await apiService.getSubtopics(this.topic);
                this.availableSubtopics = subtopics;
                logService.info("Subtopics initial geladen", { count: subtopics.length });
              } catch (error) {
                logService.warn("Fehler beim initialen Laden der Topic-Daten", { error: error.message });
              }
            }
          } catch (error) {
            logService.warn("Fehler beim initialen Laden der Topics", { error: error.message });
          }
        }
      } catch (error) {
        logService.warn("Fehler beim Laden der initialen Daten", { error: error.message });
      }
    },
    
    // Topics im Hintergrund aktualisieren
    async updateTopicsInBackground() {
      if (!apiService.isOnline) return;
      
      try {
        // Topics im Hintergrund aktualisieren
        const topics = await apiService.getTopics();
        this.topics = topics;
        
        // Wenn ein Topic ausgewählt ist, auch Subtopics aktualisieren
        if (this.topic) {
          const subtopics = await apiService.getSubtopics(this.topic);
          this.availableSubtopics = subtopics;
        }
      } catch (error) {
        // Fehler hier ignorieren, da es nur eine Hintergrundaktualisierung ist
        logService.warn("Fehler bei der Hintergrundaktualisierung", { error: error.message });
      }
    },
    
    // Subtopics laden
    async loadSubtopics() {
      this.isLoading = true;
      this.subtopicsLoadedFromCache = false;
      
      try {
        // Sicherheitscheck - ist ein Topic ausgewählt?
        if (!this.topic) {
          this.availableSubtopics = [];
          return [];
        }
        
        // Topic-Daten laden, falls nicht vorhanden oder wenn sich das Topic geändert hat
        if (!this.topicData || this.topicData.id !== this.topic) {
          try {
            const topicData = await apiService.getTopic(this.topic);
            this.topicData = topicData;
            
            // Setze Cache-Status
            this.topicLoadedFromCache = topicData._fromCache === true;
          } catch (error) {
            logService.error(`Fehler beim Laden des Topics ${this.topic}`, { message: error.message });
            notificationService.showNotification(
              `Fehler beim Laden des Topics: ${error.message}`,
              "error"
            );
            return [];
          }
        }
        
        try {
          // Subtopics laden
          const subtopics = await apiService.getSubtopics(this.topic);
          this.availableSubtopics = subtopics;
          this.themen = []; // Setze themen zurück, da wir neue Subtopics haben
          
          // Setze Cache-Status
          this.subtopicsLoadedFromCache = subtopics._fromCache === true;
          
          return subtopics;
        } catch (error) {
          logService.error("Fehler beim Laden der Subtopics", { message: error.message });
          
          // Benachrichtigung nur zeigen, wenn keine Daten verfügbar sind
          if (!this.availableSubtopics || this.availableSubtopics.length === 0) {
            notificationService.showNotification(
              `Fehler beim Laden der Subtopics: ${error.message}`,
              "error"
            );
          }
          
          return this.availableSubtopics || [];
        }
      } finally {
        this.isLoading = false;
      }
    }
  };
}