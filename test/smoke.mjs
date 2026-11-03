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

// ── namespace tree (issue:2) ────────────────────────────────────────────────
// All namespaces as a browseable tree, each node with a task summary and
// per-status counts sourced from the stubbed per-namespace /api/jobs fetches.
assert.ok(document.querySelector('.ns-tree[aria-label="Namespace tree"]'), "namespace tree mounted");
assert.ok(paneHtml.includes("All namespaces"), "tree root node rendered");
assert.equal(document.querySelectorAll(".ns-tree__item[data-namespace]").length, 5, "all five namespaces are tree nodes");
assert.ok(document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]'), "fenrir-agents node present");
assert.ok(
  paneHtml.includes("12 tasks · 2 running · 1 pending · 1 failed · 8 succeeded"),
  "fenrir-agents node shows task summary with status counts",
);
assert.ok(
  paneHtml.includes("8 tasks · 8 succeeded"),
  "say-so-agents node shows task summary",
);
assert.ok(paneHtml.includes("0 tasks"), "empty namespace shows a zero-task summary");
assert.ok(
  document.querySelector('.ns-tree__item[data-namespace="fenrir-agents"]').getAttribute("aria-selected") === "true",
  "active namespace node is marked selected",
);

// Selecting a namespace node still switches the active namespace (persisted
// to the same localStorage key the flat dropdown used).
document.querySelector('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__select').click();
await flush();
await flush();
assert.equal(
  localStorage.getItem("hlidskjalf:namespace"),
  "say-so-agents",
  "clicking a tree node sets the active namespace",
);
assert.equal(
  document.querySelector('.ns-tree__item[data-namespace="say-so-agents"]').getAttribute("aria-selected"),
  "true",
  "newly selected namespace node is marked active",
);

// Expanding a namespace node reveals its per-status breakdown children.
document.querySelector('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__chevron-btn').click();
await flush();
assert.ok(
  document.querySelectorAll('.ns-tree__item[data-namespace="say-so-agents"] .ns-tree__status').length > 0,
  "expanded namespace node shows status breakdown",
);
assert.ok(
  document.getElementById("pane").innerHTML.includes("succeeded"),
  "status breakdown lists job statuses",
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

console.log("SMOKE PASS — pane + page render, namespace tree with summaries, CSS scoped, theme plugin-local, overlays wired");
process.exit(0);
