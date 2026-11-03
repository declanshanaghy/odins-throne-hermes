// Web target entry — installs the web platform adapter and mounts the
// full-page AppShell into #root. Vite builds this (build:web) into the
// dist-ui/ bundle the deployed monitor serves; the ui core is consumed
// unscoped because on the web the page owns the whole document.
//
//   <div id="root"></div>
//   <script type="module" src="./main.tsx"></script>  (Vite resolves it)

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setPlatform } from "../../ui/platform";
import { currentTheme } from "../../ui/hooks/useTheme";
import { webPlatform } from "./platform";
import { AppShell } from "./AppShell";
// The SPA's own stylesheet, unscoped — on the web the page owns the document.
import "../../ui/styles/index.css";

setPlatform(webPlatform);
// Seam 1 (web): the stored preference lands on <html> before first paint.
webPlatform.applyTheme(currentTheme());

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AppShell />
    </StrictMode>
  );
}
