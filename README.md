# Odin's Throne — Hermes Desktop Plugin

**Hlidskjalf inside Hermes.** The [Odin's Throne](https://github.com/declanshanaghy/fenrir-ledger)
monitor for GKE agent-sandbox Jobs, ported into the Hermes desktop app as a
first-class plugin:

- **Right pane** — the job list (SessionCards, namespace selector, WSS badge,
  theme switcher, Odin himself), docked beside the conversation.
- **Middle pane** — the log terminal (streaming JSONL, tool blocks, Norse
  tablets, verdict inscriptions) as a workspace page at `/odins-throne`.
- Same Norse pixels (the full 3,230-line theme, scoped to the plugin's own
  surfaces), same behavior (live jobs push, pin cache, Ragnarök, downloads,
  fixture speed controls, error tablets) — the UI is **vendored, not rewritten**.

```mermaid
flowchart LR
    GKE["GKE<br/>agent-sandbox Jobs"] --> OT["odins-throne<br/>(fenrir-monitor)"]
    OT <-->|"wss /bot/ws?namespace&token<br/>REST /bot/api/* (Bearer)"| UI["plugin.js<br/>(renderer)"]
    UI --> RP["right pane:<br/>job list"]
    UI --> MP["workspace page:<br/>log terminal"]
```

## Layout

```
plugin.yaml              # manifest (unified plugin package)
__init__.py              # agent half — registers nothing yet
desktop/plugin.js        # BUILT single-file desktop half (committed for install)
src/
  entry.tsx              # register(ctx): pane + route + nav + ⌘K commands
  pane.tsx / page.tsx    # the two surfaces (Sidebar / LogViewer)
  App.tsx (ui/)          # StoreBridge — the ported App publishes to src/store.ts
  upstream.ts            # /bot surface mapping, URL + bot-token config
  settings.tsx           # first-run "Bind the Bifröst" dialog (⌘K)
  ui/                    # vendored from fenrir-ledger/development/odins-throne/ui
  assets/profiles/       # agent portraits (inlined as data URLs at build)
build/build.mjs          # esbuild + CSS scoping; --watch --live for dev
```

## Install

```bash
hermes plugins install declanshanaghy/odins-throne-hermes
# desktop half is opt-in by design — flip it on:
#   Hermes desktop → Capabilities → Plugins → Odin's Throne
```

Then configure the upstream once: **⌘K → "Odin's Throne: Configure
upstream"** — the deployed monitor's URL (defaults to
`https://odins-throne.fenrirledger.com`) and a bot token. Local dev servers
(`pnpm dev` in `development/odins-throne`) need no token.

> The deployed instance sits behind Google OAuth; plugins can't hold that
> session, so the monitor ships a token-gated mirror surface — REST under
> `/bot/api/*` (`Authorization: Bearer`) and the multiplexed stream at
> `/bot/ws` (`?token=`). Same protocol, same server logic, zero duplication.

## Dev loop (live reload)

```bash
npm install
npm run dev
```

esbuild watches; every save rebuilds `desktop/plugin.js` and mirrors it into
`~/.hermes/desktop-plugins/odins-throne-hermes/plugin.js`, which the desktop
app hot-reloads within seconds — **no app restart, no reload command needed**.
Set a different upstream URL in the settings dialog to point at a local
monitor.

Gates: `npx tsc --noEmit` (type check) and `npm run build` (bundle must
build). Before committing UI changes, run `npm run build` so the committed
`desktop/plugin.js` matches `src/`.

## Deliberate deviations from the SPA

- The pane sash (host) resizes the job list — the browser's in-app drag handle
  is gone; compact/normal/extended display modes react to pane width instead.
- Odin's light/dark theme scopes to the plugin's own surfaces, not the window.
- Modals/toasts overlay the app window from the pane (fixed positioning).
- Path params don't exist in the app router — the selected session travels
  via shared module state; `/odins-throne` is a single route.

## Source of truth

The SPA lives in
[`fenrir-ledger/development/odins-throne`](https://github.com/declanshanaghy/fenrir-ledger);
this repo vendors the `ui/` tree (copied, not shared — the two repos are
deliberately uncoupled, same convention as claude-todo ↔ hermes-todo). The
`/bot/*` server surface is implemented in the fenrir-ledger monitor.
Evaluation: `fenrir-ledger/plans/004-odins-throne-hermes-desktop-plugin.md`.

## License

MIT
