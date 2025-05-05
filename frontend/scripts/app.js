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
    
    // Brief-Formatierung
    formatierung: {
      schriftart: "Arial, sans-serif", // Standardwert, wird in init() zufällig gesetzt
      schriftgroesse: "mittel"
    },
    
    // Brief-Felder für die separate Bearbeitung
    briefFelder: {
      absender: "",
      empfaenger: "",
      ortDatum: "",
      betreff: "",
      brieftext: ""
    },
    
    // Cache-Konfiguration
    cacheEnabled: true,
    cacheTTL: 24 * 60 * 60 * 1000, // 24 Stunden in Millisekunden
    
    // "Meine Briefe" Konfiguration
    briefStorage: {
      storageKey: 'parlamentspost_briefe',
      maxPreviewBriefe: 3
    },
    showAlleBriefe: false,

    // Initialisierung
    async init() {
      // Dark Mode basierend auf Systemeinstellungen
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem("isDark") === null) {
        this.isDark = true;
        document.documentElement.classList.add("dark");
        localStorage.setItem("isDark", "true");
      }
      
      // Event-Listener für Änderungen der Systemeinstellung
      const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      darkModeMediaQuery.addEventListener('change', (e) => {
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
          log("INFO", "Dark Mode durch Systemeinstellung geändert", { isDark: this.isDark });
        }
      });
      
      // Zufällige Schriftart wählen
      this.formatierung.schriftart = this.getRandomFontFamily();
      
      // Topics beim Start laden
      await this.ladeTopics();
      
      // Lade Subtopics für das ausgewählte Topic
      await this.loadSubtopics();
      
      // "Meine Briefe"-Bereich aktualisieren
      this.updateMeineBriefeUI();
    },
    
    // Zufällige Schriftart auswählen
    getRandomFontFamily() {
      const fonts = [
        "Arial, sans-serif",
        "Times New Roman, serif",
        "Georgia, serif",
        "Verdana, sans-serif",
        "Calibri, sans-serif"
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
      document.body.style.transition = "background-color 0.5s ease, color 0.5s ease";
      setTimeout(() => {
        document.body.style.transition = "";
      }, 500);
    },
    
    // Alle Topics laden
    async ladeTopics() {
      this.isLoading = true;
      try {
        const response = await fetch('/api/v1/topics');
        if (!response.ok) {
          throw new Error("Fehler beim Laden der Topics");
        }
        
        this.topics = await response.json();
        log("INFO", "Topics geladen", { count: this.topics.length });
      } catch (error) {
        log("ERROR", "Fehler beim Laden der Topics", { message: error.message });
        alert(`Fehler beim Laden der Topics: ${error.message}`);
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
            block: "start" 
          });
        }
      }, 100);
    },
    
    // Cache-Management Methoden
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
          data: data
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        log("INFO", "Daten im Cache gespeichert", { ort, entries: data.length });
      } catch (error) {
        log("WARN", "Fehler beim Speichern im Cache", { error: error.message });
        // Bei Fehler (z.B. LocalStorage voll) Cache-Funktion deaktivieren
        this.cacheEnabled = false;
      }
    },
    
    clearAbgeordneteCache() {
      // Alle Cache-Einträge für Abgeordnete löschen
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('abgeordnete_')) {
            keys.push(key);
          }
        }
        
        keys.forEach(key => localStorage.removeItem(key));
        log("INFO", "Abgeordneten-Cache geleert", { entries: keys.length });
      } catch (error) {
        log("WARN", "Fehler beim Leeren des Caches", { error: error.message });
      }
    },
    
    // Subtopics vom Server laden
    async loadSubtopics() {
      this.isLoading = true;
      try {
        // Topic-Daten laden, falls noch nicht geschehen oder sich das Topic geändert hat
        if (!this.topicData || this.topicData.id !== this.topic) {
          const topicResponse = await fetch(`/api/v1/topics/${this.topic}`);
          if (topicResponse.ok) {
            this.topicData = await topicResponse.json();
            log("INFO", "Topic-Daten geladen", this.topicData);
          } else {
            throw new Error(`Fehler beim Laden des Topics ${this.topic}`);
          }
        }
        
        // Subtopics laden
        const response = await fetch(`/api/v1/topics/${this.topic}/subtopics`);
        if (!response.ok) {
          throw new Error("Fehler beim Laden der Subtopics");
        }
        
        this.availableSubtopics = await response.json();
        // Setze themen zurück, da wir neue Subtopics haben
        this.themen = [];
        
        log("INFO", "Subtopics geladen", { count: this.availableSubtopics.length });
      } catch (error) {
        log("ERROR", "Fehler beim Laden der Subtopics", { message: error.message });
        alert(`Fehler beim Laden der Subtopics: ${error.message}`);
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
        log("INFO", "Abgeordnete aus Cache geladen", { anzahl: cachedAbgeordnete.length });
        return;
      }

      this.isLoading = true; // Ladeindikator aktivieren
      log("INFO", "Starte Abruf der Abgeordneten", { ort: this.ort });

      try {
        // 1. Zuerst den Wahlkreis für den Ort abrufen
        const wahlkreisUrl = `/api/v1/BTW25/wahlkreis?wohnort=${encodeURIComponent(
          this.ort.trim()
        )}`;
        log("DEBUG", "Wahlkreis-API-URL", { url: wahlkreisUrl });

        const wahlkreisResponse = await fetch(wahlkreisUrl);
        log("DEBUG", "Wahlkreis-Antwort erhalten", {
          status: wahlkreisResponse.status,
          ok: wahlkreisResponse.ok,
        });

        const wahlkreisResponseText = await wahlkreisResponse.clone().text();
        log("DEBUG", "Wahlkreis-Antwort (Raw Text):", wahlkreisResponseText);

        if (!wahlkreisResponse.ok) {
          log(
            "ERROR",
            "Fehler beim Abrufen des Wahlkreises",
            wahlkreisResponseText
          );
          throw new Error("Fehler beim Abrufen des Wahlkreises.");
        }

        let wahlkreisData;
        try {
          wahlkreisData = JSON.parse(wahlkreisResponseText);
        } catch (error) {
          log("ERROR", "Fehler beim Parsen der Wahlkreis-Antwort", {
            rawText: wahlkreisResponseText,
            error: error.message,
          });
          throw new Error("Ungültige Antwort vom Server.");
        }

        log("INFO", "Wahlkreis-Daten erfolgreich abgerufen", wahlkreisData);

        // Prüfen, ob die Antwort ein Array oder ein einzelnes Objekt ist
        if (!wahlkreisData) {
          log("WARN", `Kein Wahlkreis für "${this.ort}" gefunden`);
          throw new Error(`Kein Wahlkreis für "${this.ort}" gefunden.`);
        }

        // Mehrere Wahlkreise werden als Array zurückgegeben
        let wahlkreise = [];
        if (Array.isArray(wahlkreisData)) {
          wahlkreise = wahlkreisData;
          log("INFO", "Mehrere Wahlkreise gefunden", wahlkreise);
        } else {
          // Ein einzelner Wahlkreis wird als Objekt zurückgegeben
          wahlkreise = [wahlkreisData];
          log("INFO", "Ein Wahlkreis gefunden", wahlkreise);
        }

        // Alle gefundenen Abgeordneten sammeln
        let alleAbgeordnete = [];

        // 2. Für jeden Wahlkreis die zugehörigen Abgeordneten abrufen
        for (const wahlkreis of wahlkreise) {
          if (!wahlkreis.wahlkreisNr) {
            log("WARN", `Wahlkreisnummer fehlt für Wahlkreis`, wahlkreis);
            continue; // Überspringe diesen Wahlkreis, wenn keine Nummer vorhanden
          }

          const abgeordneteUrl = `/api/v1/BTW25/abgeordnete?wahlkreis=${
            wahlkreis.wahlkreisNr
          }&wohnort=${encodeURIComponent(wahlkreis.wohnort)}`;
          log("DEBUG", "Abgeordnete-API-URL", { url: abgeordneteUrl });

          const abgeordneteResponse = await fetch(abgeordneteUrl);
          log("DEBUG", "Abgeordnete-Antwort erhalten", {
            status: abgeordneteResponse.status,
            ok: abgeordneteResponse.ok,
          });

          if (!abgeordneteResponse.ok) {
            log("WARN", `Keine Abgeordneten für Wahlkreis ${wahlkreis.wahlkreisNr} gefunden`);
            continue; // Mit dem nächsten Wahlkreis fortfahren
          }

          const abgeordnete = await abgeordneteResponse.json();
          log("INFO", `Abgeordnete für Wahlkreis ${wahlkreis.wahlkreisNr} erfolgreich abgerufen`, abgeordnete);

          // Füge Wahlkreisbezeichnung zu jedem Abgeordneten hinzu
          const abgeordneteMitWKB = abgeordnete.map(abg => ({
            ...abg,
            wkr_bezeichnung: wahlkreis.wahlkreisBez || "Unbekannter Wahlkreis"
          }));

          // Füge diese Abgeordneten zum Gesamtergebnis hinzu
          alleAbgeordnete = [...alleAbgeordnete, ...abgeordneteMitWKB];
        }

        // Deduplizieren der Abgeordneten basierend auf der ID
        this.abgeordneteListe = Array.from(
          new Map(alleAbgeordnete.map(item => [item.id, item])).values()
        );

        log("INFO", "Alle Abgeordneten zusammengeführt", this.abgeordneteListe);
        log("DEBUG", "Abgeordnete-Liste nach API-Aufruf", this.abgeordneteListe);

        if (this.abgeordneteListe.length === 0) {
          log("WARN", `Keine Abgeordneten für "${this.ort}" gefunden`);
          throw new Error(`Keine Abgeordneten für "${this.ort}" gefunden.`);
        }
        
        // Nach erfolgreicher Abfrage im Cache speichern
        if (this.abgeordneteListe.length > 0) {
          this.setCachedAbgeordnete(this.ort, this.abgeordneteListe);
        }
        
      } catch (error) {
        log("ERROR", "Fehler in holeAbgeordnete", { message: error.message });
        alert(`Fehler beim Abrufen der Abgeordneten: ${error.message}`);
        this.abgeordneteListe = [];
      } finally {
        this.isLoading = false; // Ladeindikator deaktivieren
        log("INFO", "Abruf der Abgeordneten abgeschlossen");
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
      const isAiGenerated = event.submitter.classList.contains('ai-button');
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
      const wahlkreisBez = abgeordneter?.wkr_bezeichnung || "Wahlkreis unbekannt";

      // Für Betreff und Anrede
      const vollerNameDesAbgeordneten = abgeordneter?.vollerName || "Unbekannt";
      const parteiDesAbgeordneten = abgeordneter?.partei || "Unbekannte Partei";

      // Anrede basierend auf Geschlecht
      const anrede = 
        abgeordneter?.geschlecht === "m" ? "Sehr geehrter Herr" :
        abgeordneter?.geschlecht === "w" ? "Sehr geehrte Frau" : 
        "Sehr geehrte:r";

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
        log("INFO", "Betreff aus gespeichertem Topic-Namen generiert", { betreff });
      } else {
        // Topic-Daten laden, falls noch nicht geschehen
        try {
          const topicResponse = await fetch(`/api/v1/topics/${this.topic}`);
          if (topicResponse.ok) {
            this.topicData = await topicResponse.json();
            if (this.topicData && this.topicData.name) {
              betreff = `Anliegen zum Thema: ${this.topicData.name}`;
              log("INFO", "Betreff aus frisch geladenem Topic-Namen generiert", { betreff });
            }
          }
        } catch (topicError) {
          log("WARN", "Fehler beim Laden des Topic-Namens für Betreff", { error: topicError.message });
          // Fallback-Betreff verwenden
        }
      }

      // Validierung von Freitext und Themen
      if (!this.freitext.trim() && this.themen.length === 0) {
        log("WARN", "Kein Freitext oder Thema angegeben");
        alert("Bitte einen Freitext oder mindestens ein Thema angeben.");
        return;
      }

      let brieftext = "";
      if (kiGeneriert) {
        this.isLoading = true;
        try {
          // Sammle Prompt-Blöcke der ausgewählten Subtopics
          const selectedSubtopics = this.availableSubtopics.filter(
            subtopic => this.themen.includes(subtopic.id)
          );
          
          const promptBlocks = selectedSubtopics.map(subtopic => subtopic.promptBlock);
          
          const userData = {
            topic: this.topicData,  // Wir geben die Topic-Daten mit, die wir bereits geladen haben
            selectedSubtopics,
            promptBlocks,
            freitext: this.freitext.trim(),
            abgeordneteName: vollerNameDesAbgeordneten,
            abgeordnetePartei: parteiDesAbgeordneten,
          };

          log("DEBUG", "Daten für KI-Generierung", userData);

          const response = await fetch("/api/v1/genai-brief", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userData }),
          });

          if (!response.ok) {
            const err = await response.json();
            log("ERROR", "Fehler bei der KI-Generierung", err);
            throw new Error(err.error || "Fehler bei der KI-Generierung.");
          }

          const data = await response.json();
          brieftext = `${anrede} ${abgeordneter?.name || "Unbekannt"},\n\n${data.briefText || "(Kein KI-Text vorhanden)"}\n\nMit freundlichen Grüßen,\n${this.name}`;
          log("INFO", "KI-Text erfolgreich generiert", { briefText: brieftext });
        } catch (error) {
          log("ERROR", "Fehler bei der KI-Abfrage", { message: error.message });
          alert(`Fehler bei der KI-Abfrage: ${error.message}`);
          return;
        } finally {
          this.isLoading = false;
        }
      } else {
        // Manuelle Erstellung mit subtopic-spezifischen Textblöcken
        const selectedSubtopics = this.availableSubtopics.filter(
          subtopic => this.themen.includes(subtopic.id)
        );
        
        const textBlocks = selectedSubtopics.map(subtopic => subtopic.textBlock).join("\n\n");
        
        // Prüfe, ob Themen ausgewählt wurden oder Freitext vorhanden ist
        const hasSubtopics = selectedSubtopics.length > 0;
        const hasFreitext = this.freitext.trim().length > 0;
        
        // Einleitung nur erstellen, wenn Themenblöcke ausgewählt wurden
        const subtopicsText = hasSubtopics 
          ? `Ich wende mich heute an Sie bezüglich folgender Themen: ${selectedSubtopics.map(subtopic => subtopic.name).join(", ")}.`
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
        brieftext: brieftext
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
      const exportButton = document.getElementById("export-pdf-button");
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
          email: this.email
        },
        empfaenger: {
          id: this.abgeordnete,
          abgeordneter: this.abgeordneteListe.find(a => String(a.id) === this.abgeordnete) || null
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
          briefText: this.briefFelder.brieftext
        },
        formatierung: {
          schriftart: this.formatierung.schriftart,
          schriftgroesse: this.formatierung.schriftgroesse
        }
      };

      log("INFO", "Brief wird im Local Storage gespeichert", { briefId: briefDaten.id });

      try {
        // Bestehende Briefe laden
        const briefe = this.ladeBriefe();
        
        // Neuen Brief hinzufügen
        briefe.push(briefDaten);
        
        // Zurück in Local Storage speichern
        localStorage.setItem(this.briefStorage.storageKey, JSON.stringify(briefe));
        
        // UI aktualisieren
        this.updateMeineBriefeUI();
        
        log("INFO", "Brief erfolgreich gespeichert", { id: briefDaten.id });
        
        return briefDaten.id;
      } catch (error) {
        log("ERROR", "Fehler beim Speichern des Briefes", { error: error.message });
        alert("Der Brief konnte nicht gespeichert werden: " + error.message);
        return null;
      }
    },

    // Generiert einen ansprechenden Titel für den Brief
    generateBriefTitel() {
      // Versuche den Empfänger zu bekommen
      const abgeordneter = this.abgeordneteListe.find(a => String(a.id) === this.abgeordnete);
      const empfaengerName = abgeordneter ? abgeordneter.vollerName : "Unbekannter Empfänger";
      
      // Versuche den Thementitel zu bekommen
      let themenTitel = "Allgemein";
      const selectedTopic = this.topics.find(t => t.id === this.topic);
      if (selectedTopic) {
        themenTitel = selectedTopic.name;
      }
      
      // Datum im kurzen Format
      const datum = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
      });
      
      // Titel zusammenstellen
      return `Brief an ${empfaengerName} - ${themenTitel} (${datum})`;
    },

    // Alle Briefe laden
    ladeBriefe(limit = null) {
      try {
        // Aus dem Local Storage laden
        const briefeJson = localStorage.getItem(this.briefStorage.storageKey);
        if (!briefeJson) {
          return [];
        }
        
        // In Objekt umwandeln
        let briefe = JSON.parse(briefeJson);
        
        // Nach Datum sortieren (neueste zuerst)
        briefe.sort((a, b) => new Date(b.zeitstempel) - new Date(a.zeitstempel));
        
        // Optional begrenzen
        if (limit !== null && Number.isInteger(limit) && limit > 0) {
          briefe = briefe.slice(0, limit);
        }
        
        log("INFO", "Briefe aus Local Storage geladen", { count: briefe.length });
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
        const brief = briefe.find(b => b.id === id);
        
        if (!brief) {
          log("WARN", `Brief mit ID ${id} nicht gefunden`);
          return null;
        }
        
        log("INFO", `Brief ${id} geladen`);
        return brief;
      } catch (error) {
        log("ERROR", `Fehler beim Laden des Briefs ${id}`, { error: error.message });
        return null;
      }
    },

    // Brief löschen
    loescheBrief(id) {
      try {
        // Alle Briefe laden
        const briefe = this.ladeBriefe();
        
        // Brief mit der ID filtern
        const filteredBriefe = briefe.filter(b => b.id !== id);
        
        // Wenn keine Änderung, dann wurde der Brief nicht gefunden
        if (filteredBriefe.length === briefe.length) {
          log("WARN", `Brief mit ID ${id} konnte nicht gelöscht werden (nicht gefunden)`);
          return false;
        }
        
        // Aktualisierte Liste speichern
        localStorage.setItem(this.briefStorage.storageKey, JSON.stringify(filteredBriefe));
        
        // UI aktualisieren
        this.updateMeineBriefeUI();
        
        log("INFO", `Brief ${id} gelöscht`);
        return true;
      } catch (error) {
        log("ERROR", `Fehler beim Löschen des Briefs ${id}`, { error: error.message });
        return false;
      }
    },

    // Alle Briefe löschen
    loescheAlleBriefe() {
      try {
        localStorage.removeItem(this.briefStorage.storageKey);
        
        // UI aktualisieren
        this.updateMeineBriefeUI();
        
        log("INFO", "Alle Briefe gelöscht");
        return true;
      } catch (error) {
        log("ERROR", "Fehler beim Löschen aller Briefe", { error: error.message });
        return false;
      }
    },

    // Brief in die globalen Daten laden und bearbeiten können
    briefBearbeiten(id) {
      try {
        // Brief laden
        const brief = this.ladeBrief(id);
        if (!brief) {
          alert("Der Brief konnte nicht geladen werden.");
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
          brieftext: brief.briefInhalt.briefText || ""
        };
        
        // Formatierung setzen
        this.formatierung = {
          schriftart: brief.formatierung.schriftart || "Arial, sans-serif",
          schriftgroesse: brief.formatierung.schriftgroesse || "mittel"
        };
        
        // Briefvorschau aktivieren
        this.aktiviereBriefvorschau();
        
        // Zum Formular scrollen
        setTimeout(() => {
          const formElement = document.getElementById("user-form");
          if (formElement) {
            formElement.scrollIntoView({ 
              behavior: "smooth", 
              block: "start" 
            });
          }
        }, 100);
        
        log("INFO", `Brief ${id} zur Bearbeitung geladen`);
        return true;
      } catch (error) {
        log("ERROR", `Fehler beim Laden des Briefs ${id} zur Bearbeitung`, { error: error.message });
        alert(`Fehler beim Laden des Briefs: ${error.message}`);
        return false;
      }
    },

    // Aktualisierung des "Meine Briefe"-UI-Bereichs
    updateMeineBriefeUI() {
      // Überprüfen wir, ob Briefe vorhanden sind
      const briefe = this.ladeBriefe(this.briefStorage.maxPreviewBriefe);
      const meineBriefeBereich = document.getElementById("meine-briefe-bereich");
      
      if (meineBriefeBereich) {
        if (briefe.length > 0) {
          meineBriefeBereich.classList.remove("hidden");
        } else {
          meineBriefeBereich.classList.add("hidden");
        }
      }
    }
  };
}