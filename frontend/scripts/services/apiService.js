import { cacheService } from './cacheService.js';
import { notificationService } from './notificationService.js';
import { logService } from './logService.js';

export const apiService = {
  // Status-Eigenschaften
  isOnline: navigator.onLine,
  rateLimits: {
    standard: { remaining: null, reset: null, limit: null },
    ai: { remaining: null, reset: null, limit: null }
  },
  
  // Initialisierung
  init() {
    // Online/Offline-Events überwachen
    window.addEventListener('online', () => {
      this.isOnline = true;
      logService.log("INFO", "Netzwerkverbindung wiederhergestellt");
      notificationService.showNotification(
        "Netzwerkverbindung wiederhergestellt", 
        "success"
      );
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logService.log("WARN", "Netzwerkverbindung verloren");
      notificationService.showNotification(
        "Sie sind offline. Die App verwendet zwischengespeicherte Daten.", 
        "warning", 
        8000
      );
    });
  },
  
  // Rate-Limit-Header auswerten
  updateRateLimits(response, type = 'standard') {
    if (!response || !response.headers) return;
    
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    const limit = response.headers.get('X-RateLimit-Limit');
    
    if (remaining) this.rateLimits[type].remaining = parseInt(remaining, 10);
    if (reset) this.rateLimits[type].reset = parseInt(reset, 10);
    if (limit) this.rateLimits[type].limit = parseInt(limit, 10);
    
    // Wenn wir fast am Limit sind, zeige Warnung
    if (this.rateLimits[type].remaining !== null && this.rateLimits[type].remaining < 5) {
      notificationService.showNotification(
        `Fast am API-Limit (${type}): ${this.rateLimits[type].remaining} Anfragen übrig.`, 
        'warning'
      );
    }
  },
  
  // API-Aufruf mit Offline-Unterstützung und Caching
  async fetchWithOfflineSupport(url, options = {}, getCacheFn, setCacheFn) {
    // Prüfen, ob Daten im Cache verfügbar sind
    if (getCacheFn) {
      const cachedData = getCacheFn();
      if (cachedData) {
        // Im Offline-Modus müssen wir den Cache verwenden
        if (!this.isOnline) {
          logService.log("INFO", `Offline-Modus: Daten aus Cache für ${url}`);
          return { 
            ok: true, 
            json: () => Promise.resolve(cachedData),
            _fromCache: true // Markierung hinzufügen
          };
        } else {
          // Im Online-Modus prüfen wir auch, ob wir den Cache verwenden können
          logService.log("INFO", `Daten aus Cache für ${url} geladen`);
          
          // Starte eine Hintergrundaktualisierung
          this.updateCacheInBackground(url, options, setCacheFn);
          
          // Gib die Daten aus dem Cache zurück
          return { 
            ok: true, 
            json: () => Promise.resolve(cachedData),
            _fromCache: true
          };
        }
      } else if (!this.isOnline) {
        // Wenn offline und keine Cache-Daten verfügbar
        throw new Error("Keine Netzwerkverbindung und keine Cache-Daten verfügbar");
      }
    }
    
    // Normal fortfahren, wenn online und keine Cache-Daten vorhanden sind
    try {
      const response = await fetch(url, options);
      
      // Rate-Limit-Auswertung
      const isAiRequest = url.includes('/genai-brief');
      this.updateRateLimits(response, isAiRequest ? 'ai' : 'standard');
      
      // Bei Erfolg und wenn Cache-Funktion verfügbar, Ergebnis cachen
      if (response.ok && setCacheFn) {
        const data = await response.clone().json();
        setCacheFn(data);
      }
      return response;
    } catch (error) {
      // Bei Netzwerkfehlern prüfen, ob Cache verfügbar
      if (getCacheFn) {
        const cachedData = getCacheFn();
        if (cachedData) {
          logService.log("INFO", `Netzwerkfehler: Fallback auf Cache-Daten für ${url}`);
          return { 
            ok: true, 
            json: () => Promise.resolve(cachedData),
            _fromCache: true
          };
        }
      }
      throw error;
    }
  },
  
  // Cache im Hintergrund aktualisieren
  async updateCacheInBackground(url, options, setCacheFn) {
    if (!this.isOnline || !setCacheFn) return;
    
    try {
      fetch(url, options)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error("Fehler bei der Hintergrundaktualisierung");
        })
        .then(data => {
          setCacheFn(data);
          logService.log("INFO", `Cache für ${url} im Hintergrund aktualisiert`);
        })
        .catch(error => {
          logService.log("WARN", `Cache-Hintergrundaktualisierung für ${url} fehlgeschlagen`, 
            { error: error.message }
          );
        });
    } catch (error) {
      logService.log("WARN", `Fehler beim Starten der Hintergrundaktualisierung für ${url}`, 
        { error: error.message }
      );
    }
  },
  
  // Spezifische API-Aufrufe
  
  // Topics abrufen
  async getTopics() {
    try {
      const response = await this.fetchWithOfflineSupport(
        "/api/v1/topics",
        {},
        () => cacheService.getTopicsCache(),
        (data) => cacheService.setTopicsCache(data)
      );
      
      if (!response.ok && !response._fromCache) {
        throw new Error("Fehler beim Laden der Topics");
      }
      
      return await response.json();
    } catch (error) {
      logService.log("ERROR", "Fehler beim Abrufen der Topics", {
        message: error.message
      });
      throw error;
    }
  },
  
  // Einzelnes Topic abrufen
  async getTopic(topicId) {
    try {
      const response = await this.fetchWithOfflineSupport(
        `/api/v1/topics/${topicId}`,
        {},
        () => cacheService.getTopicCache(topicId),
        (data) => cacheService.setTopicCache(topicId, data)
      );
      
      if (!response.ok && !response._fromCache) {
        throw new Error(`Fehler beim Laden des Topics ${topicId}`);
      }
      
      return await response.json();
    } catch (error) {
      logService.log("ERROR", `Fehler beim Abrufen des Topics ${topicId}`, {
        message: error.message
      });
      throw error;
    }
  },
  
  // Subtopics abrufen
  async getSubtopics(topicId) {
    try {
      const response = await this.fetchWithOfflineSupport(
        `/api/v1/topics/${topicId}/subtopics`,
        {},
        () => cacheService.getSubtopicsCache(topicId),
        (data) => cacheService.setSubtopicsCache(topicId, data)
      );
      
      if (!response.ok && !response._fromCache) {
        throw new Error(`Fehler beim Laden der Subtopics für ${topicId}`);
      }
      
      return await response.json();
    } catch (error) {
      logService.log("ERROR", `Fehler beim Abrufen der Subtopics für ${topicId}`, {
        message: error.message
      });
      throw error;
    }
  },
  
  // Abgeordnete basierend auf Wohnort abrufen
  async getAbgeordnete(ort) {
    if (!ort || !ort.trim()) {
      throw new Error("Kein Wohnort angegeben");
    }
    
    try {
      // Zuerst versuchen, Wahlkreisdaten zu bekommen
      const wahlkreisResponse = await fetch(`/api/v1/BTW25/wahlkreis?wohnort=${encodeURIComponent(ort.trim())}`);
      
      if (!wahlkreisResponse.ok) {
        throw new Error("Fehler beim Abrufen des Wahlkreises");
      }
      
      const wahlkreisData = await wahlkreisResponse.json();
      const wahlkreise = Array.isArray(wahlkreisData) ? wahlkreisData : [wahlkreisData];
      
      // Abgeordnete für jeden Wahlkreis abrufen und zusammenführen
      let alleAbgeordnete = [];
      
      for (const wahlkreis of wahlkreise) {
        if (!wahlkreis.wahlkreisNr) continue;
        
        // Abgeordneten-Anfrage mit Cache-Unterstützung
        const abgeordneteUrl = `/api/v1/BTW25/abgeordnete?wahlkreis=${wahlkreis.wahlkreisNr}&wohnort=${encodeURIComponent(wahlkreis.wohnort || ort)}`;
        
        try {
          const abgeordneteResponse = await fetch(abgeordneteUrl);
          
          if (abgeordneteResponse.ok) {
            const abgeordnete = await abgeordneteResponse.json();
            
            // Wahlkreisbezeichnung hinzufügen
            const abgeordneteMitWKB = abgeordnete.map(abg => ({
              ...abg,
              wkr_bezeichnung: wahlkreis.wahlkreisBez || "Unbekannter Wahlkreis"
            }));
            
            alleAbgeordnete = [...alleAbgeordnete, ...abgeordneteMitWKB];
          }
        } catch (error) {
          logService.log("WARN", `Fehler beim Abrufen der Abgeordneten für Wahlkreis ${wahlkreis.wahlkreisNr}`, {
            error: error.message
          });
        }
      }
      
      // Deduplizieren der Abgeordneten basierend auf der ID
      const uniqueAbgeordnete = Array.from(
        new Map(alleAbgeordnete.map(item => [item.id, item])).values()
      );
      
      // Im Cache speichern
      cacheService.setAbgeordneteCache(ort, uniqueAbgeordnete);
      
      return uniqueAbgeordnete;
    } catch (error) {
      // Wenn die API-Anfrage fehlschlägt, versuchen wir Daten aus dem Cache zu laden
      const cachedAbgeordnete = cacheService.getAbgeordneteCache(ort);
      
      if (cachedAbgeordnete && cachedAbgeordnete.length > 0) {
        logService.log("INFO", "Verwende Cache-Daten nach fehlgeschlagener API-Anfrage", {
          ort, count: cachedAbgeordnete.length
        });
        return cachedAbgeordnete;
      }
      
      // Wenn keine Cache-Daten verfügbar sind, den Fehler weiterleiten
      logService.log("ERROR", "Fehler beim Abrufen der Abgeordneten", {
        message: error.message
      });
      throw error;
    }
  },
  
  // KI-Brief generieren
  async generateAiBrief(userData) {
    try {
      const response = await fetch("/api/v1/genai-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userData })
      });
      
      // Rate-Limit-Auswertung für AI-Anfragen
      this.updateRateLimits(response, 'ai');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler bei der KI-Generierung");
      }
      
      return await response.json();
    } catch (error) {
      logService.log("ERROR", "Fehler bei der KI-Briefgenerierung", {
        message: error.message
      });
      throw error;
    }
  }
};