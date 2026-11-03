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
const fixtureJob = (sessionId, status) => ({
  sessionId,
  name: `job-${sessionId}`,
  issueNumber: 1,
  agent: "fireman",
  step: 1,
  status,
  startedAt: null,
  completedAt: null,
  podName: null,
  issueTitle: null,
  branchName: null,
});
const JOBS_BY_NS = {
  "fenrir-agents": [
    fixtureJob("s-run-1", "running"),
    fixtureJob("s-run-2", "running"),
    fixtureJob("s-pend-1", "pending"),
    fixtureJob("s-fail-1", "failed"),
    ...Array.from({ length: 8 }, (_, i) => fixtureJob(`s-ok-${i}`, "succeeded")),
  ],
  "say-so-agents": Array.from({ length: 8 }, (_, i) => fixtureJob(`ss-ok-${i}`, "succeeded")),
  "mytruthfinder-agents": [fixtureJob("mt-run-1", "running")],
  "shanaghy-com-agents": [],
  "re-goatmower-agents": [fixtureJob("rg-fail-1", "failed"), fixtureJob("rg-ok-1", "succeeded")],
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
assert.ok(paneHtml.includes("No agent jobs found"), "empty job list state rendered");
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
assert.ok(document.querySelector('.ns-tree__task[data-session="s-run-1"]'), "task node present under its namespace root");
assert.ok(paneHtml.includes("s-fail-1"), "failed task branched beneath its namespace");

// Clicking a task node selects that session — the same semantics the job
// cards use (aria-selected marks the task node).
document.querySelector('.ns-tree__task[data-session="s-run-1"] .ns-tree__task-btn').click();
await flush();
await flush();
assert.equal(
  document.querySelector('.ns-tree__task[data-session="s-run-1"]').getAttribute("aria-selected"),
  "true",
  "clicked task node is marked selected",
);

// Icons from shanaghy.com's icon library (assert src attributes only).
const iconImgs = Array.from(document.querySelectorAll(".ns-tree__icon"));
assert.ok(iconImgs.length > 0, "tree nodes carry icons");
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
assert.equal(
  document.querySelector('.ns-tree__task[data-session="s-run-1"] .ns-tree__icon').getAttribute("src"),
  "https://www.shanaghy.com/assets/icons/hammer.png",
  "running task node gets the hammer icon",
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
document.querySelector('.ns-tree__task[data-session="rg-fail-1"] .ns-tree__task-btn').click();
await flush();
await flush();
assert.equal(
  localStorage.getItem("hlidskjalf:namespace"),
  "re-goatmower-agents",
  "cross-world task click switches the active namespace",
);
assert.equal(
  document.querySelector('.ns-tree__task[data-session="rg-fail-1"]').getAttribute("aria-selected"),
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

console.log("SMOKE PASS — pane + page render, namespace drilldown tree (top-level roots, task branches, shanaghy.com icons + fallback, connector lines), CSS scoped, theme plugin-local, overlays wired");
process.exit(0);
