// Cache-Service für die Verwaltung aller Cache-Operationen
export const cacheService = {
    // Cache-Konfiguration
    config: {
      enabled: true,
      abgeordneteTTL: 24 * 60 * 60 * 1000, // 24 Stunden
      topicsTTL: 7 * 24 * 60 * 60 * 1000,  // 1 Woche
    },
    
    // Generische Cache-Methoden
    setCache(key, data, customTTL = null) {
      if (!this.config.enabled) return false;
      
      try {
        const cacheData = {
          timestamp: Date.now(),
          ttl: customTTL || this.config.abgeordneteTTL,
          data: data,
        };
        
        localStorage.setItem(key, JSON.stringify(cacheData));
        return true;
      } catch (error) {
        console.warn(`Fehler beim Speichern im Cache für ${key}:`, error);
        return false;
      }
    },
    
    getCache(key, customTTL = null) {
      if (!this.config.enabled) return null;
      
      try {
        const rawData = localStorage.getItem(key);
        if (!rawData) return null;
        
        const cachedData = JSON.parse(rawData);
        const now = Date.now();
        const ttl = customTTL || cachedData.ttl || this.config.abgeordneteTTL;
        
        if (now - cachedData.timestamp < ttl) {
          return cachedData.data;
        } else {
          localStorage.removeItem(key);
          return null;
        }
      } catch (error) {
        console.warn(`Fehler beim Lesen aus dem Cache für ${key}:`, error);
        return null;
      }
    },
    
    clearCacheByPrefix(prefix) {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keys.push(key);
          }
        }
        
        keys.forEach(key => localStorage.removeItem(key));
        return keys.length;
      } catch (error) {
        console.warn(`Fehler beim Löschen des Caches mit Präfix ${prefix}:`, error);
        return 0;
      }
    },
    
    // Spezifische Methoden für verschiedene Datentypen
    
    // Abgeordnete
    setAbgeordneteCache(ort, data) {
      return this.setCache(`abgeordnete_${ort.trim().toLowerCase()}`, data);
    },
    
    getAbgeordneteCache(ort) {
      return this.getCache(`abgeordnete_${ort.trim().toLowerCase()}`);
    },
    
    clearAbgeordneteCache() {
      return this.clearCacheByPrefix('abgeordnete_');
    },
    
    // Topics
    setTopicsCache(data) {
      return this.setCache('parlamentspost_topics', data, this.config.topicsTTL);
    },
    
    getTopicsCache() {
      return this.getCache('parlamentspost_topics', this.config.topicsTTL);
    },
    
    setTopicCache(topicId, data) {
      return this.setCache(`parlamentspost_topic_${topicId}`, data, this.config.topicsTTL);
    },
    
    getTopicCache(topicId) {
      return this.getCache(`parlamentspost_topic_${topicId}`, this.config.topicsTTL);
    },
    
    setSubtopicsCache(topicId, data) {
      return this.setCache(`parlamentspost_subtopics_${topicId}`, data, this.config.topicsTTL);
    },
    
    getSubtopicsCache(topicId) {
      return this.getCache(`parlamentspost_subtopics_${topicId}`, this.config.topicsTTL);
    },
    
    clearTopicsCache() {
      const count1 = this.clearCacheByPrefix('parlamentspost_topics');
      const count2 = this.clearCacheByPrefix('parlamentspost_topic_');
      const count3 = this.clearCacheByPrefix('parlamentspost_subtopics_');
      return count1 + count2 + count3;
    },
    
    // Brief-Storage
    setBriefCache(briefe) {
      return this.setCache('parlamentspost_briefe', briefe);
    },
    
    getBriefCache() {
      return this.getCache('parlamentspost_briefe');
    },
    
    clearBriefCache() {
      return this.clearCacheByPrefix('parlamentspost_briefe');
    },
    
    // Gesamter Cache
    clearAllCache() {
      const prefixes = [
        'abgeordnete_',
        'parlamentspost_topics',
        'parlamentspost_topic_',
        'parlamentspost_subtopics_',
        'parlamentspost_briefe'
      ];
      
      let totalDeleted = 0;
      prefixes.forEach(prefix => {
        totalDeleted += this.clearCacheByPrefix(prefix);
      });
      
      return totalDeleted;
    }
  };