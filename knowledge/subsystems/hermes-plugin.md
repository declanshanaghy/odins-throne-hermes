# Hermes plugin surface

The desktop half: src/entry.tsx registers a right pane (Sidebar job list) and a workspace page
(LogViewer) plus ⌘K commands. src/ui/ is the vendored web UI (see ui-sharing tech-design);
src/store.ts holds the StoreBridge snapshot; src/upstream.ts configures the monitor URL and the
otFetch relay (/api/ → /bot/api + bearer). build/build.mjs esbuild-bundles everything into one
ESM file (desktop/plugin.js) with CSS scoped :root → .odins-throne-root. Gates: tsc + build +
smoke + `hermes plugins validate .`.
