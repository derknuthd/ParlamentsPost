// frontend/scripts/loadComponents.js
import headerHTML from '../components/header.html?raw';
import footerHTML from '../components/footer.html?raw';

/**
 * Lädt Header- und Footer-Komponenten in die entsprechenden HTML-Container
 */
export function loadComponents() {
  try {
    // Header und Footer direkt einfügen
    document.getElementById("header").innerHTML = headerHTML;
    document.getElementById("footer").innerHTML = footerHTML;
    
    console.log("Komponenten erfolgreich geladen");
  } catch (error) {
    console.error("Fehler beim Laden der Komponenten:", error);
  }
}

// Komponenten laden, wenn das DOM bereit ist
document.addEventListener("DOMContentLoaded", loadComponents);