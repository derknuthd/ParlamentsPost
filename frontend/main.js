import Alpine from "alpinejs";
import "./styles/styles.css";
import "./styles/print-styles.css"; // Print-Styles importieren
//import "./styles/safari-print-fixes.css"; // Safari-spezifische Fixes
import { parlamentspostApp } from "./scripts/app.js";
import { initComponents } from "./scripts/components.js";

// Register parlamentspostApp globally before starting Alpine
window.parlamentspostApp = parlamentspostApp;

// Make Alpine globally available
window.Alpine = Alpine;

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