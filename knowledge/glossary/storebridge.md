# StoreBridge

The plugin's App.tsx adapter: instead of mounting the full-page web app, it publishes UI state
into src/store.ts so the pane (Sidebar) and the page (LogViewer) render as separate Hermes
surfaces. The web target keeps the full-page App shell.
