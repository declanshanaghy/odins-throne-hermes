# Hermes plugin surface

The desktop half: src/targets/plugin/entry.tsx registers a right pane (Sidebar job list) and a
static workspace page plus ⌘K commands, and installs the plugin platform adapter
(src/targets/plugin/platform.ts — see the ui-sharing tech-design). Session clicks stack one
closeable workspace tab per session (issue #6 — sessionTabs.tsx on host.openWorkspace, with a
per-session route-page fallback on older hosts); each tab renders the shared per-session
terminal (ui/components/SessionLogViewer.tsx — own WebSocket + log stream per mount).
src/ui/ is the platform-agnostic vendored core; src/ui/store.ts holds the StoreBridge
snapshot (pane-level state only); src/targets/plugin/upstream.ts
configures the monitor URL and the otFetch relay (/api/ → /bot/api + bearer). build/build.mjs
esbuild-bundles the plugin into one ESM file (desktop/plugin.js, CSS scoped :root →
.odins-throne-root). The web target is Vite's (issue #18): `npm run build:web` builds
src/targets/web/ (index.html + main.tsx + the web adapter) into dist-ui/ from the same
src/ui/ core, CSS unscoped. Gates: tsc (both targets) + build + build:web +
smoke + `hermes plugins validate .`.
