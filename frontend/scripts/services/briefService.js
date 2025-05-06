import { cacheService } from './cacheService.js';
import { logService } from './logService.js';

export const briefService = {
  // Speicher-Konfiguration
  config: {
    storageKey: 'parlamentspost_briefe',
    maxPreviewBriefe: 4
  },
  
  // Brief speichern
  speichereBrief(briefDaten) {
    try {
      // Bestehende Briefe laden
      const briefe = this.ladeBriefe();
      
      // Neuen Brief mit eindeutiger ID und Zeitstempel erstellen
      const neuerBrief = {
        id: `brief_${Date.now()}`,
        zeitstempel: new Date().toISOString(),
        ...briefDaten
      };
      
      // Brief zum Array hinzufügen
      briefe.push(neuerBrief);
      
      // Zurück in Local Storage speichern
      cacheService.setBriefCache(briefe);
      
      logService.info(`Brief ${neuerBrief.id} gespeichert`);
      return neuerBrief.id;
    } catch (error) {
      logService.error("Fehler beim Speichern des Briefes", { error: error.message });
      return null;
    }
  },
  
  // Alle Briefe laden
  ladeBriefe(limit = null) {
    try {
      // Aus dem Local Storage laden
      const briefe = cacheService.getBriefCache() || [];
      
      // Nach Datum sortieren (neueste zuerst)
      briefe.sort((a, b) => new Date(b.zeitstempel) - new Date(a.zeitstempel));
      
      // Optional begrenzen
      if (limit !== null && Number.isInteger(limit) && limit > 0) {
        return briefe.slice(0, limit);
      }
      
      return briefe;
    } catch (error) {
      logService.error("Fehler beim Laden der Briefe", { error: error.message });
      return [];
    }
  },
  
  // Einzelnen Brief laden
  ladeBrief(id) {
    try {
      const briefe = this.ladeBriefe();
      const brief = briefe.find(b => b.id === id);
      
      if (!brief) {
        logService.warn(`Brief mit ID ${id} nicht gefunden`);
        return null;
      }
      
      logService.info(`Brief ${id} geladen`);
      return brief;
    } catch (error) {
      logService.error(`Fehler beim Laden des Briefs ${id}`, { error: error.message });
      return null;
    }
  },
  
  // Brief löschen
  loescheBrief(id) {
    try {
      // Alle Briefe laden
      const briefe = this.ladeBriefe();
      
      // Brief mit der ID filtern
      const filteredBriefe = briefe.filter(b => b.id !== id);
      
      // Wenn keine Änderung, dann wurde der Brief nicht gefunden
      if (filteredBriefe.length === briefe.length) {
        logService.warn(`Brief mit ID ${id} konnte nicht gelöscht werden (nicht gefunden)`);
        return false;
      }
      
      // Aktualisierte Liste speichern
      cacheService.setBriefCache(filteredBriefe);
      
      logService.info(`Brief ${id} gelöscht`);
      return true;
    } catch (error) {
      logService.error(`Fehler beim Löschen des Briefs ${id}`, { error: error.message });
      return false;
    }
  },
  
  // Alle Briefe löschen
  loescheAlleBriefe() {
    try {
      cacheService.clearBriefCache();
      logService.info("Alle Briefe gelöscht");
      return true;
    } catch (error) {
      logService.error("Fehler beim Löschen aller Briefe", { error: error.message });
      return false;
    }
  },
  
  // Briefdaten für Titel generieren
  generateBriefTitel(empfaenger, topic, datum = new Date()) {
    // Empfängername bestimmen
    const empfaengerName = empfaenger ? empfaenger.vollerName : "Unbekannter Empfänger";
    
    // Thementitel bestimmen
    let themenTitel = "Allgemein";
    if (topic && topic.name) {
      themenTitel = topic.name;
    }
    
    // Datum im kurzen Format
    const datumFormatiert = datum.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
    
    // Titel zusammenstellen
    return `Brief an ${empfaengerName} - ${themenTitel} (${datumFormatiert})`;
  }
};