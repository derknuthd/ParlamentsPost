import Alpine from "alpinejs";
import "./styles/styles.css";
import "./styles/print-styles.css";
import { parlamentspostApp } from "./scripts/app.js";
import { initComponents } from "./scripts/components.js";

// Globale Services importieren und initialisieren
import { logService } from './scripts/services/logService.js';
import { apiService } from './scripts/services/apiService.js';
import { themeService } from './scripts/services/themeService.js';

// Register parlamentspostApp globally before starting Alpine
window.parlamentspostApp = parlamentspostApp;

// Make Alpine globally available
window.Alpine = Alpine;

// Initialisiere Services global
logService.logLevel = "INFO";
apiService.init();

// Initialize Alpine
Alpine.start();

// Komponenten laden
document.addEventListener("DOMContentLoaded", () => {
  initComponents();
});

// Hot Module Replacement (HMR) support
if (import.meta.hot) {
  import.meta.hot.accept();
}