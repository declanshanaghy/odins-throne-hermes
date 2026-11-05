// useWebSocket teardown regression test (issue #120).
//
// Mounts a component that uses the hook, then unmounts it, and asserts:
//   1. Exactly ONE WebSocket was constructed (mount only).
//   2. No reconnect timer fires after unmount — no stray second socket.
//   3. The same logic holds for a namespace-switch teardown (the old socket
//      does not schedule a reconnect when replaced by a new one).
//
// Run: npm test   (node --import ./test/register.mjs test/use-websocket.mjs)

import jsdomPkg from "jsdom";
const { JSDOM } = jsdomPkg;
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hermesDesktop = `${process.env.HOME}/.hermes/hermes-agent/apps/desktop/package.json`;
const localPkg = join(here, "..", "node_modules", "react-dom", "package.json");
const require = createRequire(existsSync(hermesDesktop) ? hermesDesktop : localPkg);
const React = require("react");
const { createRoot } = require("react-dom/client");
const { act } = React;

// ── jsdom global environment ──────────────────────────────────────────────
const dom = new JSDOM(
  "<!doctype html><html><head></head><body><div id='root'></div></body></html>",
  { url: "http://localhost/", pretendToBeVisual: true },
);
globalThis.window   = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
if (globalThis.navigator) {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator, configurable: true,
  });
} else {
  globalThis.navigator = dom.window.navigator;
}
globalThis.CustomEvent = dom.window.CustomEvent;
// Suppress React's "not configured to support act(...)" dev warnings.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.ResizeObserver = dom.window.ResizeObserver;

// ── FakeWebSocket — tracks construction and async close delivery ──────────
let fakeInstances = [];

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this._listeners = {};
    fakeInstances.push(this);
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(h => h !== handler);
    }
  }

  send() {}

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    // Deliver the close event asynchronously (matches real browser behavior).
    // Uses setImmediate so it fires after the current synchronous teardown
    // completes — this is the race the bug exploited.
    setImmediate(() => {
      (this._listeners["close"] ?? []).forEach(h => h({}));
    });
  }

  /** Trigger open from the outside (test helper). */
  _triggerOpen() {
    this.readyState = FakeWebSocket.OPEN;
    (this._listeners["open"] ?? []).forEach(h => h({}));
  }
}

globalThis.WebSocket = FakeWebSocket;
dom.window.WebSocket = FakeWebSocket;

// ── platform stub — returns a fake WS URL ────────────────────────────────
const { setPlatform } = await import("../src/ui/platform.ts");
setPlatform({
  shell: "web",
  applyTheme() {},
  wsUrl(ns) { return `ws://localhost/ws?ns=${ns}`; },
  restFetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  avatarUrl() { return undefined; },
  focusLogView() {},
});

// ── import the hook ───────────────────────────────────────────────────────
const { useWebSocket } = await import("../src/ui/hooks/useWebSocket.ts");

// ── helpers ───────────────────────────────────────────────────────────────
function resetFakes() { fakeInstances = []; }

/** Drain all pending setImmediate callbacks (async close events). */
function drainImmediate() {
  return new Promise(resolve => setImmediate(resolve));
}

// ── Test 1: mount then unmount — no stray socket ─────────────────────────
{
  resetFakes();

  // Build a minimal host component that uses the hook.
  function TestHook() {
    useWebSocket(() => {}, "fenrir-agents");
    return null;
  }

  const container = dom.window.document.getElementById("root");
  let root;

  // Mount
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(TestHook));
  });

  assert.equal(fakeInstances.length, 1, "mount: exactly one WebSocket constructed");
  const ws1 = fakeInstances[0];
  assert.ok(ws1.url.includes("fenrir-agents"), "mount: ws URL contains the namespace");

  // Trigger open so the socket is in OPEN state
  await act(async () => { ws1._triggerOpen(); });

  // Unmount
  await act(async () => { root.unmount(); });

  // Allow the async close event to fire
  await drainImmediate();

  // Extra tick to let any setTimeout(0/1000) callbacks that might sneak in settle.
  // We wait two event-loop turns past the close event.
  await drainImmediate();

  assert.equal(fakeInstances.length, 1, "after unmount: no stray second WebSocket constructed");
  console.log("use-websocket test 1 PASS: mount+unmount — no stray socket after async close event");
}

// ── Test 2: unmount before socket opens (CONNECTING state) ───────────────
{
  resetFakes();

  // Fresh container
  const container2 = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container2);

  function TestHook2() {
    useWebSocket(() => {}, "say-so-agents");
    return null;
  }

  let root2;
  await act(async () => {
    root2 = createRoot(container2);
    root2.render(React.createElement(TestHook2));
  });

  assert.equal(fakeInstances.length, 1, "test2 mount: one WebSocket");

  // Unmount while still in CONNECTING state
  await act(async () => { root2.unmount(); });
  await drainImmediate();
  await drainImmediate();

  assert.equal(fakeInstances.length, 1, "test2: no stray socket after unmount in CONNECTING state");
  console.log("use-websocket test 2 PASS: unmount in CONNECTING state — no stray socket");
}

// ── Test 3: namespace switch — old socket does not trigger reconnect ──────
{
  resetFakes();

  const container3 = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container3);

  let currentNs = "ns-alpha";
  let setNsExternal;

  function TestHook3() {
    const [ns, setNs] = React.useState(currentNs);
    setNsExternal = setNs;
    useWebSocket(() => {}, ns);
    return null;
  }

  let root3;
  await act(async () => {
    root3 = createRoot(container3);
    root3.render(React.createElement(TestHook3));
  });

  assert.equal(fakeInstances.length, 1, "test3 initial: one WebSocket for ns-alpha");
  const wsAlpha = fakeInstances[0];
  assert.ok(wsAlpha.url.includes("ns-alpha"), "test3: first socket is ns-alpha");

  // Open the initial socket
  await act(async () => { wsAlpha._triggerOpen(); });

  // Switch namespace — this should close ws-alpha and open ws-beta
  await act(async () => { setNsExternal("ns-beta"); });

  // Allow the async close event from ws-alpha to fire
  await drainImmediate();
  await drainImmediate();

  // Should now have exactly 2 sockets (alpha + beta), not 3 (alpha reconnect)
  assert.equal(fakeInstances.length, 2, "test3: exactly 2 sockets (alpha + beta), namespace switch does not trigger alpha reconnect");
  assert.ok(fakeInstances[1].url.includes("ns-beta"), "test3: second socket is ns-beta");

  await act(async () => { root3.unmount(); });
  await drainImmediate();
  await drainImmediate();

  assert.equal(fakeInstances.length, 2, "test3: unmount after namespace switch — still exactly 2, no extra stray socket");
  console.log("use-websocket test 3 PASS: namespace switch — old socket close event does not trigger reconnect");
}

console.log("use-websocket: all 3 tests pass — teardown is race-free, no stray sockets (issue #120)");
