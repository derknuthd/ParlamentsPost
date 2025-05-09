import { cacheService } from './services/cacheService.js';
import { apiService } from './services/apiService.js';
import { logService } from './services/logService.js';
import { notificationService } from './services/notificationService.js';
import { briefService } from './services/briefService.js';
import { themeService } from './services/themeService.js';
import { config } from './config.js';
import { briefModel } from './models/briefModel.js';

// Export der Alpine.js App-Funktionalität
export function parlamentspostApp() {
  return {
    // Zustandsvariablen
    isLoading: false,
    
    // Dark Mode (vom ThemeService verwaltet)
    get isDark() { return themeService.isDark; },
    
    // Netzwerkstatus (vom ApiService verwaltet)
    get isOnline() { return apiService.isOnline; },
    
    // Benachrichtigungen (vom NotificationService verwaltet)
    get notifications() { return notificationService.notifications; },
    
    // Persönliche Daten
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    email: "",
    
    // Themen und Freitext
    themen: [],
    freitext: "",
    
    // Abgeordnete
    abgeordnete: "",
    abgeordneteListe: [],
    
    // Topic-System
    topic: "afd_parteiverbotsverfahren", // Standard-Topic
    topics: [],
    topicData: null,
    availableSubtopics: [],
    
    // Cache-Status-Indikatoren
    topicLoadedFromCache: false,
    subtopicsLoadedFromCache: false,
    
    // Brief-Formatierung
    formatierung: {
      schriftart: "Arial, sans-serif",
      schriftgroesse: "mittel",
    },
    
    // Brief-Felder
    briefFelder: {
      absender: "",
      empfaenger: "",
      ortDatum: "",
      betreff: "",
      brieftext: "",
    },
    
    // "Meine Briefe" Konfiguration
    get briefStorage() { return config.briefStorage; },
    showAlleBriefe: false,
    gespeicherteBriefe: [],

    // Verfügbare Schriftarten (zentrale Liste)
    fonts: [
      // Seriöse Sans-Serif-Schriftarten (hohe Systemkompatibilität)
      "Arial, Helvetica, sans-serif",
      "Verdana, Geneva, sans-serif",
      "Tahoma, Geneva, sans-serif",
      "Trebuchet MS, Helvetica, sans-serif",
      "Segoe UI, Roboto, sans-serif",
      "Helvetica Neue, Helvetica, Arial, sans-serif",
      
      // Seriöse Serif-Schriftarten (hohe Systemkompatibilität)
      "Times New Roman, Times, serif",
      "Georgia, Times, serif",
      "Palatino Linotype, Book Antiqua, Palatino, serif",
      "Cambria, Georgia, serif",
      
      // Moderne, saubere Schriftarten
      "Calibri, Roboto, sans-serif",
      "Century Gothic, Apple Gothic, sans-serif",
      "Gill Sans, Gill Sans MT, sans-serif",
      
      // Monospace-Schriftarten
      "Courier New, Courier, monospace",
      "Lucida Console, Monaco, monospace",
      "Consolas, Liberation Mono, monospace",
      
      // Weniger formelle Schriftarten
      "Comic Sans MS, Comic Sans, cursive",
      "Brush Script MT, Brush Script Std, cursive",
      
      // Dekorative Schriftarten
      "Papyrus, fantasy",
      "Impact, Charcoal, sans-serif",
      "Arial Rounded MT Bold, Helvetica Rounded, sans-serif",
      
      // Sehr ausgefallene Schriftarten
      "Copperplate, Copperplate Gothic Light, fantasy",
      "Lucida Handwriting, cursive"
    ],

    // Initialisierung
    async init() {
      // Dark Mode initialisieren
      themeService.init();
      
      // API-Service initialisieren
      apiService.init();
      
      // Log-Level setzen
      logService.logLevel = config.logLevel;
      
      // Zufällige Schriftart wählen und explizit setzen
      const randomFont = this.getRandomFontFamily();
      console.log("Setze initiale Schriftart auf:", randomFont);
      this.formatierung.schriftart = randomFont;
      
      // Zufällige Schriftgröße wählen
      const sizes = ["klein", "mittel", "gross"];
      const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
      console.log("Setze initiale Schriftgröße auf:", randomSize);
      this.formatierung.schriftgroesse = randomSize;

      // Initiale Daten im Hintergrund laden
      this.loadInitialDataInBackground();
      
      // Gespeicherte Briefe laden
      this.gespeicherteBriefe = briefService.ladeBriefe();
      
      // "Meine Briefe"-Bereich aktualisieren
      this.updateMeineBriefeUI();
    },
    
    // Themenbezogene Methoden
    
    // Zufällige Schriftart auswählen
    // Zufällige Schriftart auswählen
    getRandomFontFamily() {
      // Direkte Liste statt this.fonts verwenden
      const fonts = [
        // Seriöse Sans-Serif-Schriftarten (hohe Systemkompatibilität)
        "Arial, Helvetica, sans-serif",
        "Verdana, Geneva, sans-serif",
        "Tahoma, Geneva, sans-serif",
        "Trebuchet MS, Helvetica, sans-serif",
        "Segoe UI, Roboto, sans-serif",
        "Helvetica Neue, Helvetica, Arial, sans-serif",
        
        // Seriöse Serif-Schriftarten (hohe Systemkompatibilität)
        "Times New Roman, Times, serif",
        "Georgia, Times, serif",
        "Palatino Linotype, Book Antiqua, Palatino, serif",
        "Cambria, Georgia, serif",
        
        // Moderne, saubere Schriftarten
        "Calibri, Roboto, sans-serif",
        "Century Gothic, Apple Gothic, sans-serif",
        "Gill Sans, Gill Sans MT, sans-serif",
        
        // Monospace-Schriftarten
        "Courier New, Courier, monospace",
        "Lucida Console, Monaco, monospace",
        "Consolas, Liberation Mono, monospace",
        
        // Weniger formelle Schriftarten
        "Comic Sans MS, Comic Sans, cursive",
        "Brush Script MT, Brush Script Std, cursive",
        
        // Dekorative Schriftarten
        "Papyrus, fantasy",
        "Impact, Charcoal, sans-serif",
        "Arial Rounded MT Bold, Helvetica Rounded, sans-serif",
        
        // Sehr ausgefallene Schriftarten
        "Copperplate, Copperplate Gothic Light, fantasy",
        "Lucida Handwriting, cursive"
      ];
      
      const randomIndex = Math.floor(Math.random() * fonts.length);
      const selectedFont = fonts[randomIndex];
      console.log("Zufällig ausgewählte Schriftart:", selectedFont, "Index:", randomIndex);
      return selectedFont;
    },
    
    // Dark Mode umschalten
    toggleDarkMode() {
      themeService.toggleDarkMode();
    },
    
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
    
    // Abgeordnete holen
    async holeAbgeordnete() {
      if (!this.ort.trim()) {
        logService.warn("Kein Wohnort eingegeben");
        return;
      }
      
      // Versuche zuerst, Daten aus dem Cache zu laden
      const cachedAbgeordnete = cacheService.getAbgeordneteCache(this.ort);
      if (cachedAbgeordnete) {
        this.abgeordneteListe = cachedAbgeordnete;
        logService.info("Abgeordnete aus Cache geladen", {
          anzahl: cachedAbgeordnete.length,
        });
        return;
      }
      
      // Überprüfe Online-Status
      if (!apiService.isOnline) {
        notificationService.showNotification(
          "Keine Netzwerkverbindung und keine Cache-Daten für den eingegebenen Ort",
          "warning"
        );
        return;
      }
      
      this.isLoading = true; // Ladeindikator aktivieren
      
      try {
        // Abgeordnete über den API-Service laden
        const abgeordnete = await apiService.getAbgeordnete(this.ort);
        this.abgeordneteListe = abgeordnete;
        
        if (abgeordnete.length === 0) {
          notificationService.showNotification(
            `Keine Abgeordneten für "${this.ort}" gefunden.`,
            "warning"
          );
        }
        
        return abgeordnete;
      } catch (error) {
        logService.error("Fehler in holeAbgeordnete", { message: error.message });
        notificationService.showNotification(
          `Fehler beim Abrufen der Abgeordneten: ${error.message}`,
          "error"
        );
        this.abgeordneteListe = [];
        return [];
      } finally {
        this.isLoading = false; // Ladeindikator deaktivieren
      }
    },
    
    // Formularvalidierung und Briefgenerierung
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
    
    // Brief generieren
    async generiereBrief(kiGeneriert = false) {
      logService.info("Starte Briefgenerierung", { kiGeneriert });
      
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
        logService.info("Betreff aus gespeichertem Topic-Namen generiert", {
          betreff,
        });
      }
      
      // Validierung von Freitext und Themen
      if (!this.freitext.trim() && this.themen.length === 0) {
        logService.warn("Kein Freitext oder Thema angegeben");
        notificationService.showNotification(
          "Bitte einen Freitext oder mindestens ein Thema angeben.",
          "warning"
        );
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
          
          const userData = {
            topic: this.topicData,
            selectedSubtopics,
            freitext: this.freitext.trim(),
            abgeordneteName: vollerNameDesAbgeordneten,
            abgeordnetePartei: parteiDesAbgeordneten,
          };
          
          logService.debug("Daten für KI-Generierung", userData);
          
          // KI-Brief über API-Service generieren
          const data = await apiService.generateAiBrief(userData);
          
          brieftext = `${anrede} ${abgeordneter?.name || "Unbekannt"},\n\n${
            data.briefText || "(Kein KI-Text vorhanden)"
          }\n\nMit freundlichen Grüßen,\n\n\n${this.name}`;
          
          logService.info("KI-Text erfolgreich generiert");
        } catch (error) {
          logService.error("Fehler bei der KI-Abfrage", { message: error.message });
          notificationService.showNotification(
            `Fehler bei der KI-Abfrage: ${error.message}`,
            "error"
          );
          return; // Briefgenerierung abbrechen
        } finally {
          this.isLoading = false;
        }
      } else {
        // Falls conclusion fehlt, Topic nachladen
       if (!this.topicData?.conclusion) {
         try {
           this.topicData = await apiService.getTopic(this.topic);
         } catch (error) {
           logService.warn("Konnte conclusion nicht nachladen", { error: error.message });
         }
       }
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
        
        // HIER den Conclusion-Text hinzufügen:
        if (this.topicData && this.topicData.conclusion) {
          brieftext += `\n\n${this.topicData.conclusion}`;
        }

        // Füge Grußformel am Ende hinzu
        brieftext += `\n\nMit freundlichen Grüßen,\n\n\n${this.name}`;
        
        logService.info("Manueller Briefinhalt erstellt");
      }
      
      // Brieffelder setzen
      this.briefFelder = {
        absender: absender,
        empfaenger: empfaenger,
        ortDatum: ortUndDatum,
        betreff: betreff,
        brieftext: brieftext,
      };
      
      logService.info("Brieffelder erstellt");
      
      // Briefvorschau aktivieren
      this.aktiviereBriefvorschau();
      
      // Den Brief automatisch im Local Storage speichern
      this.speichereBrief();
      
      // "Meine Briefe"-Bereich aktualisieren
      this.updateMeineBriefeUI();
    },
    
    // Briefvorschau aktivieren
    aktiviereBriefvorschau() {
      logService.info("Aktiviere Briefvorschau");
      
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
    
    // Brief drucken
    briefDrucken() {
      logService.info("Brief wird gedruckt");
      window.print();
    },
    
    // "Meine Briefe"-Funktionen
    
    // Brief speichern
    speichereBrief() {
      // Sammle alle relevanten Daten
      const briefDaten = {
        titel: briefService.generateBriefTitel(
          this.abgeordneteListe.find((a) => String(a.id) === this.abgeordnete),
          this.topicData
        ),
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
      
      const briefId = briefService.speichereBrief(briefDaten);
      
      if (briefId) {
        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = briefService.ladeBriefe();
        
        // UI aktualisieren
        this.updateMeineBriefeUI();
        
        // Scrolle zum "Meine Briefe"-Bereich
        const meineBriefeBereich = document.getElementById("meine-briefe-bereich");
        if (meineBriefeBereich) {
          meineBriefeBereich.scrollIntoView({ behavior: "smooth" });
        }
        
        return briefId;
      }
      
      return null;
    },
    
    // Briefe laden
    ladeBriefe(limit = null) {
      return briefService.ladeBriefe(limit);
    },
    
    // Brief bearbeiten
    briefBearbeiten(id) {
      try {
        // Brief laden
        const brief = briefService.ladeBrief(id);
        if (!brief) {
          notificationService.showNotification(
            "Der Brief konnte nicht geladen werden.",
            "error"
          );
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
        
        return true;
      } catch (error) {
        logService.error(`Fehler beim Laden des Briefs ${id} zur Bearbeitung`, {
          error: error.message,
        });
        notificationService.showNotification(
          `Fehler beim Laden des Briefs: ${error.message}`,
          "error"
        );
        return false;
      }
    },
    
    // Brief löschen
    loescheBrief(id) {
      const result = briefService.loescheBrief(id);
      
      if (result) {
        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = briefService.ladeBriefe();
        
        // UI aktualisieren
        this.updateMeineBriefeUI();
        
        notificationService.showNotification(
          "Brief wurde erfolgreich gelöscht",
          "success"
        );
      } else {
        notificationService.showNotification(
          "Der Brief konnte nicht gelöscht werden",
          "error"
        );
      }
      
      return result;
    },
    
    // Alle Briefe löschen
    loescheAlleBriefe() {
      const result = briefService.loescheAlleBriefe();
      
      if (result) {
        // Reaktive Eigenschaft aktualisieren
        this.gespeicherteBriefe = briefService.ladeBriefe();
        
        // UI aktualisieren
        this.updateMeineBriefeUI();
        
        notificationService.showNotification(
          "Alle Briefe wurden erfolgreich gelöscht",
          "success"
        );
      } else {
        notificationService.showNotification(
          "Die Briefe konnten nicht gelöscht werden",
          "error"
        );
      }
      
      return result;
    },
    
    // "Meine Briefe"-UI-Bereich aktualisieren
    updateMeineBriefeUI() {
      // Überprüfen wir, ob Briefe vorhanden sind
      const briefe = this.ladeBriefe(this.briefStorage.maxPreviewBriefe);
      const meineBriefeBereich = document.getElementById("meine-briefe-bereich");
      
      // Diese Zeile ist wichtig: Explizit die reaktive Variable aktualisieren
      this.gespeicherteBriefe = this.ladeBriefe();
      
      if (meineBriefeBereich) {
        if (briefe.length > 0) {
          meineBriefeBereich.classList.remove("hidden");
        } else {
          meineBriefeBereich.classList.add("hidden");
        }
      }
    },
    
    // Benachrichtigung entfernen
    removeNotification(id) {
      notificationService.removeNotification(id);
    },
    
    // Benachrichtigung anzeigen
    showNotification(message, type = 'info', duration = 5000) {
      return notificationService.showNotification(message, type, duration);
    },
    
    // Cache leeren
    clearAllCache() {
      const count = cacheService.clearAllCache();
      
      if (count > 0) {
        notificationService.showNotification(
          `Cache erfolgreich geleert (${count} Einträge gelöscht)`,
          "success"
        );
      } else {
        notificationService.showNotification(
          "Kein Cache zum Leeren gefunden",
          "info"
        );
      }
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