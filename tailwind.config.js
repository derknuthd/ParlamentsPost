// tailwind.config.js
module.exports = {
  darkMode: "class", // Aktiviert Dark Mode über die 'class' Strategie
  content: [
    "./frontend/**/*.{html,js,css}", // Passe die Pfade nach Bedarf an
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          600: "#4F46E5",
          700: "#4338CA",
        },
        teal: {
          600: "#14B8A6",
          700: "#0D9488",
        },
        red: {
          500: "#EF4444",
          600: "#DC2626",
        },
      },
    },
  },
  plugins: [],
};
