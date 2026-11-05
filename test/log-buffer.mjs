// RAF log-line buffer test — issue:106
// Verifies that handleMessage (log-line) buffers lines and processes them
// only after requestAnimationFrame fires, so many rapid incoming lines collapse
// into a single React render instead of one render per line.
//
// Run: npm test   (requires `npm run build` first)

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
const React = require("react");

// ── controllable RAF mock ───────────────────────────────────────────────────
// Must be installed on globalThis BEFORE the plugin loads so the bundle picks
// up our mock instead of jsdom's real timer-based implementation.
const rafQueue = [];
globalThis.requestAnimationFrame = (cb) => {
  rafQueue.push(cb);
  return rafQueue.length;
};

// ── jsdom global environment ────────────────────────────────────────────────
const dom = new JSDOM(
  "<!doctype html><html><head></head><body><div id='probe'></div></body></html>",
  { url: "http://localhost/" }
);
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
class FakeWebSocket {
  constructor() { this.readyState = 0; }
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}
globalThis.WebSocket = FakeWebSocket;
dom.window.WebSocket = FakeWebSocket;

// ── load the built bundle (uses globalThis.requestAnimationFrame at runtime) ─
const { useLogStream } = await import("../desktop/plugin.js");

// ── probe component ──────────────────────────────────────────────────────────
let handle = null;
function Probe() {
  handle = useLogStream();
  return React.createElement("div", null, String(handle.entries.length));
}

const root = createRoot(document.getElementById("probe"));
root.render(React.createElement(Probe));
const flush = () => new Promise((r) => setTimeout(r, 60));
await flush();
await flush();
assert.ok(handle, "useLogStream hook captured from rendered probe");

// Helper: fire all queued RAF callbacks then let React re-render.
async function fireRaf() {
  const cbs = rafQueue.splice(0);
  for (const cb of cbs) cb(0);
  await flush();
  await flush();
}

// ── Test 1: lines are buffered — no entries until RAF fires ─────────────────
handle.clearEntries();
rafQueue.length = 0;

const RAW_LINES = [
  "2026-01-01T00:00:00Z line one",
  "2026-01-01T00:00:00Z line two",
  "2026-01-01T00:00:00Z line three",
];

for (const line of RAW_LINES) {
  handle.handleMessage({ type: "log-line", line });
}

await flush(); // React micro-task flush — RAF has NOT fired yet
assert.equal(handle.entries.length, 0, "entries remain empty until RAF fires (lines buffered)");
assert.equal(rafQueue.length, 1, "exactly one RAF scheduled for the entire burst");

await fireRaf();
assert.ok(handle.entries.length > 0, "entries appear after RAF fires");

// ── Test 2: burst deduplication — only one RAF per burst ───────────────────
handle.clearEntries();
rafQueue.length = 0;

for (let i = 0; i < 10; i++) {
  handle.handleMessage({ type: "log-line", line: `2026-01-01T00:00:00Z burst-${i}` });
}
assert.equal(rafQueue.length, 1, "ten rapid messages schedule exactly one RAF (not ten)");

await fireRaf();
assert.ok(handle.entries.length >= 10, "all burst lines processed after one RAF tick");

// ── Test 3: clearEntries resets the buffer ──────────────────────────────────
handle.clearEntries();
rafQueue.length = 0;

handle.handleMessage({ type: "log-line", line: "2026-01-01T00:00:00Z stale line" });
assert.equal(rafQueue.length, 1, "RAF scheduled for a stale line");
handle.clearEntries(); // clear BEFORE RAF fires — should discard the buffered line
await fireRaf(); // RAF fires but buffer was cleared
assert.equal(handle.entries.length, 0, "cleared buffer means RAF fires but processes no lines");

// ── Test 4: stream-end flushes synchronously (not via RAF) ─────────────────
handle.clearEntries();
rafQueue.length = 0;

handle.handleMessage({ type: "stream-end", reason: "closed" });
await flush();
const streamEndEntries = handle.entries.filter((e) => e.type === "stream-end");
assert.equal(streamEndEntries.length, 1, "stream-end bypasses the RAF buffer and lands immediately");
assert.ok(handle.streamEnded, "streamEnded flag set after stream-end");

console.log(
  "log-buffer PASS — lines buffered until RAF fires, burst deduplication to one RAF, " +
  "clearEntries resets buffer, stream-end bypasses buffer"
);
process.exit(0);
