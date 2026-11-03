# Odin's Throne — Knowledge Base Index

One line per topic. Pointers, not content.

## Domain Glossary
- [Hlidskjalf](glossary/hlidskjalf.md) — Odin's Throne itself: the high seat, the pack's agent-sandbox job monitor
- [The two halls](glossary/the-two-halls.md) — old hall (fenrirledger.com) and new hall (odins-throne.shanaghy.com); promotion terminology
- [The pairing gate](glossary/the-pairing-gate.md) — Google-auth pairing page; the only door for browser and plugin
- [StoreBridge](glossary/storebridge.md) — the headless App publishing UI state into src/ui/store.ts
- [RingFort and Stone](glossary/ringfort-and-stone.md) — shanaghy.com's listing card and project page for live sites

## Subsystem Map
- [Hermes plugin surface](subsystems/hermes-plugin.md) — the desktop half: pane + page, StoreBridge, esbuild single-file bundle
- [The monitor service](subsystems/monitor-service.md) — Hono server + React UI: jobs, WS log streams, handoff, botToken
- [Deployment](subsystems/deployment-gke.md) — GKE Autopilot, Helm chart, oauth2-proxy gate, Artifact Registry

## Tech-Designs
- [UI sharing: vendored ui/](tech-designs/ui-sharing.md) — the ui/ core, the targets/{web,plugin} adapters and the five seam points
