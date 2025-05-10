// briefModule.js
import { logService } from '../services/logService.js';
import { briefService } from '../services/briefService.js';
import { notificationService } from '../services/notificationService.js';

export function briefModule() {
  return {
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
    showAlleBriefe: false,
    gespeicherteBriefe: [],
    
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
  };
}