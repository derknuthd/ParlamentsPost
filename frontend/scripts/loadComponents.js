//frontend/loadComponents.js
// Load header and footer components
document.addEventListener("DOMContentLoaded", () => {
  // Load header
  fetch("/components/header.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("header").innerHTML = data;
    })
    .catch((error) => console.error("Error loading header:", error));

  // Load footer
  fetch("/components/footer.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("footer").innerHTML = data;
    })
    .catch((error) => console.error("Error loading footer:", error));
});
