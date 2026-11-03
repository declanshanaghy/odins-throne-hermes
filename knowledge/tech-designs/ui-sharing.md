# UI sharing: the vendored ui/ core + target adapters

src/ui/ is vendored from fenrir-ledger development/odins-throne/ui — copied, not shared. As of
the 2026-11-02 audit: 17 of 28 shared-path files byte-identical; 96.1% aggregate character-level
similarity over 9,108 shared-origin LOC; this repo's copy is the superset (adds NamespaceTree,
useNamespaceSummaries, hermesFormat — hermes-harness log parsing).

Since issue #17 the five points where the targets diverge live behind ONE platform adapter
interface, src/ui/platform.ts — the ui/ core imports no target:

1. Theme root — applyTheme: web sets data-theme on <html>; plugin scopes to .odins-throne-root
2. WS URL — wsUrl: same-origin /ws vs ${base}/bot/ws?token=
3. REST — restFetch: same-origin /api/* vs the otFetch mapping to /bot/api + bearer
4. Assets — avatarUrl: /profiles/*.png URLs vs imported data-URLs
5. App shell — shell marker + focusLogView: full-page AppShell (targets/web) vs headless
   StoreBridge (ui/App) whose snapshot the plugin's pane + workspace page render

Each target implements the interface: src/targets/plugin/platform.ts (desktop, pairs with
upstream.ts) and src/targets/web/platform.ts (the original SPA flavor). Targets install their
adapter at entry time via setPlatform() before any ui/ code renders. The snapshots the shells
render from live in the neutral pub/sub store src/ui/store.ts.

CSS scoping is still build-time (postcss :root→.odins-throne-root in the plugin bundle only;
the web bundle ships the stylesheet unscoped), so one stylesheet serves both.
