import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Static SPA. No API key ever reaches the browser — all Nansen calls happen
// offline in scripts/ and are baked into public/data/*.json at build-dataset time.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
