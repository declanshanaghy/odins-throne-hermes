// The web platform adapter — the original SPA flavor of the five seams
// (knowledge/tech-designs/ui-sharing.md), as the deployed monitor's page
// behaves: same-origin routes, Google-gated by the site's oauth2-proxy:
//
//   1. Theme: data-theme on <html> (the page owns the whole document).
//   2. WS: same-origin /ws.
//   3. REST: same-origin /api/* — plain fetch, the cookie session carries auth.
//   4. Assets: same-origin /profiles/*.png URLs.
//   5. Shell: the full-page AppShell (see AppShell.tsx).

import type { PlatformAdapter } from "../../ui/platform";

// Portrait file stems — agent keys map onto the /profiles/ file names
// ("firemandecko" → "fireman-decko", the rest are identity).
const PORTRAIT_STEMS: Record<string, string> = {
  firemandecko: "fireman-decko",
  loki: "loki",
  luna: "luna",
  freya: "freya",
  heimdall: "heimdall",
  odin: "odin",
};

export const webPlatform: PlatformAdapter = {
  shell: "web",

  // Seam 1: the web page owns <html>.
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  },

  // Seam 2: same-origin /ws — the site's own session gates the socket.
  wsUrl(namespace) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws?namespace=${encodeURIComponent(namespace)}`;
  },

  // Seam 3: the SPA's original paths, untouched.
  restFetch(path, init) {
    return fetch(path, init);
  },

  // Seam 4: same-origin portrait URLs.
  avatarUrl(agentKey, variant) {
    const stem = PORTRAIT_STEMS[agentKey];
    return stem ? `/profiles/${stem}-${variant}.png` : undefined;
  },

  // The full-page shell shows the sidebar and the log terminal at once —
  // nothing to bring forward.
  focusLogView() {
    /* intentionally blank */
  },
};
