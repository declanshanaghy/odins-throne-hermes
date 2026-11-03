// Vite config for the web target — the full-page monitor page built from the
// same ui/ core the desktop plugin hosts (issue #18). Ported from fenrir-ledger
// development/odins-throne/vite.config.ts, adapted to this repo's layout:
//
//   root     src/targets/web  — index.html sits beside main.tsx
//   outDir   dist-ui/         — the served web bundle (gitignored)
//   publicDir src/assets      — ships the /profiles/*.png portraits and the
//                               /odin-*.png favicons at the same-origin URLs
//                               the web platform adapter (seam 4) emits, so
//                               the built page serves standalone
//
// Dev-server proxy mirrors the deployed monitor: everything the SPA dials is
// same-origin (/ws, /api, …) and forwarded to the hall's API server on :3001 —
// no CORS anywhere.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");

export default defineConfig({
  plugins: [react()],
  root: here,
  publicDir: resolve(ROOT, "src/assets"),
  build: {
    outDir: resolve(ROOT, "dist-ui"),
    emptyOutDir: true,
  },
  server: {
    port: 3002,
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3001",
      },
      "/healthz": {
        target: "http://localhost:3001",
      },
      "/static": {
        target: "http://localhost:3001",
      },
      "/auth": {
        target: "http://localhost:3001",
      },
    },
  },
});
