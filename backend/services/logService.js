// services/logService.js
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";
const logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];

const logService = {
  logLevel: LOG_LEVEL,
  
  // Logging-Funktion
  log(level, message, data = null) {
    if (logLevels.indexOf(level) >= logLevels.indexOf(this.logLevel)) {
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

module.exports = logService;