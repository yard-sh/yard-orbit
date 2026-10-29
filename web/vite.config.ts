import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The app is served at /<slug>/app/ (and /<slug>/@<sandbox>/app/ in a
// sandbox), so every URL Vite writes must be relative: base "./".
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  build: {
    outDir: "../app",
    emptyOutDir: true,
    // The app ships as one bundle (about 400 KB gzipped) that every page
    // needs anyway; split routes with lazy() if it grows much further.
    chunkSizeWarningLimit: 1500,
  },
});
