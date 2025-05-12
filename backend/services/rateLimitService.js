// services/rateLimitService.js
const crypto = require('crypto');

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
    
    console.log("[INFO] PrivacyFriendlyRateLimiter initialisiert");
    console.log(`[INFO] Salt-Intervall: ${this.saltIntervalMs/60000} Minuten, Max Bucket-Alter: ${this.maxBucketAge/60000} Minuten`);
  }
  
  /**
   * Prüft, ob eine Anfrage erlaubt ist
   * @param {Object} req - Express Request-Objekt
   * @param {boolean} isAiRequest - Gibt an, ob es sich um eine KI-Anfrage handelt
   * @returns {boolean} - Ob die Anfrage erlaubt ist
   */
  isAllowed(req, isAiRequest = false) {
    const bucketConfig = isAiRequest ? this.aiBucket : this.standardBucket;
    const bucketType = isAiRequest ? 'ai' : 'standard';
    
    // Anonymisierter Identifier
    const anonId = this.generateAnonymousId(req, bucketType);
    
    // Aktuelle Zeit
    const now = Date.now();
    
    // Bucket initialisieren oder holen
    if (!this.buckets.has(anonId)) {
      this.buckets.set(anonId, {
        tokens: bucketConfig.capacity, // Voller Bucket für neue Benutzer
        lastRefill: now,
        type: bucketType
      });
      return true; // Erste Anfrage erlauben
    }
    
    // Bestehenden Bucket holen
    const bucket = this.buckets.get(anonId);
    
    // Refill basierend auf vergangener Zeit
    const elapsedMs = now - bucket.lastRefill;
    const newTokens = (elapsedMs / 1000) * bucketConfig.refillRate;
    
    bucket.tokens = Math.min(
      bucketConfig.capacity,
      bucket.tokens + newTokens
    );
    bucket.lastRefill = now;
    
    // Anfrage erlauben, wenn genug Tokens vorhanden sind
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    
    return false;
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
      console.log(`[INFO] PrivacyFriendlyRateLimiter: ${count} alte Einträge bereinigt`);
    }
  }
}

// Singleton-Instanz
const rateLimiter = new PrivacyFriendlyRateLimiter();

module.exports = rateLimiter;