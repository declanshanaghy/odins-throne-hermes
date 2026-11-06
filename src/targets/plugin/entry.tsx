// Plugin entry. esbuild bundles this (plus the vendored SPA under src/ui)
// into ONE plain-ESM file: desktop/plugin.js. Only react, react/jsx-runtime
// and @hermes/plugin-sdk stay external — they resolve to the app's own copies.

import {
  host,
  PALETTE_AREA,
  PANES_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
} from "@hermes/plugin-sdk";
// The vendored Norse stylesheet, scoped to .odins-throne-root by the build
// (build/build.mjs) — never touches the app's own theme.
import scopedCss from "../../ui/styles/index.css";
import { setPlatform } from "../../ui/platform";
import { pluginPlatform } from "./platform";
import { ThronePane } from "./pane";
import { ThronePage } from "./page";
import { settingsUi } from "./settings";
import { findSessionUi } from "../../ui/components/Sidebar";
import { setCtx, setThroneTabOpener } from "./pluginCtx";
import { initSessionTabs, openSessionTab } from "./sessionTabs";
import { throneStore } from "../../ui/store";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Source+Serif+4:wght@300;400;600&family=JetBrains+Mono:wght@400;500;600&display=swap";

// Install the plugin platform adapter BEFORE any ui/ code renders — the
// shared core resolves every seam (theme root, WS URL, REST mapping,
// portraits, log-view focus) through it.
setPlatform(pluginPlatform);

const STYLE_ID = "odins-throne-hermes-style";
const FONT_ID = "odins-throne-hermes-fonts";

// Plugin chrome (not part of the vendored SPA): connect card, settings
// dialog, boot state — same Norse tokens, every selector pre-scoped.
const PLUGIN_CHROME_CSS = `
.odins-throne-root .throne-connect-card {
  position: absolute; inset: 0; z-index: 50;
  display: flex; flex-direction: column; gap: 14px;
  align-items: center; justify-content: center; text-align: center;
  padding: 24px; background: rgba(7, 7, 13, 0.93);
  color: var(--text-saga); font-family: "Source Serif 4", serif; font-size: 0.85rem;
  line-height: 1.55;
}
.odins-throne-root .throne-connect-card p { max-width: 30ch; margin: 0; }
.odins-throne-root .throne-boot {
  position: absolute; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; color: var(--text-rune); font-style: italic; font-size: 0.8rem;
}
.odins-throne-root .throne-settings {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  z-index: 60; display: flex; flex-direction: column; gap: 0.85rem;
  background: var(--forge); border: 1px solid var(--rune-border); border-radius: 10px;
  padding: 1.25rem; width: min(92%, 460px);
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.65);
}
.odins-throne-root .throne-settings h2 {
  margin: 0; font-family: "Cinzel", serif; font-weight: 700;
  color: var(--gold-bright); font-size: 1.05rem;
}
.odins-throne-root .throne-settings-hint { font-size: 0.76rem; color: var(--text-rune); line-height: 1.55; margin: 0; }
.odins-throne-root .throne-settings label { display: flex; flex-direction: column; gap: 5px; font-size: 0.74rem; color: var(--text-rune); }
.odins-throne-root .throne-settings-row { display: flex; gap: 8px; justify-content: flex-end; }
.odins-throne-root .throne-settings-btn {
  padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(201, 146, 10, 0.35);
  background: rgba(201, 146, 10, 0.08); color: var(--gold);
  font-family: "Cinzel", serif; font-size: 0.8rem; font-weight: 600;
}
.odins-throne-root .throne-settings-btn:hover { background: rgba(201, 146, 10, 0.16); }
.odins-throne-root .throne-settings-btn.primary {
  border-color: var(--gold); background: rgba(201, 146, 10, 0.22); color: var(--gold-bright);
}
.odins-throne-root .throne-settings-btn:disabled { opacity: 0.55; cursor: wait; }
`;

export default {
  id: "odins-throne-hermes",
  name: "Odin's Throne",
  description:
    "Hlidskjalf in Hermes — right-pane job list and main-pane log viewer for GKE agent-sandbox Jobs.",
  defaultEnabled: true,
  register(ctx: any) {
    setCtx(ctx);
    // Per-session workspace tabs (issue:6): session clicks open a dedicated
    // closeable tab via host.openWorkspace; older hosts fall back to
    // per-session route pages registered through this ctx.
    initSessionTabs(ctx);

    // Wire the workspace-tab opener (the pane's job-card click seam).
    // host.openWorkspace (SDK ≥ [current]) docks a plugin-rendered tab in the
    // main workspace zone; re-calling with the same id re-fronts the existing
    // tab. Issue:6 supersedes the single shared tab: every session gets its
    // OWN tab (id "odins-throne-session-<sessionId>"), so selection itself
    // opens the per-session tab — App.handleSelectSession → openSessionTab.
    setThroneTabOpener((sessionId: string) => {
      const snap = throneStore.get();
      if (snap) {
        // Marks the sidebar selection AND opens the per-session workspace
        // tab; each tab renders its own stream (issue:6).
        snap.onSelectSession(sessionId);
      } else {
        // No StoreBridge mounted (pane closed): open the tab directly with
        // defaults — the tab owns its own WS + log stream anyway.
        openSessionTab(sessionId, { namespace: "fenrir-agents", job: null });
      }
    });

    // Google Fonts (same families as the SPA's index.html).
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement("link");
      link.id = FONT_ID;
      link.rel = "stylesheet";
      link.href = FONTS_HREF;
      document.head.append(link);
      ctx.onDispose(() => link.remove());
    }

    // Scoped Norse theme — every selector is prefixed with .odins-throne-root
    // at build time, so the app's own theme is never touched.
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = scopedCss + "\n" + PLUGIN_CHROME_CSS;
      document.head.append(style);
      ctx.onDispose(() => style.remove());
    }

    // Right-docked job list beside the conversation (hermes-bots Routines
    // pattern: placement 'main' + dock workspace/right claims the edge).
    ctx.register({
      id: "jobs",
      area: PANES_AREA,
      title: "Odin's Throne",
      data: {
        placement: "main",
        dock: { pane: "workspace", pos: "right", enforce: true },
        width: "300px",
      },
      render: () => <ThronePane />,
    });

    // Workspace page with the log terminal for the selected session.
    ctx.register({
      id: "page",
      area: ROUTES_AREA,
      data: { path: "/odins-throne" },
      render: () => <ThronePage />,
    });

    // Reachability: sidebar nav row + ⌘K commands.
    ctx.register({
      id: "nav",
      area: SIDEBAR_NAV_AREA,
      order: 60,
      data: {
        path: "/odins-throne",
        label: "Odin's Throne",
        codicon: "project",
      },
    });
    ctx.register({
      id: "open",
      area: PALETTE_AREA,
      data: {
        id: "odins-throne.open",
        label: "Odin's Throne: Open Hlidskjalf",
        keywords: ["odin", "throne", "hlidskjalf", "jobs", "agents", "gke"],
        run: () => host.navigate("/odins-throne"),
      },
    });
    ctx.register({
      id: "configure",
      area: PALETTE_AREA,
      data: {
        id: "odins-throne.configure",
        label: "Odin's Throne: Configure upstream",
        keywords: ["odin", "throne", "token", "url", "bifrost"],
        run: () => settingsUi.open(),
      },
    });
    ctx.register({
      id: "find-session",
      area: PALETTE_AREA,
      data: {
        id: "odins-throne.find-session",
        label: "Odin's Throne: Find session",
        keywords: ["odin", "throne", "find", "search", "filter", "session", "hlidskjalf"],
        run: () => findSessionUi.focus(),
      },
    });
  },
};

// Test seams: the smoke/stream tests import these from the built bundle and
// exercise the log-parsing pipeline directly. Not used by the desktop host.
export { HermesLogParser } from "../../ui/lib/hermesFormat";
export { parseMarkdown, Markdown } from "../../ui/lib/markdown";
export { useLogStream } from "../../ui/hooks/useLogStream";
export { parseDecree, isDecreeBlock } from "../../ui/components/DecreeBlock";
// Pinned-session overlay seam (cached-tree tests) — the pin-cache → summary
// merge that hangs Odin's memory on the tree.
export {
  cachedJobFromMeta,
  cachedOverlayEntries,
  mergeCachedIntoSummaries,
} from "../../ui/lib/cachedOverlay";
// Tab-opening seam — lets smoke.mjs assert the openThroneTab→openWorkspace
// wiring after plugin.register() has run.
export { openThroneTab } from "./pluginCtx";
