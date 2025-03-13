//frontend/loadComponents.js
// Lade Komponenten (Header & Footer)
async function loadComponent(id, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP-Error! status: ${response.status}`);
    }
    const content = await response.text();
    document.getElementById(id).innerHTML = content;
  } catch (error) {
    console.error(`Fehler beim Laden der Komponente ${url}:`, error);
  }
}
loadComponent("header", "components/Header.html");
loadComponent("footer", "components/Footer.html");
