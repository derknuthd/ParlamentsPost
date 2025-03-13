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
          const response = await fetch('/api/abgeordnete-by-adresse', {
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
      async generiereBrief(kiGeneriert = false) {
        const plzPattern = /^\d{5}$/;
        if (!plzPattern.test(this.plz)) {
          alert('Bitte eine gültige 5-stellige PLZ eingeben.');
          return;
        }
      
        // Absender, Ort/Datum und Wahlkreis
        const absender = `${this.name}\n${this.straße}\n${this.plz} ${this.ort}`;
        const aktuellesDatum = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
        const ortUndDatum = `${this.ort}, den ${aktuellesDatum}`;
      
        const abgeordneter = this.abgeordneteListe.find(a => String(a.id) === this.abgeordnete);
        const wahlkreisBez = abgeordneter?.wkr_bezeichnung || 'Wahlkreis unbekannt';
        const nameDesAbgeordneten = abgeordneter ? `${abgeordneter.name} (${abgeordneter.partei})` : 'Unbekannt';

        // Validierung von Freitext und Themen
        if (!this.freitext.trim() && this.themen.length === 0) {
            alert('Bitte einen Freitext oder mindestens ein Thema angeben.');
            return;
        }
        
        let inhalt;
        if (kiGeneriert) {
            this.isLoading = true;
            try {
                // Erstelle das Datenobjekt nur mit vorhandenen Daten
                const userData = {
                    ...(this.themen.length > 0 && { themen: this.themen }),
                    ...(this.freitext.trim() && { freitext: this.freitext.trim() }),
                    abgeordneteName: nameDesAbgeordneten
                };

              console.log('DEBUG: userData:', userData); // Debugging
          
              const response = await fetch('/api/genai-brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userData })
              });
          
              if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Fehler bei der KI-Generierung.');
              }
          
              const data = await response.json();
              inhalt = data.briefText || '(Kein KI-Text vorhanden)';
            } catch (error) {
              alert(`Fehler bei der KI-Abfrage: ${error.message}`);
              console.error(error);
              return;
            } finally {
              this.isLoading = false;
            }
          } else {
          // Manuelle Erstellung
          inhalt = `
      Ich wende mich heute an Sie bezüglich folgender Themen: ${this.themen.join(', ')}.
      
      ${this.freitext}
          `.trim();
        }
      
        // Brieftext zusammenstellen
        const briefText = `
${absender}

${ortUndDatum}

Wahlkreis: ${wahlkreisBez}

Sehr geehrte/r Frau/Herr ${nameDesAbgeordneten.split(' (')[0]},

${inhalt}

Mit freundlichen Grüßen,
${this.name}
        `.trim();
      
        this.zeigeVorschau(briefText);
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
