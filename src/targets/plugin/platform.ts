// The plugin platform adapter — the desktop flavor of the five seams
// (knowledge/tech-designs/ui-sharing.md):
//
//   1. Theme: no-op here — the pane/page roots carry data-theme from React
//      state, so the app's own theme is never touched.
//   2. WS: the monitor's token-gated bot surface (?token= pairing session).
//   3. REST: otFetch maps the SPA's /api/* paths onto /bot/api + bearer.
//   4. Assets: portraits bundled as data URLs (relative /profiles/* paths
//      cannot resolve inside the app's blob-loaded plugin module).
//   5. Shell: headless StoreBridge — the pane and the workspace page render
//      from the published snapshot.
//
// The avatar imports below are why the esbuild PNG dataurl loader still sees
// every portrait: the adapter owns asset resolution for the whole ui core.

import { host } from "@hermes/plugin-sdk";
import type { PlatformAdapter } from "../../ui/platform";
import { otFetch, wsUrl } from "./upstream";
import { openSessionTab, closeSessionTab } from "./sessionTabs";
import avatarFiremandeckoDark from "../../assets/profiles/fireman-decko-dark.png";
import avatarLokiDark from "../../assets/profiles/loki-dark.png";
import avatarLunaDark from "../../assets/profiles/luna-dark.png";
import avatarFreyaDark from "../../assets/profiles/freya-dark.png";
import avatarHeimdallDark from "../../assets/profiles/heimdall-dark.png";
import avatarOdinDark from "../../assets/profiles/odin-dark.png";
import avatarFiremandeckoLight from "../../assets/profiles/fireman-decko-light.png";
import avatarLokiLight from "../../assets/profiles/loki-light.png";
import avatarLunaLight from "../../assets/profiles/luna-light.png";
import avatarFreyaLight from "../../assets/profiles/freya-light.png";
import avatarHeimdallLight from "../../assets/profiles/heimdall-light.png";
import avatarOdinLight from "../../assets/profiles/odin-light.png";

const DARK_AVATARS: Record<string, string> = {
  firemandecko: avatarFiremandeckoDark,
  loki: avatarLokiDark,
  luna: avatarLunaDark,
  freya: avatarFreyaDark,
  heimdall: avatarHeimdallDark,
  odin: avatarOdinDark,
};

const LIGHT_AVATARS: Record<string, string> = {
  firemandecko: avatarFiremandeckoLight,
  loki: avatarLokiLight,
  luna: avatarLunaLight,
  freya: avatarFreyaLight,
  heimdall: avatarHeimdallLight,
  odin: avatarOdinLight,
};

export const pluginPlatform: PlatformAdapter = {
  shell: "plugin",

  // Seam 1: the .odins-throne-root surfaces render data-theme from useTheme
  // state — the desktop app's own <html> theme stays untouched.
  applyTheme(_theme) {
    /* intentionally blank */
  },

  // Seam 2: dial the monitor's bot surface with the pairing session.
  wsUrl,

  // Seam 3: SPA paths → /bot/api + bearer (see upstream.ts).
  restFetch: otFetch,

  // Seam 4: bundled data URLs.
  avatarUrl(agentKey, variant) {
    return (variant === "light" ? LIGHT_AVATARS : DARK_AVATARS)[agentKey];
  },

  // Best-effort focus of the workspace log page; selection itself always
  // works via the store.
  focusLogView() {
    try {
      if (!window.location.hash.startsWith("#/odins-throne")) {
        host.navigate("/odins-throne");
      }
    } catch {
      // navigation unavailable — selection still works via the store
    }
  },

  // Seam 6: one closeable workspace tab per session (issue:6) — a fresh tab
  // for a new session, focus + refresh for an already-open one. Older hosts
  // without host.openWorkspace fall back to a per-session route page.
  openSessionLog(sessionId, target) {
    openSessionTab(sessionId, { namespace: target.namespace, job: target.job });
  },

  // Seam 7: a confirmed Ragnarök kills the pod, so the session's log tab
  // closes with it (reference design: "cancel closes its tab").
  closeSessionLog(sessionId) {
    closeSessionTab(sessionId);
  },
};
