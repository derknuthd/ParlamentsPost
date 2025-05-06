export const config = {
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
    
    // Log-Level
    logLevel: "INFO" // DEBUG, INFO, WARN, ERROR
  };