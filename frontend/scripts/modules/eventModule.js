// eventModule.js
import eventBus from '../services/eventBus.js';
import { themeService } from '../services/themeService.js';
import { notificationService } from '../services/notificationService.js';
import { cacheService } from '../services/cacheService.js';

export function eventModule() {
  return {
    // Status-Eigenschaften
    _isOnline: navigator.onLine,
    notifications: [],
    
    // Getter für Online-Status
    get isOnline() { 
      return this._isOnline; 
    },
    
    // Dark Mode Getter
    get isDark() { return themeService.isDark; },
    
    // Initialisierung der EventBus-Abonnements
    initEventBus() {
      // eventBus-Abonnement für Online-Status
      eventBus.subscribe('online-status-change', (data) => {
        // Lokale reaktive Kopie aktualisieren
        this._isOnline = data.isOnline;
        console.log("Online-Status aktualisiert:", this._isOnline);
      });

      // Benachrichtigungen-Abonnement hinzufügen
      eventBus.subscribe('notification', (data) => {
        if (data.action === 'add') {
          // Da Alpine.js Änderungen an Arrays nicht immer erkennt, 
          // erstellen wir eine neue Kopie des Arrays
          this.notifications = [...notificationService.notifications];
        } else if (data.action === 'remove') {
          this.notifications = [...notificationService.notifications];
        }
      });
      
      // eventBus-Abonnement für Brief-Ereignisse
      eventBus.subscribe('brief', (data) => {
        if (data.action === 'saved' || data.action === 'deleted' || data.action === 'deleted-all') {
          // Briefe neu laden und UI aktualisieren
          this.gespeicherteBriefe = this.ladeBriefe();
          this.updateMeineBriefeUI();
        } else if (data.action === 'error') {
          // Hier könntest du je nach Fehlertyp spezifische Benachrichtigungen anzeigen
          notificationService.showNotification(
            `Fehler bei ${data.operation}: ${data.error}`,
            "error"
          );
        }
      });

      // eventBus-Abonnement für Theme-Änderungen
      eventBus.subscribe('theme-change', (data) => {
        console.log("Theme geändert:", data.isDark ? "Dunkel" : "Hell");
        
        // WICHTIG: Explizit das DOM aktualisieren
        if (data.isDark) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        
        // // Optional: Benachrichtigung bei manueller Theme-Änderung
        // if (data.isUserSet) {
        //   notificationService.showNotification(
        //     `Design auf ${data.isDark ? "Dunkelmodus" : "Hellmodus"} umgeschaltet`,
        //     "info",
        //     3000
        //   );
        // }
      });
    },
    
    // Dark Mode umschalten
    toggleDarkMode() {
      themeService.toggleDarkMode();
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
    }
  };
}