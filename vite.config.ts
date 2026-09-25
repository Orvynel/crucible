import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Static SPA. No API key ever reaches the browser — all Nansen calls happen
// offline in scripts/ and are baked into public/data/*.json at build-dataset time.
// Relative base ("./") so the build runs from any path — root domain or a
// project subpath like <user>.github.io/crucible/ — without reconfiguration.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  // Dev only: forward /api/* to the local Nansen proxy (`npm run dev:proxy`) so the
  // live explorer works under `npm run dev`. In production the Vercel function
  // api/nansen.ts serves /api/nansen; this block is ignored by `vite build`.
  server: {
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
