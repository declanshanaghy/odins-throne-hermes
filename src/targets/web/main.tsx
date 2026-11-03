// Web target entry — installs the web platform adapter and mounts the
// full-page AppShell into #root. The deployed monitor (fenrir-ledger's
// development/odins-throne) serves the production page; this target is the
// same ui core with the web seams, buildable for local dev:
//
//   <div id="root"></div>
//   <script type="module" src="/app.js"></script>  (react/react-dom via the page)

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
  createRoot(rootEl).render(<AppShell />);
}
