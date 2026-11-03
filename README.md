# Odin's Throne — Hermes Desktop Plugin

**Hlidskjalf inside Hermes.** The [Odin's Throne](https://github.com/declanshanaghy/fenrir-ledger)
monitor for GKE agent-sandbox Jobs, ported into the Hermes desktop app as a
first-class plugin:

- **Right pane** — the job list (SessionCards, namespace selector, WSS badge,
  theme switcher, Odin himself), docked beside the conversation. Clicking a
  job card opens the log terminal in a new workspace tab (or focuses it if
  it is already open).
- **Middle pane** — the log terminal (Claude Code JSONL **and** Hermes
  pretty-format streams, tool blocks, Norse tablets, verdict inscriptions) as
  a workspace page at `/odins-throne`.
- Same Norse pixels (the full 3,230-line theme, scoped to the plugin's own
  surfaces), same behavior (live jobs push, pin cache, Ragnarök, downloads,
  fixture speed controls, error tablets) — the UI is **vendored, not rewritten**.

```mermaid
flowchart LR
    U["You, in your real browser"] -->|"1. Google OAuth (the website's login)"| PP["pairing page<br/>/api/handoff"]
    PP -->|"2. one-time code"| PANE["pairing card<br/>(plugin pane)"]
    PANE -->|"3. redeem"| BOT["/bot/handoff/redeem<br/>→ 7-day session"]
    GKE["GKE<br/>agent-sandbox Jobs"] --> OT["odins-throne<br/>(fenrir-monitor)"]
    OT <-->|"Bearer session (REST)<br/>?token= (WS)"| UI["plugin.js<br/>(renderer)"]
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
  upstream.ts            # upstream URL config + OAuth-only otFetch relay
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

Then pair once: click **"Sign in with Google"** on the pane. Google's
embedded-browser policy makes in-app Google logins impossible (it blocks the
credential step inside any webview), so the login runs where Google wants it
— your real browser:

1. The pane opens **your browser** at the monitor's pairing page — behind the
   website's own Google OAuth. No Google login ⇒ no key.
2. The page shows a signed, user-scoped pairing key (click to copy).
3. Paste it into the pane → **Pair** → the jobs stream. It lasts 7 days;
   when it expires the pairing card simply returns.

The key is minted directly by the Google-authenticated page and verified
statelessly by every monitor replica (HMAC over a shared secret) — nothing is
stored server-side, so it works across the deployment's multiple pods.

> **There is no other way in.** No Google login, no key, no data — and no
> standing credential either. The only setting is the upstream URL (⌘K →
> "Odin's Throne: Configure upstream"), overridden for local dev servers
> (`pnpm dev` in `development/odins-throne`, which run without
> oauth2-proxy). Server side: `src/handoff.ts` (fenrir-ledger #2377).

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

## Session log formats

The log terminal parses **both harnesses'** output into the same structured
entries — agent bubbles, tool batches, warnings, the decree tablet and the
verdict inscription:

- **Claude Code** — stream-JSONL (`src/ui/lib/jsonl.ts` → `useLogStream`).
- **Hermes** — pretty-format sessions (`☤ Hermes` turns, `💻 $`/`✗ $`
  terminal calls, `📖 Read`, `✍️ Write`/`🔧 Patch` with `│` diffs,
  `🔎 Searching tools`, `📋 Plan`; the duplicated `Query:` prompt echo is
  suppressed) via the line-oriented state machine in
  `src/ui/lib/hermesFormat.ts`, activated by the
  `=== Starting Hermes Agent ===` entrypoint header. Unknown lines fall back
  to dimmed raw text — a Hermes format change degrades to the old rendering,
  never to a blank pane. The decree parser also re-inserts the line breaks the
  Hermes harness sometimes eats, so the glued one-line decree
  (`…#9VERDICT: DONEPR: …`) still parses canonically.

Regression guard: `test/hermes-stream.mjs` replays a synthetic Hermes session
through the real hook (from the built bundle, same bytes the desktop loads)
and asserts the structured entries end to end.

## Deliberate deviations from the SPA

- The pane sash (host) resizes the job list — the browser's in-app drag handle
  is gone; compact/normal/extended display modes react to pane width instead.
- Job cards are squashed for dense lists (hundreds of jobs): the status icon
  LEADS the card's secondary meta line — under the title, beside the avatar
  column, so statuses scan down the left edge — instead of trailing on the
  right; padding/avatars/buttons are tighter than the SPA, and the meta line
  ellipsizes instead of wrapping (extended mode still wraps).
- Odin's light/dark theme scopes to the plugin's own surfaces, not the window.
- Modals/toasts overlay the app window from the pane (fixed positioning).
- Path params don't exist in the app router — the selected session travels
  via shared module state; `/odins-throne` is a single route. Clicking a job
  card in the pane calls `host.openWorkspace("throne-log", …)` to open (or
  re-front) a dedicated workspace tab; on older desktop builds that lack
  `host.openWorkspace` it falls back to `host.navigate("/odins-throne")`.

## Source of truth

The SPA lives in
[`fenrir-ledger/development/odins-throne`](https://github.com/declanshanaghy/fenrir-ledger);
this repo vendors the `ui/` tree (copied, not shared — the two repos are
deliberately uncoupled, same convention as claude-todo ↔ hermes-todo). The
`/bot/*` server surface is implemented in the fenrir-ledger monitor.
Evaluation: `fenrir-ledger/plans/004-odins-throne-hermes-desktop-plugin.md`.

## License

MIT
