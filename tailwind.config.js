// tailwind.config.js
module.exports = {
  // Aktiviert den Dark Mode über die 'class' Strategie
  darkMode: 'class', // Optionen: 'media' oder 'class'

  // Pfade zu allen Dateien, die Tailwind CSS verwenden
  content: [
    "./frontend/**/*.{html,js,jsx,ts,tsx}",
    "./backend/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {
      // Hier kannst du benutzerdefinierte Theme-Erweiterungen hinzufügen
      // Beispiel: Farben, Schriftarten, etc.
    },
  },

  plugins: [
    // Hier kannst du Tailwind CSS Plugins hinzufügen, falls benötigt
  ],
};
