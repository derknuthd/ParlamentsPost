export const logService = {
    // Log-Level: DEBUG, INFO, WARN, ERROR
    logLevel: "INFO",
    
    // Verfügbare Log-Level
    logLevels: ["DEBUG", "INFO", "WARN", "ERROR"],
    
    // Logging-Funktion
    log(level, message, data = null) {
      if (this.logLevels.indexOf(level) >= this.logLevels.indexOf(this.logLevel)) {
        const logMessage = `[${level}] ${message}`;
        if (data) {
          console.log(logMessage, data);
        } else {
          console.log(logMessage);
        }
      }
    },
    
    // Kurzmethoden für verschiedene Log-Level
    debug(message, data = null) {
      this.log("DEBUG", message, data);
    },
    
    info(message, data = null) {
      this.log("INFO", message, data);
    },
    
    warn(message, data = null) {
      this.log("WARN", message, data);
    },
    
    error(message, data = null) {
      this.log("ERROR", message, data);
    }
  };