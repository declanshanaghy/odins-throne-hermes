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
import { existsSync } from "node:fs";
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

// ── namespace drilldown tree (issue:4) ──────────────────────────────────────
// Each namespace is a TOP-LEVEL root node (no wrapper root); its tasks branch
// directly beneath it. Summary lines + status stats from issue:2 are kept.
// Connector rails + elbows are CSS-only; icons are remote <img src> markup
// (jsdom never fetches — no real network in this test).
assert.ok(document.querySelector('.ns-tree[aria-label="Namespace tree"]'), "namespace tree mounted");
assert.ok(!paneHtml.includes("All namespaces"), "no wrapper root — namespaces are the top-level roots");
assert.equal(document.querySelectorAll(".ns-tree__item[data-namespace]").length, 5, "all five namespaces are top-level root nodes");
assert.ok(document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]'), "fenrir-agents root node present");

// ── tree scene assets (issue:10) ─────────────────────────────────────────────
// The painted backdrop lands as --tree-backdrop on the tree root, and each
// namespace node carries its lantern seat (percent-of-scene, typed data from
// src/ui/lib/treeSeats.ts — matching the prototype's WORLDS mapping).
const treeRootEl = document.querySelector('.ns-tree[aria-label="Namespace tree"]');
const treeStyle = treeRootEl.getAttribute("style") ?? "";
assert.ok(treeStyle.includes("--tree-backdrop"), "tree root exposes the --tree-backdrop custom property");
assert.ok(
  treeStyle.includes("data:image/jpeg;base64,"),
  "the painted backdrop (inlined JPEG) is the --tree-backdrop value",
);
const fenrirRoot = document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]');
assert.equal(fenrirRoot.getAttribute("data-seat-x"), "17", "fenrir lantern seat x matches the prototype mapping");
assert.equal(fenrirRoot.getAttribute("data-seat-y"), "28", "fenrir lantern seat y matches the prototype mapping");
assert.equal(fenrirRoot.getAttribute("data-seat-dir"), "1", "fenrir vine hangs rightward (dir 1)");
const saysoRoot = document.querySelector('.ns-tree__item[data-namespace="say-so-agents"]');
assert.equal(saysoRoot.getAttribute("data-seat-x"), "59", "say-so lantern seat x matches the prototype mapping");
assert.equal(saysoRoot.getAttribute("data-seat-y"), "19", "say-so lantern seat y matches the prototype mapping");
for (const item of document.querySelectorAll(".ns-tree__item[data-namespace]")) {
  const x = Number(item.getAttribute("data-seat-x"));
  const y = Number(item.getAttribute("data-seat-y"));
  const dir = item.getAttribute("data-seat-dir");
  assert.ok(x > 0 && x <= 100, `namespace ${item.dataset.namespace} has an in-scene seat x (got ${x})`);
  assert.ok(y > 0 && y <= 100, `namespace ${item.dataset.namespace} has an in-scene seat y (got ${y})`);
  assert.ok(dir === "1" || dir === "-1", `namespace ${item.dataset.namespace} has a valid hang dir`);
}
assert.ok(
  paneHtml.includes("12 tasks · 2 running · 1 pending · 1 failed · 8 succeeded"),
  "fenrir-agents node keeps its task summary with status counts",
);
assert.ok(
  paneHtml.includes("8 tasks · 8 succeeded"),
  "say-so-agents node shows task summary",
);
assert.ok(paneHtml.includes("0 tasks"), "empty namespace shows a zero-task summary");
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]').getAttribute("aria-selected"),
  "true",
  "active namespace node is marked selected",
);

// Guide-line CSS: drawn rails + elbow connectors make the levels distinct.
assert.ok(
  css.includes(".ns-tree__task::before") && css.includes(".ns-tree__task::after"),
  "connector rail + elbow pseudo-elements present in the CSS",
);
assert.ok(
  css.includes("border-left: 1px solid var(--rune-border)") &&
    css.includes("border-top: 1px solid var(--rune-border)"),
  "connector lines drawn with theme borders",
);

// Task children: the active namespace starts pre-drilled — its 12 tasks
// (purged excluded; none in the fixture) branch under the node.
const fenrirTasks = document.querySelectorAll(
  '.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__task[data-session]',
);
assert.equal(fenrirTasks.length, 12, "fenrir-agents node branches its 12 tasks");
assert.ok(document.querySelector('.ns-tree__task[data-session="issue-1200-step1-firemandecko-1a2b3c4d"]'), "task node present under its namespace root (sessionId derived from labels)");
assert.ok(paneHtml.includes("issue-1203-step1-heimdall-4d5e6f7a"), "failed task branched beneath its namespace");

// REST AgentJob → wire Job mapping (lib/restJobs.ts) must fully resolve job
// metadata — the exact fields that used to render "Issue #? · unknown · Step ?".
assert.ok(paneHtml.includes("Issue #1200"), "issue number parsed from the session-id pattern");
assert.ok(paneHtml.includes("FiremanDecko"), "agent name resolved from the session-id pattern");
assert.ok(paneHtml.includes("Step 1"), "step number parsed from the session-id pattern");
assert.ok(paneHtml.includes("wire the namespace drilldown tree"), "fenrir/pr-title annotation surfaces as the card title");
assert.ok(!paneHtml.includes("Issue #?"), "no unresolved issue fallbacks");
assert.ok(!paneHtml.includes("Step ?"), "no unresolved step fallbacks");

// Task children are the SAME JobCard components the old flat list rendered.
assert.ok(
  document.querySelector('.ns-tree__task[data-session="issue-1200-step1-firemandecko-1a2b3c4d"] .card'),
  "task child renders as a job card",
);

// Squashed card layout (issue: navigate hundreds of jobs): the status icon
// LEADS the secondary meta line — under the title, beside the avatar column —
// and the action buttons cluster at the line's right end. The old right-aligned
// status button (.card-status-icon-btn) is gone.
const squashedMeta = document.querySelector(
  '.ns-tree__task[data-session="issue-1200-step1-firemandecko-1a2b3c4d"] .card-meta-new',
);
assert.ok(squashedMeta, "job card renders the secondary meta line");
assert.ok(
  squashedMeta.firstElementChild.className.includes("card-status-lead"),
  "status icon leads the meta line (left edge, under the avatar)",
);
assert.ok(
  squashedMeta.querySelector(".card-meta-actions"),
  "action buttons cluster at the meta line's right end",
);
assert.ok(
  !document.querySelector(".card-status-icon-btn"),
  "old right-aligned status icon button is gone",
);
assert.equal(
  document.querySelectorAll(
    '.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__task .card-status-lead',
  ).length,
  12,
  "every task card carries its leading status icon",
);
assert.equal(
  document.querySelectorAll('.ns-tree__item[data-namespace="fenrir-agents"] .ns-tree__task .card').length,
  12,
  "every branched task is a full job card",
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
document.querySelector(`.ns-tree__task[data-session="${SID_1200}"] .card`).click();
await flush();
await flush();
assert.equal(
  document.querySelector(`.ns-tree__task[data-session="${SID_1200}"]`).getAttribute("aria-selected"),
  "true",
  "clicked task node is marked selected",
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
document.querySelector(`.ns-tree__task[data-session="${SID_1200}"] .card`).click();
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
document.querySelector(`.ns-tree__task[data-session="${SID_1201}"] .card`).click();
await flush();
await flush();
assert.ok(
  globalThis.__stubWorkspaceTabs.has(TAB_1200) && globalThis.__stubWorkspaceTabs.has(TAB_1201),
  "two different sessions hold two tabs open at once",
);

// Ragnarök closes the session's tab with the pod (reference design: "cancel
// closes its tab"). The dialog lives in the pane overlay; confirm issues
// DELETE /api/jobs/:sessionId, then the tab must be gone.
document
  .querySelector(`.ns-tree__task[data-session="${SID_1201}"] [title^="Invoke Ragnarök"]`)
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
  document.getElementById("pane").innerHTML.includes("Ragnarok unleashed"),
  "Ragnarök toast confirms the termination",
);

// Closing a tab via its strip ✕ (the openWorkspace disposer) cleans up; a
// re-click on that session stacks a fresh tab again.
globalThis.__stubWorkspaceTabs.get(TAB_1200)?.close();
await flush();
assert.ok(!globalThis.__stubWorkspaceTabs.has(TAB_1200), "tab disposer closes the tab");
document.querySelector(`.ns-tree__task[data-session="${SID_1200}"] .card`).click();
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

// Icons from shanaghy.com's icon library sit on the namespace rows only —
// task rows are job cards with their own avatars/status icons (assert src
// attributes only; jsdom never fetches — no real network in this test).
const iconImgs = Array.from(document.querySelectorAll(".ns-tree__icon"));
assert.equal(iconImgs.length, 5, "each of the five namespace rows carries one small icon");
for (const img of iconImgs) {
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

// Selecting a namespace root still switches the active namespace (persisted
// to the same localStorage key the flat dropdown used) — and drills into it.
document.querySelector('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__select').click();
await flush();
await flush();
assert.equal(
  localStorage.getItem("hlidskjalf:namespace"),
  "say-so-agents",
  "clicking a namespace root sets the active namespace",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="say-so-agents"]').getAttribute("aria-selected"),
  "true",
  "newly selected namespace node is marked active",
);
assert.equal(
  document.querySelectorAll('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__task[data-session]').length,
  8,
  "selecting a namespace drills into its tasks",
);

// Cross-world task click: a task in a non-active namespace switches the
// namespace AND opens the session's own tab — captured against the task's
// world, so the pane's later namespace moves never rewire the tab's socket.
document.querySelector('.ns-tree__item[data-namespace="re-goatmower-agents"] .ns-tree__chevron-btn').click();
await flush();
document.querySelector('.ns-tree__task[data-session="issue-4400-step1-firemandecko-5e6f7a8b"] .card').click();
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
  document.querySelector('.ns-tree__task[data-session="issue-4400-step1-firemandecko-5e6f7a8b"]').getAttribute("aria-selected"),
  "true",
  "cross-world task click selects the session in its world",
);

// Empty namespace drills into an explicit empty state.
document.querySelector('.ns-tree__item[data-namespace="shanaghy-com-agents"] .ns-tree__chevron-btn').click();
await flush();
assert.ok(
  document.getElementById("pane").innerHTML.includes("no tasks in this world"),
  "empty namespace shows the no-tasks leaf",
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

// ── theme switching is plugin-scoped ───────────────────────────────────────
const switcher = document.querySelector('[aria-pressed]');
assert.ok(switcher, "theme switcher rendered");
switcher.click();
await flush();
await flush();
assert.equal(
  document.getElementById("pane").querySelector(".odins-throne-root").getAttribute("data-theme"),
  "light",
  "light theme applied on the plugin root",
);
assert.equal(dom.window.document.documentElement.getAttribute("data-theme"), null, "app <html> untouched");

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

console.log("SMOKE PASS — pane + page render, namespace drilldown tree (top-level roots, job-card task branches, old flat list gone, shanaghy.com icons + fallback, connector lines), CSS scoped, theme plugin-local, overlays wired, per-session workspace tabs (issue:6: open per click, focus dedupe, cancel + strip-close teardown, cross-world capture)");
process.exit(0);
