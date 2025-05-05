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

    name: "",
    straße: "",
    plz: "",
    ort: "",
    email: "",

    themen: [],
    freitext: "",

    abgeordnete: "",
    abgeordneteListe: [],
    isLoading: false, // Ladeindikator
    
    // Cache-Konfiguration
    cacheEnabled: true,
    cacheTTL: 24 * 60 * 60 * 1000, // 24 Stunden in Millisekunden

    // Dark Mode Toggle Methode
    toggleDarkMode() {
      this.isDark = !this.isDark;
      log("INFO", "Dark Mode umgeschaltet", { isDark: this.isDark });
      if (this.isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("isDark", "true");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("isDark", "false");
      }
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

    // Hier die angepasste holeAbgeordnete()-Methode mit Cache-Integration
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

      // Absender, Ort/Datum und Wahlkreis
      const absender = `${this.name}\n${this.straße}\n${this.plz} ${this.ort}`;
      const aktuellesDatum = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const ortUndDatum = `${this.ort}, den ${aktuellesDatum}`;

      const abgeordneter = this.abgeordneteListe.find(
        (a) => String(a.id) === this.abgeordnete
      );
      const wahlkreisBez =
        abgeordneter?.wkr_bezeichnung || "Wahlkreis unbekannt";

      // Verwende "vollerName" und "partei" aus der JSON-Datei
      const vollerNameDesAbgeordneten = abgeordneter?.vollerName || "Unbekannt";
      const parteiDesAbgeordneten = abgeordneter?.partei || "Unbekannte Partei";

      // Adresse des Adressaten (abhängig vom Parlament)
      let empfänger = "";

      if (parlament === "Bundestag") {
        empfänger = `
${vollerNameDesAbgeordneten}
Deutscher Bundestag
Platz der Republik 1
11011 Berlin
        `.trim();
      }

      // Validierung von Freitext und Themen
      if (!this.freitext.trim() && this.themen.length === 0) {
        log("WARN", "Kein Freitext oder Thema angegeben");
        alert("Bitte einen Freitext oder mindestens ein Thema angeben.");
        return;
      }

      let inhalt;
      if (kiGeneriert) {
        this.isLoading = true;
        try {
          const userData = {
            ...(this.themen.length > 0 && { themen: this.themen }),
            ...(this.freitext.trim() && { freitext: this.freitext.trim() }),
            // Verwende "vollerName" und "partei" für die KI
            abgeordneteName: vollerNameDesAbgeordneten,
            abgeordnetePartei: parteiDesAbgeordneten,
          };

          log("DEBUG", "Daten für KI-Generierung", userData);

          const response = await fetch("/api/genai-brief", {
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
          inhalt = data.briefText || "(Kein KI-Text vorhanden)";
          log("INFO", "KI-Text erfolgreich generiert", { briefText: inhalt });
        } catch (error) {
          log("ERROR", "Fehler bei der KI-Abfrage", { message: error.message });
          alert(`Fehler bei der KI-Abfrage: ${error.message}`);
          return;
        } finally {
          this.isLoading = false;
        }
      } else {
        // Manuelle Erstellung
        inhalt = `
      Ich wende mich heute an Sie bezüglich folgender Themen: ${this.themen.join(
        ", "
      )}.

      ${this.freitext}
          `.trim();
        log("INFO", "Manueller Briefinhalt erstellt", { inhalt });
      }

      // Brieftext zusammenstellen
      const anrede =
        abgeordneter?.geschlecht === "m"
          ? "Sehr geehrter Herr"
          : abgeordneter?.geschlecht === "w"
          ? "Sehr geehrte Frau"
          : "Hallo";

      // Verwende "name" für die Anrede
      const briefText = `
    ${absender}

    ${empfänger}

    ${ortUndDatum}

    Wahlkreis: ${wahlkreisBez}

    ${anrede} ${abgeordneter?.name || "Unbekannt"},

    ${inhalt}

    Mit freundlichen Grüßen,
    ${this.name}
        `.trim();

      log("INFO", "Brieftext erstellt", { briefText });
      this.zeigeVorschau(briefText);
    },

    zeigeVorschau(briefText) {
      log("INFO", "Zeige Briefvorschau", { briefText });
      const vorschauInhalt = document.getElementById("vorschau-inhalt");
      vorschauInhalt.innerHTML = briefText.replace(/\n/g, "<br>"); // Formatierung beibehalten
      const briefVorschau = document.getElementById("briefvorschau");
      const generierenButton = document.getElementById("export-pdf-button");
      generierenButton.disabled = false; // Button aktivieren
      briefVorschau.scrollIntoView({ behavior: "smooth" });
    },

    briefDrucken() {
      log("INFO", "Brief wird gedruckt");
      window.print();
    },
  };
}