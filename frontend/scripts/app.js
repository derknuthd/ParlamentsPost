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

    // Persönliche Daten
    name: "",
    straße: "",
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

    // Initialisierung
    async init() {
      // Dark Mode basierend auf Systemeinstellungen
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && localStorage.getItem("isDark") === null) {
        this.isDark = true;
        document.documentElement.classList.add("dark");
        localStorage.setItem("isDark", "true");
      }
      
      // NEU: Event-Listener für Änderungen der Systemeinstellung
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
      
      // Lade Subtopics für das statische Topic
      await this.loadSubtopics();
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
      
      // NEU: Markieren, dass der Nutzer manuell umgeschaltet hat
      localStorage.setItem("isDarkUserSet", "true");
      
      // NEU: Animation für sanfteren Übergang hinzufügen
      document.body.style.transition = "background-color 0.5s ease, color 0.5s ease";
      setTimeout(() => {
        document.body.style.transition = "";
      }, 500);
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
        // Topic-Daten laden
        const topicResponse = await fetch(`/api/v1/topics/${this.topic}`);
        if (topicResponse.ok) {
          this.topicData = await topicResponse.json();
          log("INFO", "Topic-Daten geladen", this.topicData);
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
      const absender = `${this.name}\n${this.straße}\n${this.plz} ${this.ort}`;
      
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
      const empfänger = `${vollerNameDesAbgeordneten}
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
        empfaenger: empfänger,
        ortDatum: ortUndDatum,
        betreff: betreff,
        brieftext: brieftext
      };

      log("INFO", "Brieffelder erstellt", this.briefFelder);
      
      // Briefvorschau aktivieren
      this.aktiviereBriefvorschau();
    },

    aktiviereBriefvorschau() {
      log("INFO", "Aktiviere Briefvorschau");
      
      // Wir müssen die DOM-Elemente nicht mehr manuell aktualisieren, 
      // da Alpine.js das über die x-html Bindings automatisch tut
      
      // Export-Button aktivieren
      const exportButton = document.getElementById("export-pdf-button");
      if (exportButton) {
        exportButton.disabled = false;
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
    }
  };
}