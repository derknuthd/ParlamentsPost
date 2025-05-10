// uiModule.js
export function uiModule() {
    return {
      // Zustandsvariablen
      isLoading: false,
      briefGenerationDuration: 0, // Zählt Sekunden während der Brief-Generierung
      loadingTimer: null, // Timer-Referenz
      
      // Timer-Funktionen
      startLoadingTimer() {
        this.briefGenerationDuration = 0;
        this.loadingTimer = setInterval(() => {
          this.briefGenerationDuration++;
        }, 1000);
      },
      
      stopLoadingTimer() {
        if (this.loadingTimer) {
          clearInterval(this.loadingTimer);
          this.loadingTimer = null;
        }
      },
      
      // Formularvalidierung
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
      }
    };
  }