# Odin's Throne Promotion — working design doc (throwaway, plan-w-team loop)

USER_PROMPT: Adopt the web UI into odins-throne-hermes as its own deployable asset — on the
path to deprecating and removing odins-throne from fenrir-ledger and promoting it to a
first-class service. Duplicate on the web first; when fully functional, kill off the old one.
Deploy alongside as https://odins-throne.shanaghy.com. Also file issues to update its info
on www.shanaghy.com with pre-generated content and previews.

## Ground truth (Phase 0, codebase-first)

- Current site = fenrir-ledger/development/odins-throne: Hono server (src/: index.ts, k8s.ts,
  ws.ts, handoff.ts, botToken.ts, report.ts) serving Vite-built UI (ui/, 9,167 LOC) + REST + WS.
  Dockerfile → Artifact Registry (us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/odin-throne).
- Deployed via Helm chart infrastructure/helm/odin-throne, namespace fenrir-monitor, GKE
  ingress + global IP + Cloud DNS A record (dns.tf), behind shared oauth2-proxy Google client
  (oauth.tf). Google-auth pairing page (handoff.ts) is the ONLY way in for both browser and plugin.
- odins-throne-hermes (created 2026-11-02) vendors ui/ into src/ui/ (9,985 LOC; 96.1% similar,
  17 files byte-identical) + plugin shell (entry/pane/page/store/upstream/settings) + esbuild
  single-file build with CSS scoping. HAS UNCOMMITTED EDITS RIGHT NOW (App.tsx, pane.tsx,
  store.ts modified; NamespaceSelector.tsx deleted).
- odins-throne.shanaghy.com: DNS CNAME already exists → declanshanaghy.github.io, but nothing
  serves it (TLS fails). www.shanaghy.com itself is GitHub Pages (GH Actions workflow deploy,
  Next export). shanaghy.com repo: web/content is canonical; RingForts list in sites.html +
  project "stones" under content/projects/<slug>/ + living garden (garden.json souls).
- gh token scopes: gist, read:org, repo — NO read:project → pack board machinery
  (pack-status.mjs, sub-issue columns) blocked until `gh auth refresh -s read:project`.
  odins-throne-hermes repo has default labels only (no ux/security/priority labels), no board.
- fenrir-ledger package.json of odins-throne: "TESTS ARE BANNED — validate via tsc + build ONLY."
  Plugin repo gates: tsc + build + smoke + `hermes plugins validate .` (from memory).

## 1. Skeleton

**Direction (freya):** Promote Odin's Throne (Hlidskjalf) out of its buried life as a fenrir-ledger
development app into a first-class service living in its own repo, odins-throne-hermes, raised as
the new hall at odins-throne.shanaghy.com on the existing GKE cluster. Duplicate on the web first;
only when the new hall proves full parity do we decree the old hall's death and finish the
fenrir-ledger exodus.

**Sub-areas (freya):**
1. **Web-app packaging (the new hall's bones)** — src/ui/ becomes the canonical web UI; the Hono
   server (index.ts, k8s.ts, ws.ts, handoff.ts, report.ts, botToken.ts) migrates in from
   fenrir-ledger; the repo yields one self-contained deployable: UI + REST + WS.
2. **Deployment and hosting (raising the hall)** — new Helm release in the existing cluster
   (pattern: infrastructure/helm/odin-throne), GKE ingress + global IP, Cloud DNS repoint of
   odins-throne.shanaghy.com from github.io to GKE. Same-origin, no CORS.
3. **Auth and pairing (the gate)** — Google-auth pairing page (handoff.ts) stays the only door for
   browser + plugin. Open: shared oauth2-proxy client from oauth.tf vs the new hall minting its own.
4. **Parity definition (the measuring rope)** — named, testable parity checklist (job list, live WS
   logs, handoff/pairing, report surface, botToken surface) that alone gates the old hall's death.
5. **Hermes plugin changes (the pack's tether)** — what the promotion means for entry/pane/page/
   store/upstream/settings + StoreBridge: vendored-local, served-new-hall, or one shared build.
6. **shanaghy.com content (the public runes)** — RingFort entry in web/content/sites.html + project
   Stone under web/content/projects/<slug>/ with pre-generated content and previews. Issues file on
   shanaghy.com; its GH Actions Next-export pipeline stays.
7. **Sequencing and waves (the march order)** — W1 epic-home setup (labels/board/gh refresh) →
   W2 package web app + backend → W3 deploy beside old hall, verify parity → W4 DNS cutover +
   exodus (retire Helm release + image, delete development/odins-throne, clear dns.tf/oauth.tf).
8. **Epic home and gates** — issues/labels/board on odins-throne-hermes. Gates: tsc + build +
   smoke + `hermes plugins validate .`. Tests stay banned under fenrir-ledger law.

## 2. Glossary (working)

- **Odin's Throne (Hlidskjalf)** — the GKE agent-sandbox job monitor: job list (Sidebar) + live
  log terminal (LogViewer).
- **The old hall** — odins-throne.fenrirledger.com (fenrir-ledger deployment, to be killed later).
- **The new hall** — odins-throne.shanaghy.com (the promoted first-class service).
- **Vendored ui/** — the 96%-identical copy of the web UI living in odins-throne-hermes/src/ui.
- **StoreBridge** — the plugin's App.tsx adapter publishing UI state into src/store.ts.
- **RingFort** — shanaghy.com sites.html listing entry for a live site.
- **Stone** — shanaghy.com project page under content/projects/<slug>/.

## 3. Open Questions Ledger

- [source: freya | target: odin] Parity bar: what does "fully functional" mean before the old hall
  dies — full parity across every surface (job list, live WS logs, pairing, report, botToken), or a
  named daily-driver subset? Does the death warrant require living on the new hall for a set time?
- [source: freya | target: odin] Users of the new hall — only you + the pack behind the Google
  pairing gate, or does a public odins-throne.shanaghy.com invite outside eyes? Does auth change if
  the audience grows?
- [source: freya | target: odin] Plugin changes: does it keep consuming vendored ui/ via StoreBridge,
  point at the served new hall, or share one build for both? Any plugin UX change in scope, or is
  this purely packaging + deployment?
- [source: freya | target: odin] shanaghy.com story: what is the Stone's slug, and is the framing a
  portfolio piece, an internal tooling showcase, or pack lore?
- [source: freya | target: odin] Previews: real screenshots of the running hall committed as assets,
  or generated mockups? Does the RingFort link go live before or after DNS cutover?
- [source: freya | target: odin] Sequencing: is the fenrir-ledger exodus a final wave inside this
  epic, or a separate follow-on epic once the new hall stands proven?
- [source: freya | target: fireman] Hono backend: migrate as-is? Reuse the shared oauth2-proxy
  Google client from oauth.tf or mint a new one? What breaks first if skipped? (decko pass running)
- [source: freya | target: fireman] Vendored ui/ carries uncommitted drift (App.tsx, pane.tsx,
  store.ts modified; NamespaceSelector.tsx deleted) — which copy is canonical for the parity
  checklist? Does the esbuild single-file CSS-scoped plugin build also hold up producing a full
  multi-file web bundle? (decko pass running)

## 4. Resolved

- **Hosting (odin, 2026-11-02):** Full-stack in GKE — new Helm release in the existing cluster
  (same pattern as the old hall), ingress + repoint odins-throne.shanaghy.com DNS from
  declanshanaghy.github.io to the GKE global IP. Same-origin UI/API/WS, exact parity, no CORS.
- **Epic home (odin, 2026-11-02):** issues + board live on odins-throne-hermes — the work's
  permanent home. Requires: label schema (ux/security/priority), a project board, and a one-time
  `gh auth refresh -s read:project` by Odin. shanaghy.com content issues file on shanaghy.com.
- **Backend adoption (follows from hosting):** the deployable asset includes the Hono server —
  k8s.ts, ws.ts, handoff.ts, report.ts, botToken.ts migrate into odins-throne-hermes so the new
  hall is self-contained. Parity requires it before the old hall dies.
