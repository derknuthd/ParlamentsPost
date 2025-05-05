// frontend/scripts/loadComponents.js

/**
 * Lädt Header- und Footer-Komponenten in die entsprechenden HTML-Container
 * @returns {Promise<void>} Ein Promise, das abgeschlossen wird, wenn alle Komponenten geladen wurden
 */
export async function loadComponents() {
  try {
    // Header laden
    const headerResponse = await fetch("/components/header.html");
    if (!headerResponse.ok) {
      throw new Error(`HTTP-Fehler beim Laden des Headers: ${headerResponse.status}`);
    }
    document.getElementById("header").innerHTML = await headerResponse.text();
    
    // Footer laden
    const footerResponse = await fetch("/components/footer.html");
    if (!footerResponse.ok) {
      throw new Error(`HTTP-Fehler beim Laden des Footers: ${footerResponse.status}`);
    }
    document.getElementById("footer").innerHTML = await footerResponse.text();
    
    console.log("Komponenten erfolgreich geladen");
  } catch (error) {
    console.error("Fehler beim Laden der Komponenten:", error);
  }
}

// Komponenten laden, wenn das DOM bereit ist
document.addEventListener("DOMContentLoaded", loadComponents);