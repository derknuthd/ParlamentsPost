import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "frontend", // Set the root directory for the frontend
  publicDir: "public", // Static assets folder
  assetsInclude: ['**/*.html'], // Ermöglicht das Importieren von HTML-Dateien
  server: {
    port: 4000,
    open: true, // Auto-open browser on start
    proxy: {
      // Proxy API requests to your backend server
      "/api": {
        target: "http://localhost:3000", // Your Express backend URL
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist", // Output in the project root's dist folder
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "frontend"),
    },
  },
});