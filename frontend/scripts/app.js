//frontend/scipts/app.js
document.addEventListener('DOMContentLoaded', () => {
const menuButton = document.getElementById('menu-button');
const mobileNav = document.getElementById('mobile-nav');
    if (menuButton) {
        menuButton.addEventListener('click', () => {
        mobileNav.classList.toggle('hidden');
        });
    }
});

function parlamentspostApp() {
    return {
      // Dark Mode Zustand
      isDark: localStorage.getItem('isDark') === 'true',

      name: '',
      straße: '',
      plz: '',
      ort: '',
      email: '',
      themen: [],
      freitext: '',
      abgeordnete: '',
      abgeordneteListe: [],
      isLoading: false, // Ladeindikator

      // Dark Mode Toggle Methode
      toggleDarkMode() {
        this.isDark = !this.isDark;
        if (this.isDark) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('isDark', 'true');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('isDark', 'false');
        }
      },

      async holeAbgeordnete() {
        if (!this.ort.trim()) return;
        this.isLoading = true; // Ladeindikator aktivieren
        try {
          const response = await fetch('http://localhost:3000/api/abgeordnete-by-adresse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ort: this.ort.trim() })
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Fehler beim Abrufen der Abgeordneten.');
          }
          this.abgeordneteListe = await response.json();
        } catch (error) {
          alert(`Fehler beim Abrufen der Abgeordneten: ${error.message}`);
          console.error(error);
        } finally {
          this.isLoading = false; // Ladeindikator deaktivieren
        }
      },

      // Alte / manuelle Briefvorschau
      generiereBrief() {
        const plzPattern = /^\d{5}$/;
        if (!plzPattern.test(this.plz)) {
          alert('Bitte eine gültige 5-stellige PLZ eingeben.');
          return;
        }

        const abgeordneter = this.abgeordneteListe.find(a => String(a.id) === this.abgeordnete);
        const wahlkreisBez = abgeordneter?.wkr_bezeichnung || 'Wahlkreis unbekannt';
        const nameDesAbgeordneten = abgeordneter ? `${abgeordneter.name} (${abgeordneter.partei})` : 'Unbekannt';

        const briefText = `
Wahlkreis: ${wahlkreisBez}

Sehr geehrte/r Frau/Herr ${nameDesAbgeordneten.split(' (')[0]},

mein Name ist ${this.name} und ich wohne in ${this.straße}, ${this.plz} ${this.ort}.
Ich wende mich heute an Sie bezüglich folgender Themen: ${this.themen.join(', ')}.

${this.freitext}

Mit freundlichen Grüßen,
${this.name}
        `.trim();

        this.zeigeVorschau(briefText);
      },

      // NEU: KI-Variante
      async generiereBriefMitKI() {
        // Dieselbe Prüfung wie oben
        const plzPattern = /^\d{5}$/;
        if (!plzPattern.test(this.plz)) {
          alert('Bitte eine gültige 5-stellige PLZ eingeben.');
          return;
        }

        const abgeordneter = this.abgeordneteListe.find(a => String(a.id) === this.abgeordnete);
        const nameDesAbgeordneten = abgeordneter ? `${abgeordneter.name} (${abgeordneter.partei})` : 'Unbekannt';

        // Erstelle ein Objekt mit den nötigen Feldern
        const userData = {
          name: this.name,
          straße: this.straße,
          plz: this.plz,
          ort: this.ort,
          themen: this.themen,
          freitext: this.freitext,
          abgeordneteName: nameDesAbgeordneten
        };

        this.isLoading = true; // Ladeindikator aktivieren
        try {
          // Ruf den neuen Endpoint an
          const response = await fetch('http://localhost:3000/api/genai-brief', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userData })
          });
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Fehler bei der KI-Generierung.');
          }
          const data = await response.json();
          const kiText = data.briefText || '(Kein KI-Text vorhanden)';

          this.zeigeVorschau(kiText);
        } catch (error) {
          alert(`Fehler bei der KI-Abfrage: ${error.message}`);
          console.error(error);
        } finally {
          this.isLoading = false; // Ladeindikator deaktivieren
        }
      },

      // Vorschau anzeigen und smooth scrollen
      zeigeVorschau(briefText) {
        const vorschauInhalt = document.getElementById('vorschau-inhalt');
        vorschauInhalt.innerHTML = briefText.replace(/\n/g, '<br>'); // Formatierung beibehalten
        const briefVorschau = document.getElementById('briefvorschau');
        briefVorschau.classList.remove('hidden');

        // Smooth Scroll zum Briefvorschau Bereich
        briefVorschau.scrollIntoView({ behavior: 'smooth' });
      },

      // Export-Funktionen (Nur PDF verbleibt)
      exportiereBriefAlsPdf() {
        // Implementierung hier hinzufügen
        alert('PDF-Export noch zu implementieren.');
      }
    };
}
