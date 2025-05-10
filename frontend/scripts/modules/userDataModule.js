// userDataModule.js
import { logService } from '../services/logService.js';
import { apiService } from '../services/apiService.js';
import { notificationService } from '../services/notificationService.js';
import { cacheService } from '../services/cacheService.js';

export function userDataModule() {
  return {
    // Persönliche Daten
    name: "",
    strasse: "",
    plz: "",
    ort: "",
    email: "",
    
    // Abgeordnete
    abgeordnete: "",
    abgeordneteListe: [],
    
    // Abgeordnete holen
    async holeAbgeordnete() {
      if (!this.ort.trim()) {
        logService.warn("Kein Wohnort eingegeben");
        return;
      }
      
      // Versuche zuerst, Daten aus dem Cache zu laden
      const cachedAbgeordnete = cacheService.getAbgeordneteCache(this.ort);
      if (cachedAbgeordnete) {
        this.abgeordneteListe = cachedAbgeordnete;
        logService.info("Abgeordnete aus Cache geladen", {
          anzahl: cachedAbgeordnete.length,
        });
        return;
      }
      
      // Überprüfe Online-Status
      if (!apiService.isOnline) {
        notificationService.showNotification(
          "Keine Netzwerkverbindung und keine Cache-Daten für den eingegebenen Ort",
          "warning"
        );
        return;
      }
      
      this.isLoading = true; // Ladeindikator aktivieren
      this.startLoadingTimer();

      try {
        // Abgeordnete über den API-Service laden
        const abgeordnete = await apiService.getAbgeordnete(this.ort);
        this.abgeordneteListe = abgeordnete;
        
        if (abgeordnete.length === 0) {
          notificationService.showNotification(
            `Keine Abgeordneten für "${this.ort}" gefunden.`,
            "warning"
          );
        }
        
        return abgeordnete;
      } catch (error) {
        logService.error("Fehler in holeAbgeordnete", { message: error.message });
        notificationService.showNotification(
          `Fehler beim Abrufen der Abgeordneten: ${error.message}`,
          "error"
        );
        this.abgeordneteListe = [];
        return [];
      } finally {
        this.isLoading = false; // Ladeindikator deaktivieren
        this.stopLoadingTimer();
      }
    }
  };
}