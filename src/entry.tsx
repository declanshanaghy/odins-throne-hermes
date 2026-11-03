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
import scopedCss from "./ui/styles/index.css";
import { ThronePane } from "./pane";
import { ThronePage } from "./page";
import { settingsUi } from "./settings";
import { setCtx } from "./pluginCtx";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Source+Serif+4:wght@300;400;600&family=JetBrains+Mono:wght@400;500;600&display=swap";

const STYLE_ID = "odins-throne-hermes-style";
const FONT_ID = "odins-throne-hermes-fonts";

export default {
  id: "odins-throne-hermes",
  name: "Odin's Throne",
  description:
    "Hlidskjalf in Hermes — right-pane job list and main-pane log viewer for GKE agent-sandbox Jobs.",
  defaultEnabled: true,
  register(ctx: any) {
    setCtx(ctx);

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
      style.textContent = scopedCss;
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
  },
};
