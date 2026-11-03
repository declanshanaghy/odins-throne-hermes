# StoreBridge

The plugin's headless App (src/ui/App.tsx): instead of mounting the full-page web shell, it
publishes UI state into src/ui/store.ts so the pane (Sidebar) and the page (LogViewer) render as
separate Hermes surfaces. The web target renders the same snapshot full-page
(src/targets/web/AppShell.tsx). Which shell hosts the core is seam 5 of the platform adapter
(src/ui/platform.ts).
