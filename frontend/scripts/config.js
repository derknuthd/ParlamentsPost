export const config = {
    // Log-Level
    logLevel: "INFO", // DEBUG, INFO, WARN, ERROR

    // Cache-Einstellungen
    cache: {
      enabled: true,
      abgeordneteTTL: 24 * 60 * 60 * 1000, // 24 Stunden
      topicsTTL: 7 * 24 * 60 * 60 * 1000   // 1 Woche
    },
    
    // Brief-Speicher-Einstellungen
    briefStorage: {
      storageKey: 'parlamentspost_briefe',
      maxPreviewBriefe: 4
    },
    
    // Textbegrenzungen
    textLimits: {
        freitext: 1000 // Maximale Anzahl an Zeichen für Freitext
    },
  };