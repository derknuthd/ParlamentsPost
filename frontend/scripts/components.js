// Erstelle eine neue Datei: frontend/scripts/components.js

// Import der HTML-Dateien als raw-Text (Vite-Feature)
import headerHTML from '../components/header.html?raw';
import footerHTML from '../components/footer.html?raw';

// Funktion zum Laden der Komponenten
export function initComponents() {
  const headerElement = document.getElementById("header");
  const footerElement = document.getElementById("footer");
  
  if (headerElement) {
    headerElement.innerHTML = headerHTML;
  }
  
  if (footerElement) {
    footerElement.innerHTML = footerHTML;
  }
  
  // Event-Listener für Mobile-Menü hinzufügen
  setTimeout(() => {
    const menuButton = document.getElementById("menu-button");
    const mobileNav = document.getElementById("mobile-nav");
    if (menuButton && mobileNav) {
      menuButton.addEventListener("click", () => {
        mobileNav.classList.toggle("hidden");
      });
    }
  }, 100);
}