// services/rateLimitService.js
const crypto = require('crypto');
const logService = require('./logService'); // Passe den Pfad entsprechend an

/**
 * Datenschutzfreundlicher TokenBucket-RateLimiter
 * Speichert keine IP-Adressen direkt, sondern verwendet einen anonymisierten Hash
 */
class PrivacyFriendlyRateLimiter {
  constructor() {
    // Konfiguration per Environment-Variablen oder Standard-Werte
    this.standardBucket = {
      capacity: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
      refillRate: parseInt(process.env.RATE_LIMIT_MAX || "100", 10) / parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10),
      refillWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10) * 1000
    };
    
    this.aiBucket = {
      capacity: parseInt(process.env.AI_RATE_LIMIT_MAX || "10", 10),
      refillRate: parseInt(process.env.AI_RATE_LIMIT_MAX || "10", 10) / parseInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS || "300", 10),
      refillWindowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS || "300", 10) * 1000
    };
    
    // Salt für zusätzliche Verschleierung
    this.salt = process.env.RATE_LIMIT_SALT || crypto.randomBytes(16).toString('hex');
    
    // Zeitintervall-Konfiguration - direkt im Code definiert
    this.saltIntervalMs = 1800000; // 30 Minuten in Millisekunden
    this.maxBucketAge = this.saltIntervalMs * 2; // Maximales Alter: 2 Salt-Intervalle (1 Stunde)
    
    // In-Memory-Storage für die Buckets
    this.buckets = new Map();
    
    // Periodische Bereinigung alter Einträge
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Alle 5 Minuten
    
    logService.info("PrivacyFriendlyRateLimiter initialisiert");
    logService.info(`Salt-Intervall: ${this.saltIntervalMs/60000} Minuten, Max Bucket-Alter: ${this.maxBucketAge/60000} Minuten`);
  }
  
    /**
   * Prüft, ob eine Anfrage erlaubt ist
   * @param {Object} req - Express Request-Objekt
   * @param {boolean} isAiRequest - Gibt an, ob es sich um eine KI-Anfrage handelt
   * @returns {Object} - Informationen zur Anfrage-Erlaubnis und ggf. Warnungen
   */
  isAllowed(req, isAiRequest = false) {
    const bucketConfig = isAiRequest ? this.aiBucket : this.standardBucket;
    const bucketType = isAiRequest ? 'ai' : 'standard';
    
    // Anonymisierter Identifier
    const anonId = this.generateAnonymousId(req, bucketType);
    
    // Aktuelle Zeit
    const now = Date.now();
    
    // Debug-Ausgaben für anonyme ID
    logService.debug(`Anfrage-Typ: ${bucketType}, Anonyme ID: ${anonId.substring(0, 8)}...`);

    // Bucket initialisieren oder holen
    if (!this.buckets.has(anonId)) {
      this.buckets.set(anonId, {
        tokens: bucketConfig.capacity,
        lastRefill: now,
        type: bucketType,
        warningIssued: false // Neue Eigenschaft: Wurde bereits eine Warnung ausgegeben?
      });
      logService.debug(`Neuer Bucket erstellt für ${bucketType}. Volle Kapazität: ${bucketConfig.capacity}`);
      return { allowed: true };
    }
    
    // Bestehenden Bucket holen
    const bucket = this.buckets.get(anonId);
    
    // Refill basierend auf vergangener Zeit
    const elapsedMs = now - bucket.lastRefill;
    const newTokens = (elapsedMs / 1000) * bucketConfig.refillRate;
    
    // Alte Tokens speichern für Debug-Ausgabe
    const oldTokens = bucket.tokens;
    
    bucket.tokens = Math.min(
      bucketConfig.capacity,
      bucket.tokens + newTokens
    );
    bucket.lastRefill = now;
    
    // Prozentsatz berechnen
    const usedPercentage = 100 - (bucket.tokens / bucketConfig.capacity * 100);
    
    // Debug-Ausgabe für Bucket-Status
    logService.debug(`Bucket-Status für ${bucketType}:`, {
      oldTokens: oldTokens.toFixed(2),
      addedTokens: newTokens.toFixed(2),
      currentTokens: bucket.tokens.toFixed(2),
      capacity: bucketConfig.capacity,
      usedPercentage: usedPercentage.toFixed(1) + '%',
      warningIssued: bucket.warningIssued,
      elapsedSinceLastRefill: (elapsedMs / 1000).toFixed(1) + 's',
      refillRatePerSecond: bucketConfig.refillRate.toFixed(3)
    });
    
    // Reset-Informationen berechnen
    const resetInfo = this.getResetTimeInfo(req, isAiRequest);
    
    // 80% Warnung, falls noch nicht ausgegeben
    if (usedPercentage >= 80 && !bucket.warningIssued) {
      bucket.warningIssued = true; // Markieren als ausgegeben
      logService.info(`80% Warnung für ${bucketType} ausgelöst. Reset in: ${resetInfo.resetTimeFormatted}`);
      
      return { 
        allowed: bucket.tokens >= 1,
        warning: true,
        warningLevel: "80percent",
        message: `Sie haben bereits 80% Ihres ${isAiRequest ? 'KI-' : ''}Anfragelimits aufgebraucht. Vollständiger Reset in ${resetInfo.resetTimeFormatted}.`,
        resetTimeSeconds: resetInfo.resetTimeSeconds
      };
    }
    
    // Anfrage erlauben, wenn genug Tokens vorhanden
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      logService.debug(`Anfrage erlaubt für ${bucketType}. Verbleibende Tokens: ${bucket.tokens.toFixed(2)}`);
      return { allowed: true };
    }
    
    // Limit erreicht
    logService.warn(`Rate-Limit erreicht für ${bucketType}! Keine Tokens übrig. Reset in: ${resetInfo.resetTimeFormatted}`);
    return { 
      allowed: false,
      message: `Anfragelimit erreicht. Bitte warten Sie ${resetInfo.resetTimeFormatted} auf den Reset.`,
      resetTimeSeconds: resetInfo.resetTimeSeconds
    };
  }
  
  /**
   * Berechnet die verbleibende Zeit bis zum Reset
   * @param {Object} req - Express Request-Objekt
   * @param {boolean} isAiRequest - Gibt an, ob es sich um eine KI-Anfrage handelt
   * @returns {Object} - Informationen zur Reset-Zeit
   */
  getResetTimeInfo(req, isAiRequest = false) {
    const bucketConfig = isAiRequest ? this.aiBucket : this.standardBucket;
    const bucketType = isAiRequest ? 'ai' : 'standard';
    const anonId = this.generateAnonymousId(req, bucketType);
    
    // Wenn kein Bucket existiert
    if (!this.buckets.has(anonId)) {
      return { resetTimeSeconds: 0 };
    }
    
    const bucket = this.buckets.get(anonId);
    const now = Date.now();
    
    // Zeit bis vollständige Regeneration (in Sekunden)
    const elapsedMs = now - bucket.lastRefill;
    const newTokens = (elapsedMs / 1000) * bucketConfig.refillRate;
    const currentTokens = Math.min(
      bucketConfig.capacity,
      bucket.tokens + newTokens
    );
    
    // Berechne wann der Bucket wieder voll ist
    const tokensNeeded = bucketConfig.capacity - currentTokens;
    const secondsToFullRefill = tokensNeeded > 0 
      ? Math.ceil(tokensNeeded / bucketConfig.refillRate)
      : 0;
    
    return {
      resetTimeSeconds: secondsToFullRefill,
      resetTimeFormatted: this.formatTimeString(secondsToFullRefill)
    };
  }
  
  /**
   * Formatiert eine Zeitdauer benutzerfreundlich
   * @param {number} seconds - Anzahl der Sekunden
   * @returns {string} - Formatierte Zeitangabe
   */
  formatTimeString(seconds) {
    if (seconds < 60) {
      return `${seconds} Sekunden`;
    } else if (seconds < 3600) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} Minute${minutes > 1 ? 'n' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `${hours} Stunde${hours > 1 ? 'n' : ''} und ${minutes} Minute${minutes > 1 ? 'n' : ''}`;
    }
  }
  
  /**
   * Extrahiert charakteristische Merkmale aus dem User-Agent ohne personenbezogene Daten
   * @param {string} userAgent - Der User-Agent-String
   * @returns {string} - Ein Fingerprint-String
   */
  extractUaFingerprint(userAgent) {
    if (!userAgent) return 'unknown';
    
    let fingerprint = '';
    
    // Browser-Typ extrahieren (aber keine Versionen)
    if (userAgent.includes('Firefox')) fingerprint += 'FF';
    else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) fingerprint += 'CH';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) fingerprint += 'SF';
    else if (userAgent.includes('Edg')) fingerprint += 'ED';
    else if (userAgent.includes('Opera') || userAgent.includes('OPR')) fingerprint += 'OP';
    else fingerprint += 'OB'; // Other Browser
    
    // Betriebssystem-Klasse
    if (userAgent.includes('Windows')) fingerprint += 'W';
    else if (userAgent.includes('Mac')) fingerprint += 'M';
    else if (userAgent.includes('Linux')) fingerprint += 'L';
    else if (userAgent.includes('Android')) fingerprint += 'A';
    else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) fingerprint += 'I';
    else fingerprint += 'O'; // Other OS
    
    // Geräteklasse
    if (userAgent.includes('Mobile')) fingerprint += 'M';
    else fingerprint += 'D'; // Desktop assumed
    
    return fingerprint; // z.B. "FFWD" für Firefox auf Windows Desktop
  }
  
  /**
   * Extrahiert charakteristische Merkmale aus den HTTP-Headern ohne personenbezogene Daten
   * @param {Object} req - Express Request-Objekt
   * @returns {string} - Ein Fingerprint-String
   */
  extractHeaderFingerprint(req) {
    let fingerprint = '';
    
    // Accept-Language Features (nicht nur die ersten 2 Zeichen)
    const acceptLanguage = req.headers['accept-language'] || '';
    fingerprint += acceptLanguage.includes('de') ? 'D' : 
                  acceptLanguage.includes('en') ? 'E' : 'O';
    
    // Accept-Encoding Unterstützung
    const acceptEncoding = req.headers['accept-encoding'] || '';
    fingerprint += acceptEncoding.includes('br') ? 'B' : 
                  acceptEncoding.includes('gzip') ? 'G' : 'P';
    
    // DNT (Do Not Track) Header
    fingerprint += req.headers['dnt'] === '1' ? 'N' : 'T';
    
    // Bildschirmgröße Kategorie, falls vorhanden
    if (req.headers['sec-ch-viewport-width']) {
      const width = parseInt(req.headers['sec-ch-viewport-width']);
      fingerprint += width < 768 ? 'S' : width < 1200 ? 'M' : 'L';
    } else {
      fingerprint += 'U'; // Unknown
    }
    
    return fingerprint; // z.B. "DGTN" für Deutsch, GZIP, Tracking erlaubt, Unbekannte Größe
  }
  
  /**
   * Erzeugt ein rotierendes Salt basierend auf dem aktuellen Zeitraum
   * @returns {string} - Das zeitbasierte Salt
   */
  generateTimeSalt() {
    const date = new Date();
    const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Berechnung der Intervall-Nummer seit Mitternacht, basierend auf saltIntervalMs
    const intervalsSinceMidnight = Math.floor((date - baseDate) / this.saltIntervalMs);
    
    // Zeitintervalle mit täglichem Wechsel
    return this.salt + 
           date.toISOString().split('T')[0] + // Täglicher Wechsel
           '-' + intervalsSinceMidnight; // Intervall-Nummer seit Mitternacht
  }
  
  /**
   * Erzeugt eine anonymisierte ID für den Benutzer mit verbesserter Entropie
   * @param {Object} req - Express Request-Objekt
   * @param {string} bucketType - Art des Rate-Limit-Buckets ('standard' oder 'ai')
   * @returns {string} - Eine anonymisierte ID
   */
  generateAnonymousId(req, bucketType) {
    // Extrahiere Fingerprints aus User-Agent und Headern
    const uaFingerprint = this.extractUaFingerprint(req.headers['user-agent']);
    const headerFingerprint = this.extractHeaderFingerprint(req);
    const timeSalt = this.generateTimeSalt();
    
    // Abstimmen der Anfragecharakteristik
    const requestProps = {
      method: req.method,
      hasBody: req.body && Object.keys(req.body).length > 0,
      path: req.path.split('/')[1] || 'root' // Nur das erste Pfadsegment
    };
    const requestFingerprint = `${requestProps.method[0]}${requestProps.hasBody ? 'B' : 'N'}${requestProps.path[0]}`;
    
    // Kombiniere alles für maximale Unterscheidung mit minimaler Identifizierung
    const dataToHash = `${uaFingerprint}|${headerFingerprint}|${requestFingerprint}|${timeSalt}|${bucketType}`;
    
    return crypto.createHash('sha256')
      .update(dataToHash)
      .digest('hex');
  }
  
  /**
   * Bereinigt alte Einträge aus dem Speicher
   */
  cleanup() {
    const now = Date.now();
    let count = 0;
    
    this.buckets.forEach((bucket, key) => {
      const config = bucket.type === 'ai' ? this.aiBucket : this.standardBucket;
      
      // Lösche Einträge, die länger inaktiv sind als das doppelte Zeitfenster
      // ODER wenn sie älter als das maximale Bucket-Alter sind
      if (now - bucket.lastRefill > (config.refillWindowMs * 2) || 
          now - bucket.lastRefill > this.maxBucketAge) {
        this.buckets.delete(key);
        count++;
      }
    });
    
    if (count > 0) {
      logService.info(`PrivacyFriendlyRateLimiter: ${count} alte Einträge bereinigt`);
    }
  }
}

// Singleton-Instanz
const rateLimiter = new PrivacyFriendlyRateLimiter();

module.exports = rateLimiter;