// app.js
import { config } from './config.js';
import { userDataModule } from './modules/userDataModule.js';
import { briefModule } from './modules/briefModule.js';
import { topicModule } from './modules/topicModule.js';
import { uiModule } from './modules/uiModule.js';
import { eventModule } from './modules/eventModule.js';
import { apiService } from './services/apiService.js';
import { themeService } from './services/themeService.js';
import { logService } from './services/logService.js';

// Export der Alpine.js App-Funktionalität
export function parlamentspostApp() {
  // Module laden
  const userData = userDataModule();
  const brief = briefModule();
  const topic = topicModule();
  const ui = uiModule();
  const events = eventModule();
  
  return {
    // Konfiguration verfügbar machen
    config,

    // Kombinieren aller Module
    ...userData,
    ...brief,
    ...topic,
    ...ui,
    ...events,
    
    // Gemeinsame Hauptkonfiguration
    get briefStorage() { return config.briefStorage; },
    
    // Initialisierung
    async init() {
      // EventBus initialisieren
      this.initEventBus();
      
      // Lokale Kopie initial setzen
      this._isOnline = apiService.isOnline;
      
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
      this.gespeicherteBriefe = this.ladeBriefe();
      
      // "Meine Briefe"-Bereich aktualisieren
      this.updateMeineBriefeUI();
    },
    
    // Brief generieren
    async generiereBrief(kiGeneriert = false) {
      logService.info("Starte Briefgenerierung", { kiGeneriert });
      
      // Starte den Timer für die Ladezeit
      this.startLoadingTimer();
      
      // Lade-Status aktivieren
      this.isLoading = true;
    
      try {
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
          this.showNotification(
            "Bitte einen Freitext oder mindestens ein Thema angeben.",
            "warning"
          );
          return;
        }
        
        let brieftext = "";
        
        if (kiGeneriert) {
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
            this.showNotification(
              `Fehler bei der KI-Abfrage: ${error.message}`,
              "error"
            );
            return; // Briefgenerierung abbrechen
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
      } finally {
        // Lade-Status deaktivieren und Timer anhalten - wird IMMER ausgeführt
        this.isLoading = false;
        this.stopLoadingTimer();
      }
    }
  };
}