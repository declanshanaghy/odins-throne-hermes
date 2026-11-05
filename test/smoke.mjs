// Render smoke test for the BUILT artifact (desktop/plugin.js) — the same
// bytes the desktop app loads. Registers the plugin against a stub ctx,
// renders both surfaces (right-pane job list + workspace log page) with the
// Hermes app's own React into a jsdom document, and asserts the ported Norse
// UI actually mounts: scoped theme, sidebar, connect card, overlays, route.
//
// Run: npm test   (node --import ./test/register.mjs test/smoke.mjs)
// Requires `npm run build` first.

import jsdomPkg from "jsdom";
const { JSDOM } = jsdomPkg;
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const hermesDesktop = `${process.env.HOME}/.hermes/hermes-agent/apps/desktop/package.json`;
const localPkg = join(here, "..", "node_modules", "react-dom", "package.json");
const require = createRequire(existsSync(hermesDesktop) ? hermesDesktop : localPkg);
const { createRoot } = require("react-dom/client");

// ── jsdom global environment ────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><head></head><body><div id='pane'></div><div id='page'></div></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
if (globalThis.navigator) {
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
} else {
  globalThis.navigator = dom.window.navigator;
}
globalThis.CustomEvent = dom.window.CustomEvent;
dom.window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.ResizeObserver = dom.window.ResizeObserver;
// The pane's WS dials the deployed monitor; a never-opening socket stands in.
class FakeWebSocket {
  constructor() {
    this.readyState = 0;
    FakeWebSocket.instances.push(this);
  }
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}
FakeWebSocket.instances = [];
globalThis.WebSocket = FakeWebSocket;
dom.window.WebSocket = FakeWebSocket;

// Deterministic upstream: the pane's REST calls (namespace list + the
// per-namespace job summaries that back the namespace tree) hit a stub so no
// test run touches the deployed monitor.
const NS_FIXTURES = [
  { id: "fenrir-agents", label: "Fenrir Ledger Agents" },
  { id: "say-so-agents", label: "SaySo Agents" },
  { id: "mytruthfinder-agents", label: "MyTruthFinder Agents" },
  { id: "shanaghy-com-agents", label: "Shanaghy.com Agents" },
  { id: "re-goatmower-agents", label: "Re-Goatmower Agents" },
  // summary fetch fails for this world → the dimmed-seat "summary unavailable" state
  { id: "broken-vista-agents", label: "Broken Vista Agents" },
];
// REST fixtures mirror the REAL endpoint payload: raw K8s AgentJobs
// ({ name, status, startTime, completionTime, labels, annotations }) — NOT
// the wire Jobs the WS feed pushes. The "unknown step ?" / broken-stream bug
// shipped precisely because an earlier fixture was wire-shaped while prod
// returns AgentJobs; this is the regression lock for the client-side
// mapping in src/ui/lib/restJobs.ts (labels → sessionId, session-id pattern
// → issue/step/agent, annotations → titles, "active" → "pending").
const agentJob = (name, status, annotations = {}) => ({
  name,
  namespace: "fenrir-agents",
  status,
  startTime: null,
  completionTime: null,
  labels: { "fenrir.dev/session-id": name.replace(/^agent-/, "") },
  annotations,
});
const JOBS_BY_NS = {
  "fenrir-agents": [
    agentJob("agent-issue-1200-step1-firemandecko-1a2b3c4d", "running", {
      "fenrir/pr-title": "wire the namespace drilldown tree",
    }),
    agentJob("agent-issue-1201-step2-loki-2b3c4d5e", "running"),
    agentJob("agent-issue-1202-step1-luna-3c4d5e6f", "active"),
    agentJob("agent-issue-1203-step1-heimdall-4d5e6f7a", "failed"),
    ...Array.from({ length: 8 }, (_, i) =>
      agentJob(`agent-issue-${1204 + i}-step1-freya-${(5 + i).toString(16).repeat(8)}`, "succeeded"),
    ),
  ],
  "say-so-agents": Array.from({ length: 8 }, (_, i) =>
    agentJob(`agent-issue-${2010 + i}-step1-freya-${(10 + i).toString(16).repeat(8)}`, "succeeded"),
  ),
  "mytruthfinder-agents": [agentJob("agent-issue-3300-step1-luna-0f1e2d3c", "running")],
  "shanaghy-com-agents": [],
  "re-goatmower-agents": [
    agentJob("agent-issue-4400-step1-firemandecko-5e6f7a8b", "failed"),
    agentJob("agent-issue-4401-step1-loki-6f7a8b9c", "succeeded"),
  ],
};
function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
globalThis.fetch = async (input, init) => {
  const url = String(input);
  // Ragnarök cancel (DELETE /api/jobs/:sessionId) — namespace-agnostic REST path
  if (init?.method === "DELETE" && url.includes("/api/jobs/")) {
    return jsonResponse({ ok: true });
  }
  if (url.includes("/api/namespaces")) return jsonResponse({ namespaces: NS_FIXTURES });
  const m = url.match(/\/api\/jobs\?namespace=([^&]+)/);
  if (m) {
    const ns = decodeURIComponent(m[1]);
    if (ns === "broken-vista-agents") return jsonResponse({ error: "upstream gone" }, 503);
    const jobs = JOBS_BY_NS[ns] ?? [];
    return jsonResponse({ jobs, count: jobs.length });
  }
  return jsonResponse({ error: `no stub for ${url}` }, 404);
};
dom.window.fetch = globalThis.fetch;

// The SDK stub owns the workspace-tab records (initialized when the plugin
// bundle imports it below): __stubWorkspaceOpens (newly stacked tabs),
// __stubWorkspaceFocuses (fronted already-open tabs), __stubWorkspaceTabs
// (open tabs by id — the disposer is under .close).

// ── load the built plugin through the loader (stub SDK + real React) ───────
const plugin = (await import("../desktop/plugin.js")).default;

assert.equal(plugin.id, "odins-throne-hermes", "plugin id");

const contributions = [];
const disposers = [];
const ctx = {
  register(c) {
    contributions.push(c);
  },
  onDispose(fn) {
    disposers.push(fn);
  },
  storage: {
    get: () => null,
    set: () => {},
    remove: () => {},
  },
  runAction: async () => ({ ok: false, reason: "unknown" }),
};
plugin.register(ctx);

const byId = Object.fromEntries(contributions.map((c) => [c.id, c]));

// ── contribution contract ──────────────────────────────────────────────────
assert.ok(byId.jobs, "pane contribution registered");
assert.equal(byId.jobs.area, "panes");
assert.equal(byId.jobs.data.dock.pane, "workspace", "pane docks beside the conversation");
assert.equal(byId.jobs.data.dock.pos, "right", "pane claims the right edge");
assert.equal(byId.jobs.title, "Odin's Throne");
assert.ok(byId.page, "route page contribution registered");
assert.equal(byId.page.data.path, "/odins-throne");
assert.ok(byId.nav, "sidebar nav registered");
assert.ok(byId.open && byId.configure, "palette commands registered");

// ── injected chrome: scoped style + Google fonts ───────────────────────────
assert.ok(document.getElementById("odins-throne-hermes-style"), "style tag injected");
const css = document.getElementById("odins-throne-hermes-style").textContent;
assert.ok(css.includes(".odins-throne-root .sidebar"), "CSS selectors scoped to the plugin root");
assert.ok(css.includes('.odins-throne-root[data-theme="light"]'), "light theme scoped to the plugin root");
assert.ok(!/^\[data-theme/.test(css), "no unscoped [data-theme] leakage");
assert.ok(document.getElementById("odins-throne-hermes-fonts"), "fonts link injected");

// ── render both surfaces ────────────────────────────────────────────────────
const flush = () => new Promise((r) => setTimeout(r, 60));

const paneRoot = createRoot(document.getElementById("pane"));
paneRoot.render(byId.jobs.render());
await flush();
await flush();
// The API namespace list resolves asynchronously (vendored list → API list),
// and each API-added world's summary is one fetch hop behind that — give the
// chain an extra cycle before asserting the lantern scene.
await flush();
await flush();

const paneHtml = document.getElementById("pane").innerHTML;
assert.ok(paneHtml.includes("odins-throne-root"), "pane root mounted");
assert.ok(paneHtml.includes("throne-connect-card"), "first-run connect card shown (no session yet)");
assert.ok(paneHtml.includes("Sign in with Google"), "Google OAuth is the primary auth affordance");
assert.ok(document.querySelector(".sidebar"), "Hlidskjalf sidebar mounted");
assert.ok(paneHtml.includes("Hlidskjalf"), "brand title rendered");
assert.ok(document.querySelector(".brand-wss-badge"), "WSS status badge rendered");
assert.ok(!document.querySelector(".card-list"), "old flat job list removed — jobs live in the tree");
assert.ok(!paneHtml.includes("No agent jobs found"), "old empty-list state gone with the flat list");
assert.ok(document.querySelector(".quote"), "Odin quote rendered");
assert.ok(document.querySelector('[aria-label="Agent sessions"]'), "namespace selector present");
// Vendored fallback must mirror the monitor's full allowlist (fenrir-ledger
// #2369 + #2373: mytruthfinder, shanaghy.com, re-goatmower seated too).
for (const ns of [
  "fenrir-agents",
  "say-so-agents",
  "mytruthfinder-agents",
  "shanaghy-com-agents",
  "re-goatmower-agents",
]) {
  assert.ok(paneHtml.includes(ns), `namespace option present: ${ns}`);
}

// ── namespace lantern tree (issues #4 + #11) ────────────────────────────────
// Each namespace is a LANTERN (role=treeitem) seated on the painted backdrop
// at its runtime-assigned seat; the world list is read live from the API.
// Strict accordion: one world's branch is open at a time (the active world
// starts pre-drilled). Hover labels carry name + full summary line; task
// pips beneath each lantern carry the count; icons are remote <img src> markup (jsdom never
// fetches — no real network in this test).
assert.ok(document.querySelector('.ns-tree[aria-label="Namespace tree"]'), "namespace tree mounted");
assert.ok(!paneHtml.includes("All namespaces"), "no wrapper root — namespaces are the top-level roots");
assert.equal(document.querySelectorAll(".ns-tree__item[data-namespace]").length, 6, "all six API namespaces are top-level root nodes");
assert.ok(document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]'), "fenrir-agents root node present");

// ── tree scene assets (issues #10, #11, #69) ────────────────────────────────
// v3.9: the painting ships as a real <img class="ns-tree__backdrop"> INSIDE
// the scrolling canvas (inlined JPEG src) so the painting, stones, vine and
// cards all scroll together. Each namespace lantern is seated on the
// painting (painting-% seat from src/ui/lib/treeSeats.ts — verbatim from the
// prototype's SEAT_POOL mapping; the unmeasured jsdom scene passes painting
// % straight through to scene %).
const backdropImg = document.querySelector(".ns-tree__backdrop");
assert.ok(backdropImg, "the painted scene mounts as a real <img> backdrop (v3.9)");
assert.ok(
  (backdropImg.getAttribute("src") ?? "").startsWith("data:image/jpeg;base64,"),
  "the painted backdrop (inlined JPEG) is the <img> src, not a CSS custom property",
);
assert.ok(document.querySelector(".ns-tree__scene"), "the painted scene mounts as the tree's stage");
const fenrirRoot = document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]');
// fenrir-agents is curated onto SEAT_POOL[9] = {40,37} (v3.9.2 bright-spot re-map).
assert.equal(fenrirRoot.getAttribute("data-seat-x"), "40", "fenrir lantern seat x matches the prototype mapping (SEAT_POOL[9])");
assert.equal(fenrirRoot.getAttribute("data-seat-y"), "37", "fenrir lantern seat y matches the prototype mapping (SEAT_POOL[9])");
assert.equal(fenrirRoot.getAttribute("data-seat-dir"), "1", "fenrir vine hangs rightward (dir 1)");
assert.equal(fenrirRoot.style.left, "40%", "fenrir lantern is pinned to its seat coordinate");
assert.equal(fenrirRoot.style.top, "37%", "fenrir lantern is pinned to its seat coordinate");
const saysoRoot = document.querySelector('.ns-tree__item[data-namespace="say-so-agents"]');
// say-so-agents is curated onto SEAT_POOL[6] = {11,50} (v3.9.2).
assert.equal(saysoRoot.getAttribute("data-seat-x"), "11", "say-so lantern seat x matches the prototype mapping (SEAT_POOL[6])");
assert.equal(saysoRoot.getAttribute("data-seat-y"), "50", "say-so lantern seat y matches the prototype mapping (SEAT_POOL[6])");
for (const item of document.querySelectorAll(".ns-tree__item[data-namespace]")) {
  const x = Number(item.getAttribute("data-seat-x"));
  const y = Number(item.getAttribute("data-seat-y"));
  const dir = item.getAttribute("data-seat-dir");
  assert.ok(x > 0 && x <= 100, `namespace ${item.dataset.namespace} has an in-scene seat x (got ${x})`);
  assert.ok(y > 0 && y <= 100, `namespace ${item.dataset.namespace} has an in-scene seat y (got ${y})`);
  assert.ok(dir === "1" || dir === "-1", `namespace ${item.dataset.namespace} has a valid hang dir`);
  assert.ok(item.querySelector(".ns-tree__lantern"), `namespace ${item.dataset.namespace} has a lantern button`);
  // no stats berries — the task count reads as the pip row (issue #39)
  assert.equal(item.querySelector(".ns-tree__fruit, .ns-tree__berry"), null, `namespace ${item.dataset.namespace} carries no berry overlay`);
}
// Issue #54: open world has NO counts row or pip strip (icons live at vine anchors).
assert.equal(fenrirRoot.querySelector(".ns-tree__tasks"), null, "open world has no old-style pip grid (issue #54)");
assert.equal(fenrirRoot.querySelector(".piprow"), null, "open world has no pip strip — icons live at vine anchors");
assert.equal(fenrirRoot.querySelector(".ns-tree__counts"), null, "open world has no counts row — it is expanded");

// Anchor icons: one per job on the vine canvas, seated at each card's anchor point.
const fenrirAnchors = document.querySelectorAll('.ns-tree__canvas .anchor-ic');
assert.equal(fenrirAnchors.length, 12, "one anchor icon per job on the open vine (12 for fenrir)");
for (const anc of fenrirAnchors) {
  assert.equal(anc.getAttribute("aria-hidden"), "true", "anchor icon is aria-hidden (card carries the status)");
  const icon = anc.querySelector(".ns-tree__icon");
  assert.ok(icon, "anchor icon seats a task icon");
  assert.ok(
    (icon.getAttribute("src") ?? "").startsWith("https://www.shanaghy.com/assets/icons/"),
    `anchor icon is a shanaghy.com status sigil: ${icon.getAttribute("src")}`,
  );
}

// Task pips (issues #39, #54): COLLAPSED worlds carry a single-row pip strip
// (flex-nowrap, left-anchored at the lantern's left edge), capped at 8 + "+N".
const saysoPips = saysoRoot.querySelector(".piprow");
assert.ok(saysoPips, "collapsed say-so world carries a single-row pip strip");
assert.equal(saysoPips.getAttribute("aria-hidden"), "true", "pip strip is decorative — the lantern label carries the counts");
assert.equal(saysoPips.getAttribute("data-count"), "8", "say-so's pip strip stands for its 8 tasks");
assert.equal(saysoPips.querySelectorAll(".pip-slot").length, 8, "say-so's 8 tasks show exactly 8 pip slots (at the cap, no chip)");
assert.equal(saysoPips.querySelector(".piprow__more"), null, "no overflow chip at or under the cap");
for (const slot of saysoPips.querySelectorAll(".pip-slot")) {
  const icon = slot.querySelector(".ns-tree__icon--pip");
  assert.ok(icon, "each pip-slot seats a pip-sized task icon");
  assert.ok(
    (icon.getAttribute("src") ?? "").startsWith("https://www.shanaghy.com/assets/icons/"),
    `pip icon is a shanaghy.com status sigil: ${icon.getAttribute("src")}`,
  );
}
const goatPips = document.querySelector('.ns-tree__item[data-namespace="re-goatmower-agents"] .piprow');
assert.ok(goatPips, "re-goatmower world carries a pip strip");
assert.equal(goatPips.querySelectorAll(".pip-slot").length, 2, "re-goatmower's 2 tasks show 2 pip slots");
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="shanaghy-com-agents"] .piprow'),
  null,
  "an empty world shows no pip strip",
);

// Status-counts row: collapsed worlds carry orbs beneath their lantern.
const saysoCountsRow = saysoRoot.querySelector(".ns-tree__counts");
assert.ok(saysoCountsRow, "collapsed say-so world carries a status-counts row");
assert.equal(saysoCountsRow.getAttribute("aria-hidden"), "true", "counts row is aria-hidden");
assert.ok(saysoCountsRow.querySelectorAll(".ns-tree__counts__orb").length >= 1, "counts row has orbs");
const goatCountsRow = document.querySelector('.ns-tree__item[data-namespace="re-goatmower-agents"] .ns-tree__counts');
assert.ok(goatCountsRow, "re-goatmower world carries a counts row");
assert.ok(fenrirRoot.querySelector(".ns-tree__lantern--failed"), "fenrir lantern tints ember (a failed job in the world)");
assert.ok(saysoRoot.querySelector(".ns-tree__lantern--ok"), "say-so lantern tints moss (all-clear world)");

// Hover labels reveal world name + full summary line (garden .g-label pattern).
const fenrirGlabel = fenrirRoot.querySelector(".ns-tree__glabel");
assert.ok(fenrirGlabel, "each lantern carries a hover label");
assert.ok(fenrirGlabel.textContent.includes("Fenrir Ledger Agents"), "hover label names the world");
assert.ok(
  paneHtml.includes("12 tasks · 2 running · 1 pending · 1 failed · 8 succeeded"),
  "fenrir-agents keeps its full summary line with status counts",
);
assert.ok(
  paneHtml.includes("8 tasks · 8 succeeded"),
  "say-so-agents shows its summary line",
);
assert.ok(paneHtml.includes("0 tasks"), "empty namespace shows a zero-task summary");

// Summary-unavailable world: dimmed seat + "summary unavailable" line.
const brokenRoot = document.querySelector('.ns-tree__item[data-namespace="broken-vista-agents"]');
assert.ok(brokenRoot, "broken-vista-agents root node present");
assert.ok(brokenRoot.querySelector(".ns-tree__lantern--dim"), "unavailable summary dims the seat");
assert.ok(paneHtml.includes("summary unavailable"), "unavailable summary states so in the label");
assert.equal(brokenRoot.querySelector(".piprow"), null, "an unavailable summary shows no pip strip");
assert.equal(brokenRoot.querySelector(".ns-tree__counts"), null, "an unavailable summary shows no counts row");

// Tree semantics: role=tree on the root, treeitem + aria-expanded/selected on
// the lanterns (the active world starts pre-drilled).
assert.equal(
  fenrirRoot.querySelector(".ns-tree__lantern").getAttribute("role"),
  "treeitem",
  "lantern is a treeitem",
);
assert.equal(
  fenrirRoot.querySelector(".ns-tree__lantern").getAttribute("aria-selected"),
  "true",
  "active namespace lantern is marked selected",
);
assert.equal(
  fenrirRoot.querySelector(".ns-tree__lantern").getAttribute("aria-expanded"),
  "true",
  "active world starts pre-drilled (branch open)",
);

// Vine-strand CSS (issue #12): the open world's work hangs as full cards
// along a curved SVG strand; the scroller/canvas structure keeps the
// painting + lanterns rooted while only the vine scrolls beneath.
assert.ok(
  css.includes(".ns-tree__scroller") && css.includes(".ns-tree__canvas"),
  "scroller + canvas structure present in the CSS",
);
assert.ok(
  css.includes(".ns-tree__vine") && css.includes("stroke-dasharray: 2 5"),
  "the vine strand + bare (empty world) strand styles present",
);
assert.ok(css.includes(".jcard") && css.includes(".jact"), "vine job cards + on-card actions present in the CSS");
assert.ok(
  css.includes("@keyframes vine-sprout") &&
    css.includes("@keyframes vine-cardfall") &&
    css.includes("@keyframes vine-tremble"),
  "sprout / fall / tremble keyframes present in the CSS",
);
assert.ok(css.includes(".jcard.pop-in"), "cards sprout in on mount (never replayed on re-render)");
assert.ok(css.includes(".jcard--terminating"), "terminating cards tremble (cancel choreography)");

// The open world's vine: the active namespace starts pre-drilled — its 12
// tasks (purged excluded; none in the fixture) hang as full cards along the
// strand in the strict-accordion drill (exactly one open world).
assert.ok(document.querySelector(".ns-tree__scroller"), "the vine's scroller mounts inside the painted scene");
const vinePath = document.querySelector(".ns-tree__canvas .ns-tree__vine");
assert.ok(vinePath, "the vine strand renders as an SVG path on the canvas");
assert.ok((vinePath.getAttribute("d") ?? "").startsWith("M"), "the strand path carries bezier geometry from the lantern's seat");
assert.ok(vinePath.closest(".ns-tree__scroller"), "the strand lives in the scrolling layer, beneath the rooted lanterns");
const fenrirCards = document.querySelectorAll('.ns-tree__canvas .jcard[data-session]');
assert.equal(fenrirCards.length, 12, "the pre-drilled world hangs its 12 tasks on the vine");
assert.ok(document.querySelector('.jcard[data-session="issue-1200-step1-firemandecko-1a2b3c4d"]'), "task card present on the open strand (sessionId derived from labels)");
assert.ok(paneHtml.includes("issue-1203-step1-heimdall-4d5e6f7a"), "failed task hung on the strand");

// Hang order (issue #12): running → failed → pending → succeeded, stable
// within each status.
const STATUS_RANK = { running: 0, failed: 1, pending: 2, succeeded: 3, cached: 4, purged: 5 };
const hangStatuses = [...fenrirCards].map((c) => c.getAttribute("data-status"));
for (let i = 1; i < hangStatuses.length; i++) {
  const a = STATUS_RANK[hangStatuses[i - 1]] ?? 9;
  const b = STATUS_RANK[hangStatuses[i]] ?? 9;
  assert.ok(b >= a, `vine hang order never regresses at card ${i} (${hangStatuses[i - 1]} → ${hangStatuses[i]})`);
}
assert.equal(hangStatuses[0], "running", "live work hangs first on the strand");
assert.equal(hangStatuses[2], "failed", "embers hang next");
assert.equal(hangStatuses[3], "pending", "the unhatched after");
assert.equal(hangStatuses[hangStatuses.length - 1], "succeeded", "the quiet green last");

// REST AgentJob → wire Job mapping (lib/restJobs.ts) must fully resolve job
// metadata — the exact fields that used to render "Issue #? · unknown · Step ?".
assert.ok(paneHtml.includes("Issue #1200"), "issue number parsed from the session-id pattern");
assert.ok(paneHtml.includes("FiremanDecko"), "agent name resolved from the session-id pattern");
assert.ok(paneHtml.includes("Step 1"), "step number parsed from the session-id pattern");
assert.ok(paneHtml.includes("wire the namespace drilldown tree"), "fenrir/pr-title annotation surfaces as the card title");
assert.ok(!paneHtml.includes("Issue #?"), "no unresolved issue fallbacks");
assert.ok(!paneHtml.includes("Step ?"), "no unresolved step fallbacks");

// Vine cards show everything ON the card (issue #12 — no popups anywhere):
// status sigil (taskIcon contract), title, session · issue # · agent, and
// open/focus · pin · cancel actions.
const firstCard = document.querySelector('.jcard[data-session="issue-1200-step1-firemandecko-1a2b3c4d"]');
assert.ok(firstCard, "the vine's first card mounts");
assert.ok(firstCard.querySelector(".jcard__title"), "card carries its title");
assert.ok(firstCard.querySelector(".jcard__dot"), "card carries its status dot");
const firstMeta = firstCard.querySelector(".jcard__meta").textContent;
assert.ok(
  firstMeta.includes("issue-1200-step1-firemandecko-1a2b3c4d") &&
    firstMeta.includes("Issue #1200") &&
    firstMeta.includes("FiremanDecko"),
  "meta line carries session · issue # · agent",
);
assert.equal(
  firstCard.querySelectorAll(".jact").length,
  2,
  "pin · cancel sit on the card (open is the panel body click — no button duplicate)",
);
assert.ok(!firstCard.querySelector(".jact--open"), "no open/focus text button — panel body click is the open affordance");
assert.ok(firstCard.querySelector(".jact--pin"), "pin action on the card");
assert.equal(
  firstCard.querySelector(".jact--cancel").getAttribute("title"),
  "cancel job",
  "a running (cancellable) card shows its cancel action",
);
// Icon-only buttons carry tooltips and aria-labels; no visible text labels
assert.ok(firstCard.querySelector(".jact--pin").getAttribute("title"), "pin button has a tooltip (title attribute)");
assert.ok(firstCard.querySelector(".jact--pin").getAttribute("aria-label"), "pin button has aria-label");
assert.ok(firstCard.querySelector(".jact--cancel").getAttribute("aria-label"), "cancel button has aria-label");
const pinText = firstCard.querySelector(".jact--pin").textContent.trim();
assert.ok(pinText !== "pin" && pinText !== "unpin", "pin button is icon-only — no text label");
const cancelText = firstCard.querySelector(".jact--cancel").textContent.trim();
assert.ok(cancelText !== "cancel", "cancel button is icon-only — no text label");

// Status sigils follow the taskIcon contract (issue #54): sigils are on the
// ANCHOR ICONS on the vine canvas, NOT inside the card's title box.
const anchorByStatus = (status) =>
  [...document.querySelectorAll(`.ns-tree__canvas .anchor-ic--${status}`)][0];
assert.equal(
  anchorByStatus("running")?.querySelector(".ns-tree__icon")?.getAttribute("src"),
  "https://www.shanaghy.com/assets/icons/hammer.png",
  "running jobs: anchor icon has the hammer sigil",
);
assert.equal(
  anchorByStatus("failed")?.querySelector(".ns-tree__icon")?.getAttribute("src"),
  "https://www.shanaghy.com/assets/icons/raven.png",
  "failed jobs: anchor icon has the raven sigil",
);
assert.equal(
  anchorByStatus("pending")?.querySelector(".ns-tree__icon")?.getAttribute("src"),
  "https://www.shanaghy.com/assets/icons/dice.png",
  "pending jobs: anchor icon has the dice sigil",
);
assert.equal(
  anchorByStatus("succeeded")?.querySelector(".ns-tree__icon")?.getAttribute("src"),
  "https://www.shanaghy.com/assets/icons/ring.png",
  "succeeded jobs: anchor icon has the ring sigil",
);
// Cards carry NO sigil in the title box — text only (issue #54)
const cardByStatus = (status) => [...fenrirCards].find((c) => c.getAttribute("data-status") === status);
assert.equal(cardByStatus("running").querySelector(".jcard__sigil"), null, "no sigil inside running card (icon is at the anchor)");
assert.ok(
  !cardByStatus("succeeded").querySelector(".jact--cancel"),
  "a succeeded (non-cancellable) card hides its cancel action",
);

// ── keyboard operability + screen-reader semantics (issue #9) ───────────────
// Lanterns are native <button type="button"> — Enter/Space toggle them by
// default; the tree root + treeitems carry the ARIA tree semantics; card
// bodies are keyboard-operable (tabIndex 0 + Enter/Space open, same path a
// click takes); every on-card action is a labelled button; focus rings sit
// on :focus-visible for lanterns, cards and actions against the painting.
for (const item of document.querySelectorAll(".ns-tree__item[data-namespace]")) {
  const lantern = item.querySelector(".ns-tree__lantern");
  assert.equal(lantern.tagName, "BUTTON", "lantern is a native button — Enter/Space toggle it");
  assert.equal(lantern.getAttribute("type"), "button", "lantern button never submits a form");
  assert.equal(lantern.getAttribute("role"), "treeitem", "lantern carries role=treeitem");
  const fixture = NS_FIXTURES.find((n) => n.id === item.dataset.namespace);
  assert.ok(
    fixture && (lantern.getAttribute("aria-label") ?? "").includes(fixture.label),
    `lantern aria-label names the world: ${lantern.getAttribute("aria-label")}`,
  );
  assert.ok(
    lantern.getAttribute("aria-expanded") === "true" || lantern.getAttribute("aria-expanded") === "false",
    "lantern exposes its expand/collapse state",
  );
  assert.ok(
    lantern.getAttribute("aria-selected") === "true" || lantern.getAttribute("aria-selected") === "false",
    "lantern exposes its selected state",
  );
}
assert.equal(
  document.querySelector(".ns-tree__lanterns, .ns-tree").getAttribute("role"),
  "tree",
  "the lantern scene roots a role=tree",
);
for (const card of document.querySelectorAll(".ns-tree__canvas .jcard[data-session]")) {
  assert.equal(card.getAttribute("role"), "treeitem", "card body carries role=treeitem");
  assert.equal(card.getAttribute("tabIndex"), "0", "card body is Tab-reachable (keyboard operable)");
  assert.ok(card.getAttribute("aria-label"), "card body carries an aria-label");
  for (const act of card.querySelectorAll(".jact")) {
    assert.equal(act.tagName, "BUTTON", "on-card action is a native button");
    assert.ok(act.getAttribute("aria-label"), "on-card action carries an aria-label");
  }
}
for (const sel of [".jcard:focus-visible", ".ns-tree__lantern:focus-visible", ".jact:focus-visible"]) {
  assert.ok(css.includes(sel), `keyboard focus ring present in the CSS: ${sel}`);
}

// Spirit-holder model (issue #90 v3.9.3): the painted lantern holds the namespace's spirit.
// The button is fully transparent — no disc, no border, no border-radius, no gradient.
// Active: screen-blend ::before glow at opacity 1. Inactive: ::after multiply-blend mask dims the painting.
const lanternRule = css.match(/\.ns-tree__lantern\s*\{([^}]*)\}/)?.[1] ?? "";
assert.ok(lanternRule, "the lantern rule ships in the CSS");
assert.match(lanternRule, /background:\s*transparent/, "lantern button is transparent — no disc");
assert.doesNotMatch(lanternRule, /border-radius:\s*50%/, "lantern button has no disc shape (no border-radius 50%)");
assert.doesNotMatch(lanternRule, /radial-gradient/, "lantern button base has no stone gradient");
const activeLanternRule = css.match(/\.ns-tree__lantern--active\s*\{([^}]*)\}/)?.[1] ?? "";
assert.ok(activeLanternRule, "active lantern rule ships in the CSS");
assert.match(activeLanternRule, /z-index:\s*7/, "active lantern floats above (z-index 7)");
const inactiveLanternRule = css.match(/\.ns-tree__lantern--inactive\s*\{([^}]*)\}/)?.[1] ?? "";
assert.ok(inactiveLanternRule, "inactive lantern rule ships in the CSS");
assert.doesNotMatch(inactiveLanternRule, /opacity:\s*0\.5/, "inactive lantern has no opacity fade (uses mask instead)");
assert.match(inactiveLanternRule, /z-index:\s*4/, "inactive lantern recedes to z-index 4");
// The inactive mask: ::after multiply-blend radial darkens the painted lantern
const inactiveMaskRule = css.match(/\.ns-tree__lantern--inactive::after\s*\{([^}]*)\}/)?.[1] ?? "";
assert.ok(inactiveMaskRule, "inactive lantern mask (::after) rule ships in the CSS");
assert.match(inactiveMaskRule, /mix-blend-mode:\s*multiply/, "inactive mask uses multiply blend to dim the painting");
assert.match(inactiveMaskRule, /radial-gradient/, "inactive mask uses a radial gradient");
const lightRule = css.match(/\.ns-tree__lantern::before\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(lightRule, /mix-blend-mode:\s*screen/, "the lantern light brightens the painting (screen blend), never covers it");
assert.match(lightRule, /opacity:\s*0/, "the lantern light is off until hovered/selected");

// Enter on the card body opens the session's tab — the keyboard path through
// the tree (a Space keypress does the same). No click involved.
const SID_1202 = "issue-1202-step1-luna-3c4d5e6f";
const opensBeforeKeys = globalThis.__stubWorkspaceOpens.length;
const card1202 = document.querySelector(`.jcard[data-session="${SID_1202}"]`);
card1202.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await flush();
await flush();
assert.equal(
  globalThis.__stubWorkspaceOpens[globalThis.__stubWorkspaceOpens.length - 1],
  `odins-throne-session-${SID_1202}`,
  "Enter on the card body opens the session's tab (keyboard operable)",
);
assert.equal(
  globalThis.__stubWorkspaceOpens.length,
  opensBeforeKeys + 1,
  "Enter keypress stacks exactly one tab",
);
card1202.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
await flush();
await flush();
assert.equal(
  globalThis.__stubWorkspaceOpens.length,
  opensBeforeKeys + 1,
  "Space on an already-open session focuses its tab — never a duplicate stack",
);
assert.ok(
  globalThis.__stubWorkspaceFocuses.includes(`odins-throne-session-${SID_1202}`),
  "Space keypress follows the same open path (focus dedupe applies)",
);

// ── per-session workspace tabs (issue:6) ────────────────────────────────────
// A session click must stack a DEDICATED workspace tab (host.openWorkspace —
// the session-tile door), never navigate the current tab away; a second click
// on the same session focuses the existing tab; a different session stacks
// another tab alongside.
const SID_1200 = "issue-1200-step1-firemandecko-1a2b3c4d";
const SID_1201 = "issue-1201-step2-loki-2b3c4d5e";
const TAB_1200 = `odins-throne-session-${SID_1200}`;
const TAB_1201 = `odins-throne-session-${SID_1201}`;

const navsBeforeClicks = [...(globalThis.__stubNavigations ?? [])];
document.querySelector(`.jcard[data-session="${SID_1200}"]`).click();
await flush();
await flush();
assert.equal(
  document.querySelector(`.jcard[data-session="${SID_1200}"]`).getAttribute("aria-selected"),
  "true",
  "clicked task node is marked selected",
);
// Panel body IS the open affordance — no text button duplicate for open/focus
assert.ok(
  !document.querySelector(`.jcard[data-session="${SID_1200}"] .jact--open`),
  "no open/focus button on the card — panel click is the open affordance",
);
assert.equal(
  globalThis.__stubWorkspaceOpens[globalThis.__stubWorkspaceOpens.length - 1],
  TAB_1200,
  "session click stacks a dedicated per-session workspace tab",
);
assert.equal(
  globalThis.__stubWorkspaceTabs.get(TAB_1200)?.title,
  "#1200 – wire the namespace drilldown tree",
  "session tab carries the job title",
);
assert.equal(
  globalThis.__stubNavigations.length,
  navsBeforeClicks.length,
  "session click does not navigate the current tab away",
);

// Clicking the same session again focuses the existing tab — no duplicate.
document.querySelector(`.jcard[data-session="${SID_1200}"]`).click();
await flush();
await flush();
assert.ok(
  globalThis.__stubWorkspaceFocuses.includes(TAB_1200),
  "second click on the same session focuses its existing tab",
);
assert.equal(
  globalThis.__stubWorkspaceOpens.filter((id) => id === TAB_1200).length,
  1,
  "focusing an open session never stacks a duplicate tab",
);

// A second, DIFFERENT session stacks another tab — several log terminals at
// once, one per session.
document.querySelector(`.jcard[data-session="${SID_1201}"]`).click();
await flush();
await flush();
assert.ok(
  globalThis.__stubWorkspaceTabs.has(TAB_1200) && globalThis.__stubWorkspaceTabs.has(TAB_1201),
  "two different sessions hold two tabs open at once",
);

// Ragnarök closes the session's tab with the pod (reference design: "cancel
// closes its tab"). The cancel action sits ON the vine card (no popups for
// the job display — the confirm dialog is the destructive-action guard);
// confirm issues DELETE /api/jobs/:sessionId, the card trembles
// (terminating), then the tab must be gone.
document
  .querySelector(`.jcard[data-session="${SID_1201}"] .jact--cancel`)
  .click();
await flush();
assert.ok(document.querySelector(".rdk-backdrop"), "Ragnarök dialog opens from the pane");
document.querySelector(".rdk-btn--confirm").click();
await flush();
await flush();
assert.ok(
  !globalThis.__stubWorkspaceTabs.has(TAB_1201),
  "confirmed Ragnarök closes the session's workspace tab",
);
assert.ok(
  document.querySelector(`.jcard[data-session="${SID_1201}"]`)?.classList.contains("jcard--terminating"),
  "the cancelled card trembles on the strand (terminating state)",
);
assert.ok(
  document.getElementById("pane").innerHTML.includes("Ragnarok unleashed"),
  "Ragnarök toast confirms the termination",
);

// Closing a tab via its strip ✕ (the openWorkspace disposer) cleans up; a
// re-click on that session stacks a fresh tab again.
globalThis.__stubWorkspaceTabs.get(TAB_1200)?.close();
await flush();
assert.ok(!globalThis.__stubWorkspaceTabs.has(TAB_1200), "tab disposer closes the tab");
document.querySelector(`.jcard[data-session="${SID_1200}"]`).click();
await flush();
await flush();
assert.ok(
  globalThis.__stubWorkspaceTabs.has(TAB_1200),
  "re-clicking a closed session's card re-opens its tab",
);
assert.equal(
  globalThis.__stubWorkspaceOpens.filter((id) => id === TAB_1200).length,
  2,
  "re-open after close is a new tab, not a focus",
);

// Icons from shanaghy.com's icon library sit SEATED INSIDE the lanterns —
// the vine cards' status sigils are the taskIcon set (assert src attributes
// only; jsdom never fetches — no real network in this test).
const iconImgs = Array.from(document.querySelectorAll(".ns-tree__icon--lantern"));
assert.equal(iconImgs.length, 6, "each of the six lanterns seats one icon");
for (const img of iconImgs) {
  assert.ok(
    img.classList.contains("ns-tree__icon--lantern"),
    "seated icons use the lantern size (seated in the painted lantern)",
  );
  assert.ok(
    (img.getAttribute("src") ?? "").startsWith("https://www.shanaghy.com/assets/icons/"),
    `icon src points at the shanaghy.com icon library: ${img.getAttribute("src")}`,
  );
}
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__select .ns-tree__icon').getAttribute("src"),
  "https://www.shanaghy.com/assets/icons/wolf-coins.png",
  "fenrir-agents gets its curated icon (wolf-coins)",
);

// Icon fallback: a failed load (error event on the <img>) must swap in the
// inline emoji glyph so the panel never shows a broken image when offline.
const fenrirIcon = document.querySelector(
  '.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__select .ns-tree__icon',
);
fenrirIcon.dispatchEvent(new dom.window.Event("error"));
await flush();
const fallbackGlyph = document.querySelector("[data-icon-fallback]");
assert.ok(fallbackGlyph, "icon onError swaps in an inline fallback glyph");
assert.equal(fallbackGlyph.textContent, "\u{1F310}", "namespace fallback is the world glyph");
assert.ok(
  !document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__select img'),
  "failed remote img is unmounted",
);
// Pip slots (collapsed worlds) share the offline fallback: a failed pip icon
// swaps in its status glyph. Use say-so-agents (collapsed, all-succeeded).
const firstPipSlotIcon = document.querySelector(
  '.ns-tree__item[data-namespace="say-so-agents"] .pip-slot--succeeded img',
);
assert.ok(firstPipSlotIcon, "say-so pip slot has an img icon");
firstPipSlotIcon.dispatchEvent(new dom.window.Event("error"));
await flush();
const pipFallback = document.querySelector(
  '.ns-tree__item[data-namespace="say-so-agents"] .pip-slot--succeeded [data-icon-fallback]',
);
assert.ok(pipFallback, "pip slot icon onError swaps in an inline fallback glyph");
// Anchor icons (open world) also share the offline fallback.
const firstAnchorIcon = document.querySelector('.ns-tree__canvas .anchor-ic img');
assert.ok(firstAnchorIcon, "anchor icon has an img element");
firstAnchorIcon.dispatchEvent(new dom.window.Event("error"));
await flush();
const anchorFallback = document.querySelector('.ns-tree__canvas .anchor-ic [data-icon-fallback]');
assert.ok(anchorFallback, "anchor icon onError swaps in an inline fallback glyph");

// ── the strict accordion (issue #11) ─────────────────────────────────────────
// Clicking a lantern SELECTS the world (persisted to the same localStorage key
// the flat dropdown used) and opens its branch, retracting the previous one.
document.querySelector('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__lantern').click();
await flush();
await flush();
assert.equal(
  localStorage.getItem("hlidskjalf:namespace"),
  "say-so-agents",
  "clicking a lantern sets the active namespace",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__lantern').getAttribute("aria-selected"),
  "true",
  "newly selected lantern is marked active",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__lantern').getAttribute("aria-expanded"),
  "true",
  "clicked lantern's branch is open",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__lantern').getAttribute("aria-expanded"),
  "false",
  "the previously open world retracted (accordion)",
);
assert.equal(
  document.querySelectorAll('.ns-tree__canvas .jcard[data-session]').length,
  8,
  "selecting a lantern drills into its tasks",
);

// Cross-world task click: a task in a non-active namespace switches the
// namespace, keeps that session selected (pending-select flow in App) AND
// opens the session's own tab — captured against the task's world, so the
// pane's later namespace moves never rewire the tab's socket. Opening the
// other world's lantern retracts say-so's branch first (strict accordion).
document.querySelector('.ns-tree__item[data-namespace="re-goatmower-agents"] .ns-tree__lantern').click();
await flush();
assert.equal(
  document.querySelectorAll('.ns-tree__canvas .jcard[data-session]').length,
  2,
  "re-goatmower's branch opens with its 2 tasks",
);
document.querySelector('.jcard[data-session="issue-4400-step1-firemandecko-5e6f7a8b"]').click();
await flush();
await flush();
assert.equal(
  localStorage.getItem("hlidskjalf:namespace"),
  "re-goatmower-agents",
  "cross-world task click switches the active namespace",
);
assert.ok(
  globalThis.__stubWorkspaceTabs.has("odins-throne-session-issue-4400-step1-firemandecko-5e6f7a8b"),
  "cross-world task click opens the session's tab in its own world",
);
assert.equal(
  document.querySelector('.jcard[data-session="issue-4400-step1-firemandecko-5e6f7a8b"]').getAttribute("aria-selected"),
  "true",
  "cross-world task click selects the session in its world",
);

// Empty namespace drills into an explicit empty state.
document.querySelector('.ns-tree__item[data-namespace="shanaghy-com-agents"] .ns-tree__lantern').click();
await flush();
assert.ok(
  document.getElementById("pane").innerHTML.includes("No tasks in this realm"),
  "empty namespace shows the no-tasks leaf",
);

// Summary-unavailable world drills into its dimmed empty state.
document.querySelector('.ns-tree__item[data-namespace="broken-vista-agents"] .ns-tree__lantern').click();
await flush();
await flush();
assert.ok(
  document.getElementById("pane").innerHTML.includes("summary unavailable"),
  "unavailable-summary world shows the summary-unavailable leaf",
);

// Clicking the OPEN lantern collapses the branch; reopening regrows it —
// no orphan states.
document.querySelector('.ns-tree__item[data-namespace="broken-vista-agents"] .ns-tree__lantern').click();
await flush();
assert.ok(
  !document.querySelector(".ns-tree__canvas .jcard") && !document.querySelector(".ns-tree__vine"),
  "clicking the open lantern retracts the vine entirely",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="broken-vista-agents"] .ns-tree__lantern').getAttribute("aria-expanded"),
  "false",
  "collapsed lantern is aria-expanded=false",
);
document.querySelector('.ns-tree__item[data-namespace="shanaghy-com-agents"] .ns-tree__lantern').click();
await flush();
assert.ok(
  document.getElementById("pane").innerHTML.includes("No tasks in this realm"),
  "reopening a world regrows its branch",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="shanaghy-com-agents"] .ns-tree__lantern').getAttribute("aria-expanded"),
  "true",
  "reopened lantern is aria-expanded=true",
);

const pageRoot = createRoot(document.getElementById("page"));
pageRoot.render(byId.page.render());
await flush();
await flush();
const pageHtml = document.getElementById("page").innerHTML;
assert.ok(pageHtml.includes("odins-throne-root"), "page root mounted");
assert.ok(!pageHtml.includes("loki-eb-"), "page did not hit the Loki error boundary");
assert.ok(pageHtml.includes('aria-label="Log viewer"'), "log terminal mounted");
assert.ok(pageHtml.includes("All Nine Worlds await"), "Norse empty state before first selection");

// ── single theme toggle in the header row (issue #47) ──────────────────────
// The two-button ☀/☽ group is gone: ONE .theme-btn flips light ↔ dark, and
// it sits in the .brand header row immediately left of the status badge,
// with the session count left of it (the old .count-row is dissolved).
const paneEl = document.getElementById("pane");
assert.equal(paneEl.querySelectorAll(".theme-btn").length, 1, "theme control is ONE toggle button");
assert.ok(!paneEl.querySelector(".theme-switcher"), "no two-button theme group remains");
assert.ok(!paneEl.querySelector(".count-row"), "the old count-row below the quote is dissolved");
assert.ok(!paneEl.querySelector(".sidebar-header .theme-btn ~ .theme-btn"), "no sibling theme button");

const brandRow = paneEl.querySelector(".sidebar-header .brand");
assert.ok(brandRow, "brand header row present");
const headerOrder = [...brandRow.children].map((el) => el.className);
const countIdx = headerOrder.indexOf("count");
const toggleIdx = headerOrder.indexOf("theme-btn");
const badgeIdx = headerOrder.indexOf("brand-wss-badge");
assert.ok(countIdx !== -1, "session count sits inside the brand header row");
assert.ok(toggleIdx !== -1, "theme toggle sits inside the brand header row");
assert.ok(badgeIdx !== -1, "status badge sits inside the brand header row");
assert.ok(
  headerOrder.indexOf("odin-avatar-btn") < countIdx && headerOrder.indexOf("") < countIdx,
  "brand (avatar + title) stays on the left",
);
assert.ok(
  countIdx < toggleIdx && toggleIdx < badgeIdx,
  "header cluster is ordered count → theme toggle → status badge",
);
assert.ok(
  /\d+ sessions?/.test(brandRow.querySelector(".count").textContent),
  "session count reads from the header row",
);
assert.equal(brandRow.querySelector(".count").getAttribute("aria-live"), "polite", "count keeps its polite live region");

// The toggle's accessible label names the theme a click will switch to.
const toggle = brandRow.querySelector(".theme-btn");
assert.equal(toggle.tagName, "BUTTON", "theme toggle is a native button");
assert.equal(toggle.getAttribute("type"), "button", "toggle never submits a form");
assert.equal(toggle.getAttribute("aria-label"), "Switch to light theme", "label names the target theme (dark is active)");
assert.equal(toggle.getAttribute("aria-pressed"), "true", "dark active reads as pressed");

// Click flips to light — plugin-scoped, the app <html> is untouched.
toggle.click();
await flush();
await flush();
assert.equal(
  document.getElementById("pane").querySelector(".odins-throne-root").getAttribute("data-theme"),
  "light",
  "light theme applied on the plugin root",
);
assert.equal(dom.window.document.documentElement.getAttribute("data-theme"), null, "app <html> untouched");
assert.equal(toggle.getAttribute("aria-label"), "Switch to dark theme", "label follows the flip");
assert.equal(toggle.getAttribute("aria-pressed"), "false", "light active reads as not pressed");

// A second click flips back to dark — a true toggle, not a one-way button.
// Dark is the plugin root's default: it renders as an ABSENT data-theme
// (pane.tsx only stamps the attribute for "light").
toggle.click();
await flush();
await flush();
assert.equal(
  document.getElementById("pane").querySelector(".odins-throne-root").getAttribute("data-theme"),
  null,
  "second click flips back to dark (the root's default — no data-theme attribute)",
);

// ── openThroneTab seam → per-session workspace tab (issue:6) ───────────────
// The entry.tsx exports openThroneTab as a test seam; calling it with a
// session id is exactly what SidebarConnected does when a job card is clicked.
// Issue:6 supersedes the single 'throne-log' tab: each session opens its OWN
// tab id, so several log terminals can be open at once.
const { openThroneTab } = await import("../desktop/plugin.js");

assert.equal(typeof openThroneTab, "function", "openThroneTab exported as test seam");

const seamTabsBefore = globalThis.__stubWorkspaceTabs.size;
openThroneTab("test-session-001");
await flush();

assert.ok(
  globalThis.__stubWorkspaceTabs.has("odins-throne-session-test-session-001"),
  "job-card click opens a DEDICATED workspace tab for the session",
);
assert.equal(
  globalThis.__stubWorkspaceTabs.size,
  seamTabsBefore + 1,
  "first session stacks exactly one new tab",
);

// A second, DIFFERENT session stacks another tab — not a re-front.
openThroneTab("test-session-002");
await flush();
assert.ok(
  globalThis.__stubWorkspaceTabs.has("odins-throne-session-test-session-002") &&
    globalThis.__stubWorkspaceTabs.has("odins-throne-session-test-session-001"),
  "second session keeps its own tab alongside the first",
);

// Re-clicking the SAME session focuses the existing tab — never a duplicate.
const opensBefore = globalThis.__stubWorkspaceOpens.length;
openThroneTab("test-session-001");
await flush();
assert.ok(
  globalThis.__stubWorkspaceFocuses.includes("odins-throne-session-test-session-001"),
  "re-clicking an open session fronts its existing tab",
);
assert.equal(
  globalThis.__stubWorkspaceOpens.length,
  opensBefore,
  "re-clicking an open session never stacks a duplicate tab",
);

// ── fallback: host.openWorkspace unavailable (older desktop builds) ────────
// On older desktop builds host.openWorkspace may be absent. The opener must
// fall back to a per-session route page + host.navigate so the user still
// reaches the session's log. We simulate this by temporarily removing the
// method from the stub.
const { host: stubHost } = await import("./sdk-stub.mjs");
const savedOpenWorkspace = stubHost.openWorkspace;
stubHost.openWorkspace = undefined; // simulate older build

const navsBefore = globalThis.__stubNavigations.length;
openThroneTab("test-session-fallback");
await flush();

assert.ok(
  globalThis.__stubNavigations.length > navsBefore,
  "fallback: host.navigate called when host.openWorkspace is unavailable",
);
assert.equal(
  globalThis.__stubNavigations[globalThis.__stubNavigations.length - 1],
  "/odins-throne/test-session-fallback",
  "fallback: navigates to the session's own route page on older desktop builds",
);
// Restore so the tab-open path is active for the remainder of the test run.
stubHost.openWorkspace = savedOpenWorkspace;

// ── multiple rapid clicks each carry their own session tab id ──────────────
openThroneTab("rapid-a");
openThroneTab("rapid-b");
openThroneTab("rapid-c");
await flush();
for (const s of ["rapid-a", "rapid-b", "rapid-c"]) {
  assert.ok(
    globalThis.__stubWorkspaceTabs.has(`odins-throne-session-${s}`),
    `rapid click on ${s} stacks its own per-session tab`,
  );
}

// ── issue #55: SPA entry cache-bust (the hall server, Hono) ─────────────────
// Odin kept seeing the removed "focus" button on popup job cards while every
// live surface audited clean — the only surviving explanation was a stale
// cached pre-#45 bundle in the webview (fenrir-ledger #2380 class). The
// server now serves the SPA entry with Cache-Control: no-store; hashed
// /assets/* stay immutable-cached. Asserted against the REAL app, imported
// straight from source (the listener only boots when run as main, so the
// import is side-effect-free), with a fixture WEB_DIST.
{
  const webDist = mkdtempSync(join(tmpdir(), "odin-spa-"));
  mkdirSync(join(webDist, "assets"), { recursive: true });
  writeFileSync(join(webDist, "index.html"), "<!doctype html><title>hall</title>");
  writeFileSync(join(webDist, "assets", "index-D4SH3D.js"), 'console.log("hashed bundle");');

  process.env.WEB_DIST = webDist;
  const { app } = await import("../server/index.ts");

  // Every path that hands a browser the entry document carries no-store —
  // a stale pre-deploy bundle can never persist after a deploy.
  for (const path of ["/", "/index.html", "/sessions/abc-1200/step1"]) {
    const res = await app.request(path);
    assert.equal(res.status, 200, `SPA entry served for ${path}`);
    assert.ok(
      (res.headers.get("content-type") ?? "").startsWith("text/html"),
      `entry content-type is html for ${path}`,
    );
    assert.equal(
      res.headers.get("cache-control"),
      "no-store",
      `issue #55: SPA entry ${path} served Cache-Control: no-store`,
    );
  }

  // Hashed asset URLs are content-addressed — they stay long-cached.
  const asset = await app.request("/assets/index-D4SH3D.js");
  assert.equal(asset.status, 200, "hashed asset served");
  assert.equal(
    asset.headers.get("cache-control"),
    "public, max-age=31536000, immutable",
    "issue #55: content-hashed /assets/* stay immutable-cached",
  );

  // The API surface is untouched by the cache policy.
  const health = await app.request("/healthz");
  assert.equal(health.status, 200, "healthz still 200");
  assert.ok((health.headers.get("content-type") ?? "").includes("json"), "healthz still JSON");

  // Bundled-artifact audit: when the real web bundle is built
  // (npm run build:web → dist-ui/), the served entry and its hashed assets
  // carry no open/focus text-button straggler — the class #45 removed.
  const realDist = join(here, "..", "dist-ui");
  if (existsSync(realDist)) {
    const built = readdirSync(realDist, { recursive: true }).filter((f) => /\.(html|js|css)$/.test(String(f)));
    assert.ok(built.length > 0, "issue #55 audit: dist-ui has artifacts to scan");
    for (const f of built) {
      const text = readFileSync(join(realDist, String(f)), "utf8");
      assert.ok(
        !text.includes("jact--open"),
        `issue #55 audit: built web artifact ${f} contains no open/focus text button`,
      );
    }
  }
}

// ── issue #59: compact view option — chip rail struck, dense lantern tree ───
// The initials-chip rail is gone; compact is the DENSER lantern tree.
// A compact-toggle button always lives in the brand cluster.
// Sabotage-check: re-introducing chip rail OR meta row in compact mode → test fails.
{
  // Chip rail is struck — the chip button must never appear anywhere
  assert.equal(document.querySelector(".ns-tree__chip"), null,
    "issue #59: initials chip rail is struck — .ns-tree__chip not in DOM");

  const compactToggle = document.querySelector(".compact-toggle-btn");
  assert.ok(compactToggle, "issue #59: compact toggle button present in brand cluster");

  // Ensure fenrir-agents vine is open so cards are present to check
  const fenrirLantern = document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__lantern');
  assert.ok(fenrirLantern, "issue #59: fenrir-agents lantern present for compact test");
  fenrirLantern.click();
  await flush();
  await flush();

  // Standard cards should be present before toggling compact
  const stdCards = document.querySelectorAll(".jcard");
  assert.ok(stdCards.length > 0, "issue #59: vine cards present in standard mode before compact toggle");
  // Standard cards have meta row
  assert.ok(stdCards[0].querySelector(".jcard__row2"),
    "issue #59: standard card has meta row before compact toggle");

  // Ensure toggle starts in standard mode (previous tests may have flipped it — reset if needed)
  if (compactToggle.getAttribute("aria-pressed") === "true") {
    compactToggle.click();
    await flush();
    await flush();
  }
  assert.equal(compactToggle.getAttribute("aria-pressed"), "false",
    "issue #59: compact toggle is in standard mode before test");

  // Enter compact mode
  compactToggle.click();
  await flush();
  await flush();

  assert.equal(compactToggle.getAttribute("aria-pressed"), "true",
    "issue #59: compact toggle enters compact mode on click");

  // The lantern tree stays in compact mode — no chip rail swap
  assert.ok(document.querySelector('.ns-tree[aria-label="Namespace tree"]'),
    "issue #59: lantern tree stays in compact mode — no chip rail swap");
  assert.equal(document.querySelector(".ns-tree__chip"), null,
    "issue #59: chip rail never appears even in compact mode");

  // Compact cards are ONE line — no meta row (.jcard__row2), no action clasps (.jcard__acts)
  const compactCards = document.querySelectorAll(".jcard--compact");
  assert.ok(compactCards.length > 0, "issue #59: compact vine cards get .jcard--compact class");
  for (const card of compactCards) {
    assert.equal(card.querySelector(".jcard__row2"), null,
      "issue #59: compact card has no meta row (ONE-line card — title + dot only)");
    assert.equal(card.querySelector(".jcard__acts"), null,
      "issue #59: compact card has no action clasps (📌 ✕ struck in compact)");
  }

  // localStorage persists the choice
  assert.equal(globalThis.localStorage.getItem("hlidskjalf:display-mode"), "compact",
    "issue #59: compact mode choice persisted to localStorage");

  // Exit compact mode — resume width-appropriate mode
  compactToggle.click();
  await flush();
  await flush();

  assert.equal(compactToggle.getAttribute("aria-pressed"), "false",
    "issue #59: compact toggle exits compact mode on second click");
  assert.equal(globalThis.localStorage.getItem("hlidskjalf:display-mode"), "auto",
    "issue #59: auto mode written to localStorage on exit");

  // Standard cards still have meta row after toggle exits compact
  const standardCards = document.querySelectorAll(".jcard:not(.jcard--compact)");
  assert.ok(standardCards.length > 0, "issue #59: standard cards render after toggle exits compact");
  assert.ok(standardCards[0].querySelector(".jcard__row2"),
    "issue #59: standard card has meta row after exiting compact");
}

console.log("SMOKE PASS — pane + page render, namespace lantern tree (lanterns seated on the painting, vine-strand job cards hung from the open lantern: running → failed → pending → succeeded order, status sigils hammer/dice/raven/ring, panel-body click opens session tab (issue:43 — no open/focus button duplicate), icon-only pin · cancel actions with tooltips, terminating tremble, scroller + canvas beneath the rooted painting, old flat list gone), CSS scoped, theme plugin-local, overlays wired, per-session workspace tabs (issue:6: open per click, focus dedupe, cancel + strip-close teardown, cross-world capture), SPA entry Cache-Control: no-store + hashed /assets immutable (issue:55 — no stale cached bundle after a deploy), compact view option (issue:59 — chip rail struck, dense lantern tree, one-line cards, localStorage persist, toggle enters/exits compact at any pane width)");
process.exit(0);
