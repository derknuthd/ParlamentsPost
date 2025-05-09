import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "frontend", // Set the root directory for the frontend
  publicDir: "public", // Static assets folder
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
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "frontend/index.html"),
        impressum: resolve(__dirname, "frontend/impressum.html"),
        datenschutz: resolve(__dirname, "frontend/datenschutz.html"),
        nutzungsbedingungen: resolve(__dirname, "frontend/nutzungsbedingungen.html"),
        ueberuns: resolve(__dirname, "frontend/ueber-uns.html")
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "frontend"),
    },
  },
});