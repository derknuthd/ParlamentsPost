import Alpine from "alpinejs";
import "./styles/styles.css";
import { parlamentspostApp } from "./scripts/app.js";

// Register parlamentspostApp globally before starting Alpine
window.parlamentspostApp = parlamentspostApp;

// Make Alpine globally available
window.Alpine = Alpine;

// Initialize Alpine
Alpine.start();

// Hot Module Replacement (HMR) support
if (import.meta.hot) {
  import.meta.hot.accept();
}
