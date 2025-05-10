import eventBus from './eventBus.js';

export const themeService = {
    // Ist Dark Mode aktiv?
    isDark: false,
    
    // Wurde Dark Mode manuell eingestellt?
    isUserSet: false,
    
    // Initialisierung
    init() {
      // Gespeicherte Einstellung abrufen
      this.isDark = localStorage.getItem("isDark") === "true";
      this.isUserSet = localStorage.getItem("isDarkUserSet") === "true";
      
      // Dark Mode entsprechend anwenden
      if (this.isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      // Auf Änderungen der Systemeinstellungen reagieren
      if (!this.isUserSet) {
        const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        darkModeMediaQuery.addEventListener("change", (e) => {
          this.setDarkMode(e.matches, false);
        });
        
        // Initiale Prüfung der Systemeinstellung, falls keine gespeicherte Einstellung vorhanden
        if (localStorage.getItem("isDark") === null && darkModeMediaQuery.matches) {
          this.setDarkMode(true, false);
        }
      }
      
      // Event über den EventBus veröffentlichen (Initial)
      eventBus.publish('theme-change', { 
        isDark: this.isDark, 
        isUserSet: this.isUserSet 
      });
    },
    
    // Dark Mode ein-/ausschalten
    setDarkMode(isDark, isUserSet = true) {
      const previousState = this.isDark;
      this.isDark = isDark;
      
      if (isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("isDark", "true");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("isDark", "false");
      }
      
      // Merken, ob der Nutzer manuell umgeschaltet hat
      if (isUserSet) {
        this.isUserSet = true;
        localStorage.setItem("isDarkUserSet", "true");
      }
      
      // Animation für sanfteren Übergang
      document.body.style.transition = "background-color 0.5s ease, color 0.5s ease";
      setTimeout(() => {
        document.body.style.transition = "";
      }, 500);
      
      // Event über den EventBus veröffentlichen, aber nur bei tatsächlicher Änderung
      if (previousState !== isDark) {
        eventBus.publish('theme-change', { 
          isDark: isDark, 
          isUserSet: isUserSet 
        });
      }
    },
    
    // Dark Mode umschalten
    toggleDarkMode() {
      this.setDarkMode(!this.isDark);
    }
};