import { cacheService } from './cacheService.js';
import { notificationService } from './notificationService.js';
import { logService } from './logService.js';
import eventBus from './eventBus.js';

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
      // Über den eventBus veröffentlichen
      eventBus.publish('online-status-change', { isOnline: true });
      
      logService.log("INFO", "Netzwerkverbindung wiederhergestellt");
      notificationService.showNotification(
        "Netzwerkverbindung wiederhergestellt", 
        "success"
      );
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      // Über den eventBus veröffentlichen
      eventBus.publish('online-status-change', { isOnline: false });
      
      logService.log("WARN", "Netzwerkverbindung verloren");
      notificationService.showNotification(
        "Sie sind offline. Die App verwendet zwischengespeicherte Daten.", 
        "warning", 
        8000
      );
    });

    // // Test-Benachrichtigung nur in der Entwicklungsumgebung
    // if (import.meta.env?.DEV) {
    //   setTimeout(() => {
    //       notificationService.showNotification(
    //       "Test-Benachrichtigung - Prüfung des Benachrichtigungssystems",
    //       "warning",
    //       10000
    //       );
    //       console.log("Test-Benachrichtigung wurde gesendet");
    //   }, 3000); // Verzögerung von 3 Sekunden nach Initialisierung
    // }
  },

  // Hilfsfunktion zum Extrahieren des Pfads aus URLs (funktioniert auch mit relativen URLs)
  getPathFromUrl(url) {
    // Einfache Pfadextraktion ohne URL-Konstruktor
    // Entferne Query-Parameter und Hash
    const pathWithoutQuery = url.split('?')[0].split('#')[0];
    
    // Behandlung relativer URLs
    if (pathWithoutQuery.startsWith('/')) {
      return pathWithoutQuery;
    }
    
    // Entferne Protokoll und Host bei absoluten URLs
    try {
      const urlParts = pathWithoutQuery.split('/');
      // Wenn die URL ein Protokoll enthält (http:// oder https://)
      if (urlParts[0].includes(':')) {
        return '/' + urlParts.slice(3).join('/');
      }
      // Einfacher Fall ohne Protokoll
      return '/' + urlParts.slice(1).join('/');
    } catch (error) {
      // Fallback: Gib einfach die URL ohne Queryparameter zurück
      return pathWithoutQuery;
    }
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
      const typeLabel = type === 'ai' ? 'KI' : 'API';
      notificationService.showNotification(
        `Fast am ${typeLabel}-Limit: ${this.rateLimits[type].remaining} Anfragen übrig.`, 
        'warning'
      );
    }
  },
  
// Verbesserte checkRateLimitHeaders-Funktion
checkRateLimitHeaders(response, context = '', isAiRequest = false) {
    const warning = response.headers.get('X-RateLimit-Warning');
    if (warning) {
    const typeLabel = isAiRequest ? 'KI' : 'Standard';
    const formattedContext = context ? ` (${context})` : '';
    logService.log("WARN", `${typeLabel}-Rate-Limit-Warnung${formattedContext}:`, warning);
    
    // Nur eine Benachrichtigung anzeigen (keine Fehlerbehandlung auslösen)
    notificationService.showNotification(warning, "warning", 8000);
    
    // Wichtig: Wir geben true zurück, wenn ein Warning-Header gefunden wurde,
    // aber wir lösen KEINEN Fehler aus - die Anfrage sollte weiterlaufen
    return true;
    }
    return false;
},
  
// Verbesserte fetchWithOfflineSupport-Funktion
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
            _fromCache: true
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
    
    // Auf Warnungen prüfen - WICHTIG: Wir reagieren auf die Warnung, aber brechen nicht ab
    const pathContext = this.getPathFromUrl(url);
    this.checkRateLimitHeaders(response, pathContext, isAiRequest);
    
    // Auf Rate-Limit-Fehler prüfen - NUR bei 429 Status-Code
    // Das ist der wirkliche Fehler, keine bloße Warnung
    if (response.status === 429) {
        const errorData = await response.json();
        const typeLabel = isAiRequest ? 'KI' : 'API';
        const message = errorData.error || `Zu viele ${typeLabel}-Anfragen. Bitte später erneut versuchen.`;
        notificationService.showNotification(message, "error", 10000);
        throw new Error(message);
    }
    
    // WICHTIG: Wir prüfen response.ok NACH der Warnung
    // Bei einer 80%-Warnung ist response.ok immer noch true
    if (!response.ok) {
        // Bei anderen Fehlern (nicht 429) versuchen wir, die Fehlermeldung zu extrahieren
        try {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP-Fehler: ${response.status}`);
        } catch (jsonError) {
        // Falls keine JSON-Daten vorhanden sind
        throw new Error(`HTTP-Fehler: ${response.status}`);
        }
    }
    
    // Bei Erfolg und wenn Cache-Funktion verfügbar, Ergebnis cachen
    if (setCacheFn) {
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
          // Auch im Hintergrund Rate-Limit-Header prüfen
          const isAiRequest = url.includes('/genai-brief');
          const pathContext = this.getPathFromUrl(url);
          this.checkRateLimitHeaders(response, `Hintergrund: ${pathContext}`, isAiRequest);
          
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
  
  // Wahlkreis abrufen
  async getWahlkreis(wohnort) {
    try {
      const response = await this.fetchWithOfflineSupport(
        `/api/v1/BTW25/wahlkreis?wohnort=${encodeURIComponent(wohnort.trim())}`,
        {},
        () => cacheService.getWahlkreisCache(wohnort),
        (data) => cacheService.setWahlkreisCache(wohnort, data)
      );
      
      if (!response.ok && !response._fromCache) {
        throw new Error(`Fehler beim Abrufen des Wahlkreises für ${wohnort}`);
      }
      
      return await response.json();
    } catch (error) {
      logService.log("ERROR", `Fehler beim Abrufen des Wahlkreises für ${wohnort}`, {
        message: error.message
      });
      throw error;
    }
  },
  
  // Abgeordnete basierend auf Wahlkreis abrufen
  async getAbgeordneteForWahlkreis(wahlkreisNr, wohnort) {
    try {
      const abgeordneteUrl = `/api/v1/BTW25/abgeordnete?wahlkreis=${wahlkreisNr}&wohnort=${encodeURIComponent(wohnort)}`;
      
      const response = await this.fetchWithOfflineSupport(
        abgeordneteUrl,
        {},
        () => cacheService.getAbgeordneteCache(`wk_${wahlkreisNr}_${wohnort}`),
        (data) => cacheService.setAbgeordneteCache(`wk_${wahlkreisNr}_${wohnort}`, data)
      );
      
      if (!response.ok && !response._fromCache) {
        throw new Error(`Fehler beim Abrufen der Abgeordneten für Wahlkreis ${wahlkreisNr}`);
      }
      
      return await response.json();
    } catch (error) {
      logService.log("ERROR", `Fehler beim Abrufen der Abgeordneten für Wahlkreis ${wahlkreisNr}`, {
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
      const wahlkreisData = await this.getWahlkreis(ort);
      const wahlkreise = Array.isArray(wahlkreisData) ? wahlkreisData : [wahlkreisData];
      
      // Abgeordnete für jeden Wahlkreis abrufen und zusammenführen
      let alleAbgeordnete = [];
      
      for (const wahlkreis of wahlkreise) {
        if (!wahlkreis.wahlkreisNr) continue;
        
        try {
          const abgeordnete = await this.getAbgeordneteForWahlkreis(
            wahlkreis.wahlkreisNr, 
            wahlkreis.wohnort || ort
          );
          
          // Wahlkreisbezeichnung hinzufügen
          const abgeordneteMitWKB = abgeordnete.map(abg => ({
            ...abg,
            wkr_bezeichnung: wahlkreis.wahlkreisBez || "Unbekannter Wahlkreis"
          }));
          
          alleAbgeordnete = [...alleAbgeordnete, ...abgeordneteMitWKB];
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
      
      // Im Cache speichern (für den Gesamtergebnis-Cache)
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
  
  // KI-Brief generieren (keine Cache-Unterstützung, reine Online-Funktion)
  async generateAiBrief(userData) {
    try {
      const response = await fetch("/api/v1/genai-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userData })
      });
      
      // Auf Warnungen prüfen (explizit für KI-Anfragen)
      this.checkRateLimitHeaders(response, 'KI-Brief', true);
      
      // Auf Rate-Limit-Fehler prüfen
      if (response.status === 429) {
        const errorData = await response.json();
        const message = errorData.error || "KI-Anfragelimit erreicht. Bitte später erneut versuchen.";
        notificationService.showNotification(message, "error", 10000);
        throw new Error(message);
      }
      
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