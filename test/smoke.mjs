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

const require = createRequire(`${process.env.HOME}/.hermes/hermes-agent/apps/desktop/package.json`);
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
globalThis.fetch = async (input) => {
  const url = String(input);
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

globalThis.__stubNavigations = [];
globalThis.__stubNotifications = [];
globalThis.__stubWorkspaceTabs = [];

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

// Clicking a task's job card selects that session — the same semantics the
// old list had (aria-selected marks the task node).
document.querySelector('.ns-tree__task[data-session="issue-1200-step1-firemandecko-1a2b3c4d"] .card').click();
await flush();
await flush();
assert.equal(
  document.querySelector('.ns-tree__task[data-session="issue-1200-step1-firemandecko-1a2b3c4d"]').getAttribute("aria-selected"),
  "true",
  "clicked task node is marked selected",
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
// namespace AND keeps that session selected (pending-select flow in App).
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

// ── job-card click → workspace tab open ────────────────────────────────────
// Verify that the pane's onSelectSession wiring reaches host.openWorkspace.
// The entry.tsx exports openThroneTab as a test seam; calling it with a session
// id is exactly what SidebarConnected does when a job card is clicked.
const { openThroneTab } = await import("../desktop/plugin.js");

assert.equal(typeof openThroneTab, "function", "openThroneTab exported as test seam");

// Before any click the workspace tab list is empty.
assert.equal(globalThis.__stubWorkspaceTabs.length, 0, "no workspace tabs opened yet");

openThroneTab("test-session-001");
await flush();

assert.ok(
  globalThis.__stubWorkspaceTabs.length > 0,
  "job-card click triggers host.openWorkspace (new workspace tab)",
);
assert.equal(
  globalThis.__stubWorkspaceTabs[0].id,
  "throne-log",
  "openWorkspace called with stable tab id 'throne-log'",
);
assert.equal(
  globalThis.__stubWorkspaceTabs[0].title,
  "Odin's Throne",
  "workspace tab carries the 'Odin's Throne' title",
);

// Re-clicking with a different session re-uses the same tab (re-fronts it)
// rather than opening a second one — stub records every call so we can count.
openThroneTab("test-session-002");
await flush();
assert.equal(
  globalThis.__stubWorkspaceTabs.length,
  2,
  "second click records another openWorkspace call (stub records all; host dedupes by id)",
);
assert.equal(
  globalThis.__stubWorkspaceTabs[1].id,
  "throne-log",
  "second click uses the same stable tab id",
);

// ── fallback: host.openWorkspace unavailable (older desktop builds) ────────
// On older desktop builds host.openWorkspace may be absent. The opener must
// fall back to host.navigate('/odins-throne') so the user still reaches the
// log page. We simulate this by temporarily removing the method from the stub.
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
  "/odins-throne",
  "fallback: navigates to /odins-throne on older desktop builds",
);
// Restore so the tab-open path is active for the remainder of the test run.
stubHost.openWorkspace = savedOpenWorkspace;

// ── multiple rapid clicks all use the stable tab id ───────────────────────
// Three successive clicks all go through the same 'throne-log' id so the host
// never opens more than one tab (host dedupes on id; stub just records calls).
const countBefore = globalThis.__stubWorkspaceTabs.length;
openThroneTab("rapid-a");
openThroneTab("rapid-b");
openThroneTab("rapid-c");
await flush();
const rapidCalls = globalThis.__stubWorkspaceTabs.slice(countBefore);
assert.equal(rapidCalls.length, 3, "three rapid clicks each call openWorkspace once");
assert.ok(
  rapidCalls.every((t) => t.id === "throne-log"),
  "all rapid clicks use the stable 'throne-log' id (host dedupes by id)",
);

console.log("SMOKE PASS — pane + page render, namespace drilldown tree (top-level roots, job-card task branches, old flat list gone, shanaghy.com icons + fallback, connector lines), CSS scoped, theme plugin-local, overlays wired, job-card click opens workspace tab");
process.exit(0);
