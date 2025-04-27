//frontend/scipts/app.js
// Logging-Funktion
const LOG_LEVEL = "DEBUG"; // Direkt definierter Log-Level (DEBUG, INFO, WARN, ERROR)
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

    async holeAbgeordnete() {
      if (!this.ort.trim()) {
        log("WARN", "Kein Wohnort eingegeben");
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

        if (!wahlkreisData || !wahlkreisData.wahlkreisNr) {
          log("WARN", `Kein Wahlkreis für "${this.ort}" gefunden`);
          throw new Error(`Kein Wahlkreis für "${this.ort}" gefunden.`);
        }

        // 2. Mit der Wahlkreisnummer die Abgeordneten abrufen
        const abgeordneteUrl = `/api/v1/BTW25/abgeordnete?wahlkreis=${
          wahlkreisData.wahlkreisNr
        }&wohnort=${encodeURIComponent(this.ort.trim())}`;
        log("DEBUG", "Abgeordnete-API-URL", { url: abgeordneteUrl });

        const abgeordneteResponse = await fetch(abgeordneteUrl);
        log("DEBUG", "Abgeordnete-Antwort erhalten", {
          status: abgeordneteResponse.status,
          ok: abgeordneteResponse.ok,
        });

        const abgeordneteResponseText = await abgeordneteResponse
          .clone()
          .text();
        log(
          "DEBUG",
          "Abgeordnete-Antwort (Raw Text):",
          abgeordneteResponseText
        );

        if (!abgeordneteResponse.ok) {
          const err = await abgeordneteResponse.json();
          log("ERROR", "Fehler beim Abrufen der Abgeordneten", err);
          throw new Error(err.error || "Fehler beim Abrufen der Abgeordneten.");
        }

        this.abgeordneteListe = await abgeordneteResponse.json();
        log("INFO", "Abgeordnete erfolgreich abgerufen", this.abgeordneteListe);
        log(
          "DEBUG",
          "Abgeordnete-Liste nach API-Aufruf",
          this.abgeordneteListe
        );

        // Für die Anzeige im Format "WahlkreisName: Abgeordnete (Partei), wohnhaft in Wohnort"
        this.abgeordneteListe = this.abgeordneteListe.map((abg) => ({
          ...abg,
          wkr_bezeichnung:
            wahlkreisData.wahlkreisBez || "Unbekannter Wahlkreis",
        }));
        log(
          "DEBUG",
          "Abgeordnete-Liste mit Bezeichnungen",
          this.abgeordneteListe
        );
      } catch (error) {
        log("ERROR", "Fehler in holeAbgeordnete", { message: error.message });
        alert(`Fehler beim Abrufen der Abgeordneten: ${error.message}`);
        this.abgeordneteListe = [];
      } finally {
        this.isLoading = false; // Ladeindikator deaktivieren
        log("INFO", "Abruf der Abgeordneten abgeschlossen");
      }
    },

    async generiereBrief(kiGeneriert = false) {
      log("INFO", "Starte Briefgenerierung", { kiGeneriert });

      const plzPattern = /^\d{5}$/;
      if (!plzPattern.test(this.plz)) {
        log("WARN", "Ungültige PLZ eingegeben", { plz: this.plz });
        alert("Bitte eine gültige 5-stellige PLZ eingeben.");
        return;
      }

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
