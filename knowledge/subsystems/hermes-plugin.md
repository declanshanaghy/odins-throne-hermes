# Hermes plugin surface

The desktop half: src/targets/plugin/entry.tsx registers a right pane (Sidebar job list) and a
workspace page (LogViewer) plus ⌘K commands, and installs the plugin platform adapter
(src/targets/plugin/platform.ts — see the ui-sharing tech-design). src/ui/ is the platform-agnostic
vendored core; src/ui/store.ts holds the StoreBridge snapshot; src/targets/plugin/upstream.ts
configures the monitor URL and the otFetch relay (/api/ → /bot/api + bearer). build/build.mjs
esbuild-bundles the plugin into one ESM file (desktop/plugin.js, CSS scoped :root →
.odins-throne-root) and the web target into build/web/app.js + app.css. Gates: tsc + build +
smoke + `hermes plugins validate .`.
