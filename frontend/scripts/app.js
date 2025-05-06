//frontend/scipts/app.js
// Globale Konfigurationen
const LOG_LEVEL = "DEBUG"; // Direkt definierter Log-Level (DEBUG, INFO, WARN, ERROR)
const parlament = "Bundestag"; // Zentral definierte Konstante für das Parlament

// Logging-Funktion
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

// Event-Listener für DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("menu-button");
  const mobileNav = document.getElementById("mobile-nav");
  if (menuButton) {
    menuButton.addEventListener("click", () => {
      log("DEBUG", "Menü-Button geklickt");
      mobileNav.classList.toggle("hidden");
    });
  }
});

// Export the function for Alpine.js
export function parlamentspostApp() {
  return {
    // Dark Mode Zustand
    isDark: localStorage.getItem("isDark") === "true",

    // Netzwerkstatus
    isOnline: navigator.onLine, // Aktueller Online-Status

    // Benachrichtigungen
    notifications: [], // Speichert aktive Benachrichtigungen

    // Persoenliche Daten
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    email: "",

    // Aktuelle Themen und Freitext
    themen: [],
    freitext: "",

    // Abgeordnete
    abgeordnete: "",
    abgeordneteListe: [],
    isLoading: false, // Ladeindikator

    // Topic-System
    topic: "umwelt_und_nachhaltigkeit", // Statisch festgelegt für den Anfang
    topics: [],
    topicData: null, // Speichert die vollständigen Topic-Daten
    availableSubtopics: [],
    
    // Zeigt an, ob Topics aus dem Cache geladen wurden
    topicLoadedFromCache: false,
    subtopicsLoadedFromCache: false,

    // Brief-Formatierung
    formatierung: {
      schriftart: "Arial, sans-serif", // Standardwert, wird in init() zufällig gesetzt
      schriftgroesse: "mittel",
    },

    // Brief-Felder für die separate Bearbeitung
    briefFelder: {
      absender: "",
      empfaenger: "",
      ortDatum: "",
      betreff: "",
      brieftext: "",
    },

    // Cache-Konfiguration
    cacheEnabled: true,
    cacheTTL: 24 * 60 * 60 * 1000, // 24 Stunden für Abgeordnete
    topicCacheTTL: 7 * 24 * 60 * 60 * 1000, // 1 Woche für Topics

    // "Meine Briefe" Konfiguration
    briefStorage: {
      storageKey: "parlamentspost_briefe",
      maxPreviewBriefe: 4,
    },
    showAlleBriefe: false,
    gespeicherteBriefe: [], // Neue reaktive Eigenschaft für gespeicherte Briefe

    // Initialisierung
    async init() {
      // Dark Mode basierend auf Systemeinstellungen
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches &&
        localStorage.getItem("isDark") === null
      ) {
        this.isDark = true;
        document.documentElement.classList.add("dark");
        localStorage.setItem("isDark", "true");
      }

      // Netzwerkstatus überwachen
      window.addEventListener('online', () => {
        this.isOnline = true;
        log("INFO", "Netzwerkverbindung wiederhergestellt");
        // Optional: Benachrichtigung anzeigen
        this.showNotification("Netzwerkverbindung wiederhergestellt", "success");
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        log("WARN", "Netzwerkverbindung verloren");
        // Benachrichtigung anzeigen
        this.showNotification("Sie sind offline. Die App verwendet zwischengespeicherte Daten.", "warning", 8000);
      });

      // Event-Listener für Änderungen der Systemeinstellung
      const darkModeMediaQuery = window.matchMedia(
        "(prefers-color-scheme: dark)"
      );
      darkModeMediaQuery.addEventListener("change", (e) => {
        // Nur anwenden, wenn der Nutzer keine manuelle Einstellung vorgenommen hat
        if (localStorage.getItem("isDarkUserSet") !== "true") {
          this.isDark = e.matches;
          if (this.isDark) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("isDark", "true");
          } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("isDark", "false");
          }
          log("INFO", "Dark Mode durch Systemeinstellung geändert", {
            isDark: this.isDark,
          });
        }
      });

      // Zufällige Schriftart wählen
      this.formatierung.schriftart = this.getRandomFontFamily();

      // Topics im Hintergrund laden ohne Ladeindikator anzuzeigen
      this.loadInitialDataInBackground();

      // Gespeicherte Briefe laden
      this.gespeicherteBriefe = this.ladeBriefe();

      // "Meine Briefe"-Bereich aktualisieren
      this.updateMeineBriefeUI();
    },

    // Cache-Management Funktionen für Topics

    // Topics aus dem Cache laden
    getCachedTopics() {
      if (!this.cacheEnabled) return null;

      try {
        const cacheKey = 'parlamentspost_topics_cache';
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);
        const cacheTime = parsedData.timestamp;
        const now = Date.now();

        // Cache-Gültigkeit prüfen (1 Woche für Topics)
        if (now - cacheTime < this.topicCacheTTL) {
          log("INFO", "Topics aus Cache geladen");
          return parsedData.data;
        } else {
          // Abgelaufene Cache-Einträge löschen
          localStorage.removeItem(cacheKey);
          return null;
        }
      } catch (error) {
        log("WARN", "Fehler beim Lesen des Topic-Caches", { error: error.message });
        return null;
      }
    },

    // Topics im Cache speichern
    setCachedTopics(data) {
      if (!this.cacheEnabled) return;

      try {
        const cacheKey = 'parlamentspost_topics_cache';
        const cacheData = {
          timestamp: Date.now(),
          data: data,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        log("INFO", "Topics im Cache gespeichert", {
          entries: data.length,
        });
      } catch (error) {
        log("WARN", "Fehler beim Speichern der Topics im Cache", { error: error.message });
      }
    },

    // Topic-Daten aus dem Cache laden
    getCachedTopic(topicId) {
      if (!this.cacheEnabled) return null;

      try {
        const cacheKey = `parlamentspost_topic_${topicId}_cache`;
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);
        const cacheTime = parsedData.timestamp;
        const now = Date.now();

        // Cache-Gültigkeit prüfen (1 Woche für Topics)
        if (now - cacheTime < this.topicCacheTTL) {
          log("INFO", `Topic ${topicId} aus Cache geladen`);
          return parsedData.data;
        } else {
          localStorage.removeItem(cacheKey);
          return null;
        }
      } catch (error) {
        log("WARN", `Fehler beim Lesen des Topic-Caches für ${topicId}`, { error: error.message });
        return null;
      }
    },

    // Topic-Daten im Cache speichern
    setCachedTopic(topicId, data) {
      if (!this.cacheEnabled) return;

      try {
        const cacheKey = `parlamentspost_topic_${topicId}_cache`;
        const cacheData = {
          timestamp: Date.now(),
          data: data,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        log("INFO", `Topic ${topicId} im Cache gespeichert`);
      } catch (error) {
        log("WARN", `Fehler beim Speichern des Topics ${topicId} im Cache`, { error: error.message });
      }
    },

    // Subtopics aus dem Cache laden
    getCachedSubtopics(topicId) {
      if (!this.cacheEnabled) return null;

      try {
        const cacheKey = `parlamentspost_subtopics_${topicId}_cache`;
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);
        const cacheTime = parsedData.timestamp;
        const now = Date.now();

        // Cache-Gültigkeit prüfen (1 Woche für Subtopics)
        if (now - cacheTime < this.topicCacheTTL) {
          log("INFO", `Subtopics für ${topicId} aus Cache geladen`);
          return parsedData.data;
        } else {
          localStorage.removeItem(cacheKey);
          return null;
        }
      } catch (error) {
        log("WARN", `Fehler beim Lesen des Subtopic-Caches für ${topicId}`, { error: error.message });
        return null;
      }
    },

    // Subtopics im Cache speichern
    setCachedSubtopics(topicId, data) {
      if (!this.cacheEnabled) return;

      try {
        const cacheKey = `parlamentspost_subtopics_${topicId}_cache`;
        const cacheData = {
          timestamp: Date.now(),
          data: data,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        log("INFO", `Subtopics für ${topicId} im Cache gespeichert`, {
          entries: data.length,
        });
      } catch (error) {
        log("WARN", `Fehler beim Speichern der Subtopics für ${topicId} im Cache`, { error: error.message });
      }
    },

    // Zufällige Schriftart auswählen
    getRandomFontFamily() {
      const fonts = [
        "Arial, sans-serif",
        "Times New Roman, serif",
        "Georgia, serif",
        "Verdana, sans-serif",
        "Calibri, sans-serif",
      ];
      return fonts[Math.floor(Math.random() * fonts.length)];
    },

    // Verbesserte toggleDarkMode-Funktion
    toggleDarkMode() {
      this.isDark = !this.isDark;
      log("INFO", "Dark Mode manuell umgeschaltet", { isDark: this.isDark });

      if (this.isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("isDark", "true");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("isDark", "false");
      }

      // Markieren, dass der Nutzer manuell umgeschaltet hat
      localStorage.setItem("isDarkUserSet", "true");

      // Animation für sanfteren Übergang hinzufügen
      document.body.style.transition =
        "background-color 0.5s ease, color 0.5s ease";
      setTimeout(() => {
        document.body.style.transition = "";
      }, 500);
    },

    // Alle Topics laden mit Cache-Unterstützung
    async ladeTopics() {
      this.isLoading = true;
      this.topicLoadedFromCache = false;
      
      try {
        // API-Aufruf mit Offline-Unterstützung
        const response = await this.fetchWithOfflineSupport(
          "/api/v1/topics",
          {},
          // Cache-Funktionen bereitstellen
          () => this.getCachedTopics(),
          (data) => this.setCachedTopics(data)
        );
        
        const topics = await response.json();
        this.topics = topics;
        
        // Cache-Status für UI setzen (wenn offline und Daten vorhanden, müssen sie aus dem Cache sein)
        this.topicLoadedFromCache = !this.isOnline && topics.length > 0;
        
        log("INFO", "Topics geladen", { count: topics.length, fromCache: this.topicLoadedFromCache });
        return topics;
      } catch (error) {
        log("ERROR", "Fehler beim Laden der Topics", { message: error.message });
        
        // Benachrichtigung anzeigen, wenn keine Daten aus dem Cache verfügbar sind
        if (!this.topics || this.topics.length === 0) {
          this.showNotification(`Fehler beim Laden der Topics: ${error.message}`, "error");
        }
        
        return this.topics || [];
      } finally {
        this.isLoading = false;
      }
    },

    // Topic auswählen und zugehörige Subtopics laden
    async waehleTopic(topicId) {
      if (this.topic === topicId) return; // Keine Änderung, wenn gleiches Topic

      this.topic = topicId;
      log("INFO", `Topic gewechselt zu ${topicId}`);

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

    // Cache-Management Methoden für Abgeordnete
    getCachedAbgeordnete(ort) {
      if (!this.cacheEnabled) return null;

      try {
        const cacheKey = `abgeordnete_${ort.trim().toLowerCase()}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);
        const cacheTime = parsedData.timestamp;
        const now = Date.now();

        // Cache-Gültigkeit prüfen
        if (now - cacheTime < this.cacheTTL) {
          log("INFO", "Daten aus Cache geladen", { ort });
          return parsedData.data;
        } else {
          // Abgelaufene Cache-Einträge löschen
          localStorage.removeItem(cacheKey);
          return null;
        }
      } catch (error) {
        log("WARN", "Fehler beim Lesen des Caches", { error: error.message });
        return null;
      }
    },

    setCachedAbgeordnete(ort, data) {
      if (!this.cacheEnabled) return;

      try {
        const cacheKey = `abgeordnete_${ort.trim().toLowerCase()}`;
        const cacheData = {
          timestamp: Date.now(),
          data: data,
        };

        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        log("INFO", "Daten im Cache gespeichert", {
          ort,
          entries: data.length,
        });
      } catch (error) {
        log("WARN", "Fehler beim Speichern im Cache", { error: error.message });
        // Bei Fehler (z.B. LocalStorage voll) Cache-Funktion deaktivieren
        this.cacheEnabled = false;
      }
    },

    // Den gesamten Cache leeren (Abgeordnete, Topics, etc.)
    clearAllCache() {
      try {
        // Alle Cache-Einträge mit Präfixen identifizieren
        const prefixes = [
          'abgeordnete_',  // Abgeordneten-Cache
          'parlamentspost_topics',  // Topics-Cache
          'parlamentspost_topic_',  // Einzelne Topic-Caches
          'parlamentspost_subtopics_'  // Subtopics-Caches
        ];
        
        let totalDeleted = 0;
        
        // Für jeden Präfix alle passenden Einträge löschen
        prefixes.forEach(prefix => {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              keys.push(key);
            }
          }
          
          keys.forEach(key => localStorage.removeItem(key));
          log("INFO", `Cache-Einträge mit Präfix ${prefix} gelöscht`, { count: keys.length });
          totalDeleted += keys.length;
        });
        
        log("INFO", "Gesamter Cache geleert", { totalDeleted });
        
        // Optional: Feedback für den Benutzer anzeigen
        if (totalDeleted > 0) {
          this.showNotification(`Cache erfolgreich geleert (${totalDeleted} Einträge gelöscht).`);
        } else {
          this.showNotification("Kein Cache zum Leeren gefunden.");
        }
      } catch (error) {
        log("ERROR", "Fehler beim Leeren des Caches", { error: error.message });
        this.showNotification("Fehler beim Leeren des Caches: " + error.message);
      }
    },

    // Subtopics vom Server oder Cache laden
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
            // Versuche, Topic-Daten mit Offline-Unterstützung zu laden
            const topicResponse = await this.fetchWithOfflineSupport(
              `/api/v1/topics/${this.topic}`,
              {},
              () => this.getCachedTopic(this.topic),
              (data) => this.setCachedTopic(this.topic, data)
            );
            
            // Extrahiere die Daten
            const topicData = await topicResponse.json();
            this.topicData = topicData;
            
            // Setze fromCache basierend darauf, ob es eine eigene Anfrage war oder aus dem Cache kam
            const isFromCache = topicResponse._fromCache === true;
            
            log("INFO", "Topic-Daten geladen", {
              topic: this.topic,
              fromCache: isFromCache // Aktualisiertes Flag
            });
          } catch (error) {
            log("ERROR", `Fehler beim Laden des Topics ${this.topic}`, { message: error.message });
            this.showNotification(`Fehler beim Laden des Topics: ${error.message}`, "error");
            return [];
          }
        }
    
        try {
          // Subtopics mit Offline-Unterstützung laden
          const response = await this.fetchWithOfflineSupport(
            `/api/v1/topics/${this.topic}/subtopics`,
            {},
            () => this.getCachedSubtopics(this.topic),
            (data) => this.setCachedSubtopics(this.topic, data)
          );
          
          const subtopics = await response.json();
          this.availableSubtopics = subtopics;
          this.themen = []; // Setze themen zurück, da wir neue Subtopics haben
          
          // Cache-Status für UI setzen - Prüfen, ob die Antwort aus dem Cache kam
          this.subtopicsLoadedFromCache = response._fromCache === true;
          
          log("INFO", "Subtopics geladen", {
            count: subtopics.length,
            fromCache: this.subtopicsLoadedFromCache
          });
          
          return subtopics;
        } catch (error) {
          log("ERROR", "Fehler beim Laden der Subtopics", { message: error.message });
          
          // Benachrichtigung nur zeigen, wenn keine Daten aus dem Cache verfügbar sind
          if (!this.availableSubtopics || this.availableSubtopics.length === 0) {
            this.showNotification(`Fehler beim Laden der Subtopics: ${error.message}`, "error");
          }
          
          return this.availableSubtopics || [];
        }
      } finally {
        this.isLoading = false;
      }
    },

    // Abgeordnete holen
    async holeAbgeordnete() {
      if (!this.ort.trim()) {
        log("WARN", "Kein Wohnort eingegeben");
        return;
      }

      // Versuche zuerst, Daten aus dem Cache zu laden
      const cachedAbgeordnete = this.getCachedAbgeordnete(this.ort);
      if (cachedAbgeordnete) {
        this.abgeordneteListe = cachedAbgeordnete;
        log("INFO", "Abgeordnete aus Cache geladen", {
          anzahl: cachedAbgeordnete.length,
        });
        return;
      }

      // Überprüfe Online-Status
      if (!this.isOnline) {
        this.showNotification(
          "Keine Netzwerkverbindung und keine Cache-Daten für den eingegebenen Ort",
          "warning"
        );
        return;
      }

      this.isLoading = true; // Ladeindikator aktivieren
      log("INFO", "Starte Abruf der Abgeordneten", { ort: this.ort });

      try {
        // Wahlkreis-Abfrage mit Fehlerbehandlung
        let wahlkreisData;
        try {
          // Hier könnte fetchWithOfflineSupport verwendet werden, aber wir brauchen mehr Kontrolle über die Verarbeitung
          // der Antwort, daher verwenden wir direkt fetch
          const wahlkreisUrl = `/api/v1/BTW25/wahlkreis?wohnort=${encodeURIComponent(this.ort.trim())}`;
          const wahlkreisResponse = await fetch(wahlkreisUrl);

          if (!wahlkreisResponse.ok) {
            throw new Error("Fehler beim Abrufen des Wahlkreises.");
          }

          const wahlkreisResponseText = await wahlkreisResponse.text();
          try {
            wahlkreisData = JSON.parse(wahlkreisResponseText);
          } catch (parseError) {
            throw new Error("Ungültige Antwort vom Server.");
          }

          if (!wahlkreisData) {
            throw new Error(`Kein Wahlkreis für "${this.ort}" gefunden.`);
          }
        } catch (wahlkreisError) {
          throw wahlkreisError; // Weiterleiten an die äußere catch-Klausel
        }

        // Wahlkreisdaten verarbeiten
        let wahlkreise = Array.isArray(wahlkreisData) ? wahlkreisData : [wahlkreisData];
        log("INFO", `${wahlkreise.length} Wahlkreis(e) gefunden`, wahlkreise);

        // Alle gefundenen Abgeordneten sammeln
        let alleAbgeordnete = [];

        // Für jeden Wahlkreis die zugehörigen Abgeordneten abrufen
        for (const wahlkreis of wahlkreise) {
          if (!wahlkreis.wahlkreisNr) {
            log("WARN", `Wahlkreisnummer fehlt für Wahlkreis`, wahlkreis);
            continue; // Überspringe diesen Wahlkreis, wenn keine Nummer vorhanden
          }

          try {
            // Abgeordneten-API mit fetchWithOfflineSupport aufrufen
            const abgeordneteUrl = `/api/v1/BTW25/abgeordnete?wahlkreis=${wahlkreis.wahlkreisNr}&wohnort=${encodeURIComponent(wahlkreis.wohnort)}`;
            
            // Hier verwenden wir für die Konsistenz wieder fetch direkt,
            // da wir für diese spezielle Abfrage kein Caching implementiert haben
            const abgeordneteResponse = await fetch(abgeordneteUrl);
            
            if (!abgeordneteResponse.ok) {
              log("WARN", `Keine Abgeordneten für Wahlkreis ${wahlkreis.wahlkreisNr} gefunden`);
              continue; // Mit dem nächsten Wahlkreis fortfahren
            }

            const abgeordnete = await abgeordneteResponse.json();
            
            // Füge Wahlkreisbezeichnung zu jedem Abgeordneten hinzu
            const abgeordneteMitWKB = abgeordnete.map((abg) => ({
              ...abg,
              wkr_bezeichnung: wahlkreis.wahlkreisBez || "Unbekannter Wahlkreis",
            }));

            // Füge diese Abgeordneten zum Gesamtergebnis hinzu
            alleAbgeordnete = [...alleAbgeordnete, ...abgeordneteMitWKB];
          } catch (abgeordneteError) {
            log("WARN", `Fehler beim Abrufen der Abgeordneten für Wahlkreis ${wahlkreis.wahlkreisNr}`, {
              error: abgeordneteError.message
            });
            // Hier nur warnen und mit dem nächsten Wahlkreis fortfahren
          }
        }

        // Deduplizieren der Abgeordneten basierend auf der ID
        this.abgeordneteListe = Array.from(
          new Map(alleAbgeordnete.map((item) => [item.id, item])).values()
        );

        if (this.abgeordneteListe.length === 0) {
          throw new Error(`Keine Abgeordneten für "${this.ort}" gefunden.`);
        }

        // Nach erfolgreicher Abfrage im Cache speichern
        this.setCachedAbgeordnete(this.ort, this.abgeordneteListe);
        
        log("INFO", "Alle Abgeordneten zusammengeführt", {
          count: this.abgeordneteListe.length
        });
        
        return this.abgeordneteListe;
      } catch (error) {
        log("ERROR", "Fehler in holeAbgeordnete", { message: error.message });
        this.showNotification(
          `Fehler beim Abrufen der Abgeordneten: ${error.message}`,
          "error"
        );
        this.abgeordneteListe = [];
        return [];
      } finally {
        this.isLoading = false; // Ladeindikator deaktivieren
      }
    },

    validateAndSubmit(event) {
      // Prüft, ob das Formular gültig ist
      if (!event.target.checkValidity()) {
        // Wenn nicht gültig, zeigt Browser die Fehlermeldungen an
        event.preventDefault();
        return;
      }

      // Formular ist gültig, rufen Sie generiereBrief auf
      // Bestimmen der Methode basierend auf dem geklickten Button
      const isAiGenerated = event.submitter.classList.contains("ai-button");
      this.generiereBrief(isAiGenerated);

      // Verhindert das tatsächliche Absenden des Formulars
      event.preventDefault();
    },

    async generiereBrief(kiGeneriert = false) {
      log("INFO", "Starte Briefgenerierung", { kiGeneriert });

      // Absender zusammenstellen
      const absender = `${this.name}\n${this.strasse}\n${this.plz} ${this.ort}`;

      // Aktuelles Datum im deutschen Format
      const aktuellesDatum = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const ortUndDatum = `${this.ort}, den ${aktuellesDatum}`;

      // Abgeordneteninformationen abrufen
      const abgeordneter = this.abgeordneteListe.find(
        (a) => String(a.id) === this.abgeordnete
      );
      const wahlkreisBez =
        abgeordneter?.wkr_bezeichnung || "Wahlkreis unbekannt";

      // Für Betreff und Anrede
      const vollerNameDesAbgeordneten = abgeordneter?.vollerName || "Unbekannt";
      const parteiDesAbgeordneten = abgeordneter?.partei || "Unbekannte Partei";

      // Anrede basierend auf Geschlecht
      const anrede =
        abgeordneter?.geschlecht === "m"
          ? "Sehr geehrter Herr"
          : abgeordneter?.geschlecht === "w"
          ? "Sehr geehrte Frau"
          : "Sehr geehrte:r";

      // Adresse des Adressaten zusammenstellen
      const empfaenger = `${vollerNameDesAbgeordneten}
Deutscher Bundestag
Platz der Republik 1
11011 Berlin`;

      // Betreffzeile basierend auf dem Topic-Namen generieren
      let betreff = "Anliegen zur Politik";

      // Topic-Daten verwenden, falls bereits geladen
      if (this.topicData && this.topicData.name) {
        betreff = `Anliegen zum Thema: ${this.topicData.name}`;
        log("INFO", "Betreff aus gespeichertem Topic-Namen generiert", {
          betreff,
        });
      }

      // Validierung von Freitext und Themen
      if (!this.freitext.trim() && this.themen.length === 0) {
        log("WARN", "Kein Freitext oder Thema angegeben");
        this.showNotification("Bitte einen Freitext oder mindestens ein Thema angeben.");
        return;
      }

      let brieftext = "";
      if (kiGeneriert) {
        this.isLoading = true;
        try {
          // Sammle Prompt-Blöcke der ausgewählten Subtopics
          const selectedSubtopics = this.availableSubtopics.filter((subtopic) =>
            this.themen.includes(subtopic.id)
          );
      
          const promptBlocks = selectedSubtopics.map(
            (subtopic) => subtopic.promptBlock
          );
      
          const userData = {
            topic: this.topicData,
            selectedSubtopics,
            promptBlocks,
            freitext: this.freitext.trim(),
            abgeordneteName: vollerNameDesAbgeordneten,
            abgeordnetePartei: parteiDesAbgeordneten,
          };
      
          log("DEBUG", "Daten für KI-Generierung", userData);
      
          try {
            // Da wir hier keinen Cache verwenden, direkt fetch benutzen
            const response = await fetch("/api/v1/genai-brief", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userData }),
            });
      
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || "Fehler bei der KI-Generierung.");
            }
      
            const data = await response.json();
            brieftext = `${anrede} ${abgeordneter?.name || "Unbekannt"},\n\n${
              data.briefText || "(Kein KI-Text vorhanden)"
            }\n\nMit freundlichen Grüßen,\n${this.name}`;
            
            log("INFO", "KI-Text erfolgreich generiert");
          } catch (apiError) {
            log("ERROR", "API-Fehler bei KI-Generierung", { message: apiError.message });
            this.showNotification(`Fehler bei der KI-Generierung: ${apiError.message}`, "error");
            throw apiError; // Weiterleiten, um die Briefgenerierung abzubrechen
          }
        } catch (error) {
          log("ERROR", "Fehler bei der KI-Abfrage", { message: error.message });
          this.showNotification(`Fehler bei der KI-Abfrage: ${error.message}`, "error");
          return; // Briefgenerierung abbrechen
        } finally {
          this.isLoading = false;
        }
      } else {
        // Manuelle Erstellung mit subtopic-spezifischen Textblöcken
        const selectedSubtopics = this.availableSubtopics.filter((subtopic) =>
          this.themen.includes(subtopic.id)
        );

        const textBlocks = selectedSubtopics
          .map((subtopic) => subtopic.textBlock)
          .join("\n\n");

        // Prüfe, ob Themen ausgewählt wurden oder Freitext vorhanden ist
        const hasSubtopics = selectedSubtopics.length > 0;
        const hasFreitext = this.freitext.trim().length > 0;

        // Einleitung nur erstellen, wenn Themenblöcke ausgewählt wurden
        const subtopicsText = hasSubtopics
          ? `Ich wende mich heute an Sie bezüglich folgender Themen: ${selectedSubtopics
              .map((subtopic) => subtopic.name)
              .join(", ")}.`
          : "";

        // Beginne mit Anrede
        brieftext = `${anrede} ${abgeordneter?.name || "Unbekannt"},`;

        // Füge Thementext und -blöcke nur hinzu, wenn vorhanden
        if (hasSubtopics) {
          brieftext += `\n\n${subtopicsText}\n\n${textBlocks}`;
        }

        // Füge Freitext nur hinzu, wenn vorhanden
        if (hasFreitext) {
          brieftext += `\n\n${this.freitext}`;
        }

        // Füge Grußformel am Ende hinzu
        brieftext += `\n\nMit freundlichen Grüßen,\n${this.name}`;

        log("INFO", "Manueller Briefinhalt erstellt", { brieftext });
      }

      // Brieffelder setzen
      this.briefFelder = {
        absender: absender,
        empfaenger: empfaenger,
        ortDatum: ortUndDatum,
        betreff: betreff,
        brieftext: brieftext,
      };

      log("INFO", "Brieffelder erstellt", this.briefFelder);

      // Briefvorschau aktivieren
      this.aktiviereBriefvorschau();

      // Den Brief automatisch im Local Storage speichern
      this.speichereBrief();

      // "Meine Briefe"-Bereich aktualisieren
      this.updateMeineBriefeUI();
    },

    aktiviereBriefvorschau() {
      log("INFO", "Aktiviere Briefvorschau");

      // Export-Button und Speichern-Button aktivieren
      const exportButton = document.getElementById("print-button");
      if (exportButton) {
        exportButton.disabled = false;
      }

      const saveButton = document.getElementById("save-brief-button");
      if (saveButton) {
        saveButton.disabled = false;
      }

      // Zum Briefvorschau-Bereich scrollen
      const briefVorschau = document.getElementById("briefvorschau");
      if (briefVorschau) {
        briefVorschau.scrollIntoView({ behavior: "smooth" });
      }
    },

    briefDrucken() {
      log("INFO", "Brief wird gedruckt");

      // Die contenteditable-Elemente werden durch Event-Handler aktualisiert,
      // daher brauchen wir hier keine manuelle Aktualisierung mehr

      // Druck auslösen
      window.print();
    },

    // Brief speichern
    speichereBrief() {
      // Sammle alle relevanten Daten
      let briefDaten = {
        id: `brief_${Date.now()}`,
        zeitstempel: new Date().toISOString(),
        titel: this.generateBriefTitel(),
        absender: {
          name: this.name,
          strasse: this.strasse,
          plz: this.plz,
          ort: this.ort,
          email: this.email,
        },
        empfaenger: {
          id: this.abgeordnete,
          abgeordneter:
            this.abgeordneteListe.find(
              (a) => String(a.id) === this.abgeordnete
            ) || null,
        },
        themen: {
          topic: this.topic,
          ausgewaehlteThemen: this.themen,
          freitext: this.freitext,
        },
        briefInhalt: {
          absenderText: this.briefFelder.absender,
          empfaengerText: this.briefFelder.empfaenger,
          ortDatumText: this.briefFelder.ortDatum,
          betreffText: this.briefFelder.betreff,
          briefText: this.briefFelder.brieftext,
        },
        formatierung: {
          schriftart: this.formatierung.schriftart,
          schriftgroesse: this.formatierung.schriftgroesse,
        },
      };

      log("INFO", "Brief wird im Local Storage gespeichert", {
        briefId: briefDaten.id,
      });

      try {
        // Bestehende Briefe laden
        const briefe = this.ladeBriefe();

        // Neuen Brief hinzufügen
        briefe.push(briefDaten);

        // Zurück in Local Storage speichern
        localStorage.setItem(
          this.briefStorage.storageKey,
          JSON.stringify(briefe)
        );

        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = briefe;

        // UI aktualisieren
        this.updateMeineBriefeUI();

        // Scrolle zum "Meine Briefe"-Bereich
        const meineBriefeBereich = document.getElementById(
          "meine-briefe-bereich"
        );
        if (meineBriefeBereich) {
          meineBriefeBereich.scrollIntoView({ behavior: "smooth" });
        }

        log("INFO", "Brief erfolgreich gespeichert", { id: briefDaten.id });
        //        this.showNotification("Brief wurde erfolgreich gespeichert!");

        return briefDaten.id;
      } catch (error) {
        log("ERROR", "Fehler beim Speichern des Briefes", {
          error: error.message,
        });
        this.showNotification("Der Brief konnte nicht gespeichert werden: " + error.message);
        return null;
      }
    },

    // Generiert einen ansprechenden Titel für den Brief
    generateBriefTitel() {
      // Versuche den Empfänger zu bekommen
      const abgeordneter = this.abgeordneteListe.find(
        (a) => String(a.id) === this.abgeordnete
      );
      const empfaengerName = abgeordneter
        ? abgeordneter.vollerName
        : "Unbekannter Empfänger";

      // Versuche den Thementitel zu bekommen
      let themenTitel = "Allgemein";
      const selectedTopic = this.topics.find((t) => t.id === this.topic);
      if (selectedTopic) {
        themenTitel = selectedTopic.name;
      }

      // Datum im kurzen Format
      const datum = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      });

      // Titel zusammenstellen
      return `Brief an ${empfaengerName} - ${themenTitel} (${datum})`;
    },

    // Alle Briefe laden
    ladeBriefe(limit = null) {
      try {
        // Wenn Briefe bereits im Model sind und wir nicht einen frischen Load erzwingen wollen
        if (this.gespeicherteBriefe && this.gespeicherteBriefe.length > 0) {
          // Briefe aus dem Modell verwenden
          let briefe = [...this.gespeicherteBriefe];

          // Nach Datum sortieren (neueste zuerst)
          briefe.sort(
            (a, b) => new Date(b.zeitstempel) - new Date(a.zeitstempel)
          );

          // Optional begrenzen
          if (limit !== null && Number.isInteger(limit) && limit > 0) {
            return briefe.slice(0, limit);
          }

          return briefe;
        }

        // Aus dem Local Storage laden
        const briefeJson = localStorage.getItem(this.briefStorage.storageKey);
        if (!briefeJson) {
          return [];
        }

        // In Objekt umwandeln
        let briefe = JSON.parse(briefeJson);

        // Nach Datum sortieren (neueste zuerst)
        briefe.sort(
          (a, b) => new Date(b.zeitstempel) - new Date(a.zeitstempel)
        );

        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = briefe;

        // Optional begrenzen
        if (limit !== null && Number.isInteger(limit) && limit > 0) {
          return briefe.slice(0, limit);
        }

        log("INFO", "Briefe aus Local Storage geladen", {
          count: briefe.length,
        });
        return briefe;
      } catch (error) {
        log("ERROR", "Fehler beim Laden der Briefe", { error: error.message });
        return [];
      }
    },

    // Einzelnen Brief laden
    ladeBrief(id) {
      try {
        const briefe = this.ladeBriefe();
        const brief = briefe.find((b) => b.id === id);

        if (!brief) {
          log("WARN", `Brief mit ID ${id} nicht gefunden`);
          return null;
        }

        log("INFO", `Brief ${id} geladen`);
        return brief;
      } catch (error) {
        log("ERROR", `Fehler beim Laden des Briefs ${id}`, {
          error: error.message,
        });
        return null;
      }
    },

    // Brief löschen
    loescheBrief(id) {
      try {
        // Alle Briefe laden
        const briefe = this.ladeBriefe();

        // Brief mit der ID filtern
        const filteredBriefe = briefe.filter((b) => b.id !== id);

        // Wenn keine Änderung, dann wurde der Brief nicht gefunden
        if (filteredBriefe.length === briefe.length) {
          log(
            "WARN",
            `Brief mit ID ${id} konnte nicht gelöscht werden (nicht gefunden)`
          );
          return false;
        }

        // Aktualisierte Liste speichern
        localStorage.setItem(
          this.briefStorage.storageKey,
          JSON.stringify(filteredBriefe)
        );

        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = filteredBriefe;

        // UI aktualisieren
        this.updateMeineBriefeUI();

        log("INFO", `Brief ${id} gelöscht`);
        return true;
      } catch (error) {
        log("ERROR", `Fehler beim Löschen des Briefs ${id}`, {
          error: error.message,
        });
        return false;
      }
    },

    // Alle Briefe löschen
    loescheAlleBriefe() {
      try {
        localStorage.removeItem(this.briefStorage.storageKey);

        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = [];

        // UI aktualisieren
        this.updateMeineBriefeUI();

        log("INFO", "Alle Briefe gelöscht");
        return true;
      } catch (error) {
        log("ERROR", "Fehler beim Löschen aller Briefe", {
          error: error.message,
        });
        return false;
      }
    },

    // Brief in die globalen Daten laden und bearbeiten können
    briefBearbeiten(id) {
      try {
        // Brief laden
        const brief = this.ladeBrief(id);
        if (!brief) {
          this.showNotification("Der Brief konnte nicht geladen werden.");
          return false;
        }

        // Nutzerdaten setzen
        this.name = brief.absender.name || "";
        this.strasse = brief.absender.strasse || "";
        this.plz = brief.absender.plz || "";
        this.ort = brief.absender.ort || "";
        this.email = brief.absender.email || "";

        // Themen setzen
        this.topic = brief.themen.topic || this.topic;
        this.loadSubtopics().then(() => {
          // Nur nach dem Laden der Subtopics die Auswahl setzen
          this.themen = brief.themen.ausgewaehlteThemen || [];
          this.freitext = brief.themen.freitext || "";
        });

        // Abgeordneten setzen (ID muss als String vorliegen)
        this.abgeordnete = String(brief.empfaenger.id) || "";

        // Wenn keine Abgeordnetenliste vorhanden, neu laden
        if (this.abgeordneteListe.length === 0) {
          this.holeAbgeordnete();
        }

        // Brieffelder setzen
        this.briefFelder = {
          absender: brief.briefInhalt.absenderText || "",
          empfaenger: brief.briefInhalt.empfaengerText || "",
          ortDatum: brief.briefInhalt.ortDatumText || "",
          betreff: brief.briefInhalt.betreffText || "",
          brieftext: brief.briefInhalt.briefText || "",
        };

        // Formatierung setzen
        this.formatierung = {
          schriftart: brief.formatierung.schriftart || "Arial, sans-serif",
          schriftgroesse: brief.formatierung.schriftgroesse || "mittel",
        };

        // Briefvorschau aktivieren
        this.aktiviereBriefvorschau();

        // Zum Formular scrollen
        setTimeout(() => {
          const formElement = document.getElementById("user-form");
          if (formElement) {
            formElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);

        log("INFO", `Brief ${id} zur Bearbeitung geladen`);
        return true;
      } catch (error) {
        log("ERROR", `Fehler beim Laden des Briefs ${id} zur Bearbeitung`, {
          error: error.message,
        });
        this.showNotification(`Fehler beim Laden des Briefs: ${error.message}`);
        return false;
      }
    },

    // Aktualisierung des "Meine Briefe"-UI-Bereichs
    updateMeineBriefeUI() {
      // Überprüfen wir, ob Briefe vorhanden sind
      const briefe = this.ladeBriefe(this.briefStorage.maxPreviewBriefe);
      const meineBriefeBereich = document.getElementById(
        "meine-briefe-bereich"
      );

      if (meineBriefeBereich) {
        if (briefe.length > 0) {
          meineBriefeBereich.classList.remove("hidden");
        } else {
          meineBriefeBereich.classList.add("hidden");
        }
      }
    },

    // Hilfsfunktion für API-Aufrufe mit Offline-Unterstützung
    async fetchWithOfflineSupport(url, options = {}, getCacheFn, setCacheFn) {
      // Prüfen, ob Daten im Cache verfügbar sind
      if (getCacheFn) {
        const cachedData = getCacheFn();
        if (cachedData) {
          // Im Online-Modus können wir den Cache verwenden und später aktualisieren
          // Im Offline-Modus müssen wir den Cache verwenden
          if (!this.isOnline) {
            log("INFO", `Offline-Modus: Daten aus Cache für ${url}`);
            return { 
              ok: true, 
              json: () => Promise.resolve(cachedData),
              _fromCache: true // Markierung hinzufügen
            };
          } else {
            // Im Online-Modus prüfen wir auch, ob wir den Cache verwenden können
            log("INFO", `Daten aus Cache für ${url} geladen`);
            
            // Optional: Starte eine Hintergrundaktualisierung und speichere neue Daten im Cache
            this.updateCacheInBackground(url, options, setCacheFn);
            
            // Gib die Daten aus dem Cache zurück
            return { 
              ok: true, 
              json: () => Promise.resolve(cachedData),
              _fromCache: true // Markierung hinzufügen
            };
          }
        } else if (!this.isOnline) {
          // Wenn offline und keine Cache-Daten verfügbar, werfen wir einen Fehler
          throw new Error("Keine Netzwerkverbindung und keine Cache-Daten verfügbar");
        }
      }
      
      // Normal fortfahren, wenn online und keine Cache-Daten vorhanden sind
      try {
        const response = await fetch(url, options);
        // Bei Erfolg und wenn Cache-Funktion verfügbar, Ergebnis cachen
        if (response.ok && setCacheFn) {
          const data = await response.clone().json();
          setCacheFn(data);
        }
        return response; // Keine Cache-Markierung, da direkt vom Server
      } catch (error) {
        // Bei Netzwerkfehlern prüfen, ob Cache verfügbar
        if (getCacheFn) {
          const cachedData = getCacheFn();
          if (cachedData) {
            log("INFO", `Netzwerkfehler: Fallback auf Cache-Daten für ${url}`);
            return { 
              ok: true, 
              json: () => Promise.resolve(cachedData),
              _fromCache: true // Markierung hinzufügen
            };
          }
        }
        throw error;
      }
    },

    // Funktion, um den Cache im Hintergrund zu aktualisieren
    async updateCacheInBackground(url, options, setCacheFn) {
      if (!this.isOnline || !setCacheFn) return;
      
      try {
        // Fetch im Hintergrund ohne auf Antwort zu warten
        fetch(url, options)
          .then(response => {
            if (response.ok) {
              return response.json();
            }
            throw new Error("Fehler bei der Hintergrundaktualisierung");
          })
          .then(data => {
            setCacheFn(data);
            log("INFO", `Cache für ${url} im Hintergrund aktualisiert`);
          })
          .catch(error => {
            log("WARN", `Cache-Hintergrundaktualisierung für ${url} fehlgeschlagen`, { error: error.message });
          });
      } catch (error) {
        // Fehler hier ignorieren, da es nur eine Hintergrundaktualisierung ist
        log("WARN", `Fehler beim Starten der Hintergrundaktualisierung für ${url}`, { error: error.message });
      }
    },

    // Zeigt eine Benachrichtigung an
    showNotification(message, type = 'info', duration = 5000) {
      const id = Date.now();
      
      // Wenn bereits Benachrichtigungen existieren, erstelle ein Array
      if (!this.notifications) {
        this.notifications = [];
      }
      
      this.notifications.push({ id, message, type, duration });
      
      // Automatisch nach der angegebenen Dauer entfernen
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
      
      return id;
    },

    // Entfernt eine Benachrichtigung
    removeNotification(id) {
      if (this.notifications) {
        this.notifications = this.notifications.filter(n => n.id !== id);
      }
    },
    async loadInitialDataInBackground() {
      try {
        // Cache für Topics überprüfen
        const cachedTopics = this.getCachedTopics();
        if (cachedTopics) {
          this.topics = cachedTopics;
          this.topicLoadedFromCache = true;
          log("INFO", "Topics aus Cache für initiale Anzeige geladen", { count: cachedTopics.length });
          
          // Wenn ein Topic gesetzt ist, Subtopics aus dem Cache laden
          if (this.topic) {
            const cachedSubtopics = this.getCachedSubtopics(this.topic);
            if (cachedSubtopics) {
              this.availableSubtopics = cachedSubtopics;
              this.subtopicsLoadedFromCache = true;
              log("INFO", "Subtopics aus Cache für initiale Anzeige geladen", { count: cachedSubtopics.length });
            }
          }
          
          // Im Hintergrund aktualisieren, wenn online
          if (this.isOnline) {
            this.updateTopicsInBackground();
          }
        } else {
          // Wenn kein Cache vorhanden, dann Topics laden, aber ohne Ladeindikator
          try {
            const response = await fetch("/api/v1/topics");
            if (response.ok) {
              const topics = await response.json();
              this.topics = topics;
              this.setCachedTopics(topics);
              log("INFO", "Topics für initiale Anzeige geladen", { count: topics.length });
              
              // Wenn topics vorhanden, erstes Topic setzen und Subtopics laden
              if (topics && topics.length > 0) {
                if (!this.topic) {
                  this.topic = topics[0].id;
                }
                
                // Subtopics im Hintergrund laden
                try {
                  const subtopicsResponse = await fetch(`/api/v1/topics/${this.topic}/subtopics`);
                  if (subtopicsResponse.ok) {
                    const subtopics = await subtopicsResponse.json();
                    this.availableSubtopics = subtopics;
                    this.setCachedSubtopics(this.topic, subtopics);
                    log("INFO", "Subtopics für initiale Anzeige geladen", { count: subtopics.length });
                  }
                } catch (subtopicsError) {
                  log("WARN", "Fehler beim initialen Laden der Subtopics", { error: subtopicsError.message });
                }
              }
            }
          } catch (error) {
            log("WARN", "Fehler beim initialen Laden der Topics", { error: error.message });
          }
        }
      } catch (error) {
        log("WARN", "Fehler beim Laden der initialen Daten", { error: error.message });
      }
    },
    
    // Hilfsmethode zum Aktualisieren der Topics im Hintergrund
    async updateTopicsInBackground() {
      if (!this.isOnline) return;
      
      try {
        // Topics im Hintergrund aktualisieren
        fetch("/api/v1/topics")
          .then(response => {
            if (response.ok) return response.json();
            throw new Error("Fehler beim Aktualisieren der Topics");
          })
          .then(topics => {
            this.topics = topics;
            this.setCachedTopics(topics);
            log("INFO", "Topics im Hintergrund aktualisiert", { count: topics.length });
            
            // Wenn ein Topic ausgewählt ist, auch Subtopics aktualisieren
            if (this.topic) {
              return fetch(`/api/v1/topics/${this.topic}/subtopics`);
            }
          })
          .then(response => {
            if (response && response.ok) return response.json();
            throw new Error("Fehler beim Aktualisieren der Subtopics");
          })
          .then(subtopics => {
            if (subtopics) {
              this.availableSubtopics = subtopics;
              this.setCachedSubtopics(this.topic, subtopics);
              log("INFO", "Subtopics im Hintergrund aktualisiert", { count: subtopics.length });
            }
          })
          .catch(error => {
            log("WARN", "Fehler bei der Hintergrundaktualisierung", { error: error.message });
          });
      } catch (error) {
        // Fehler hier ignorieren, da es nur eine Hintergrundaktualisierung ist
        log("WARN", "Fehler beim Starten der Hintergrundaktualisierung", { error: error.message });
      }
    },
  };
}
