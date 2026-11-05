// Unit tests for useNamespaceCycleKey — issue #108
// Verifies: cycle order, wrap-around, input-guard, modifier-key guard.
//
// Run: node --import ./test/register.mjs test/namespace-cycle-key.mjs
// (The register hook transpiles src/**/*.ts on the fly via esbuild.)

import assert from "node:assert/strict";
import jsdomPkg from "jsdom";
const { JSDOM } = jsdomPkg;

// ── jsdom environment ────────────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.document = dom.window.document;
globalThis.window = dom.window;

// ── stub React.useEffect: call the setup fn immediately, store cleanup ───────
// The hook only uses useEffect — no other React APIs. This stub makes the
// hook callable in a plain-node environment without a renderer.
let cleanupFn = null;
const reactStub = {
  useEffect(fn, _deps) {
    if (cleanupFn) cleanupFn();      // simulate previous effect cleanup
    cleanupFn = fn() ?? null;         // run immediately; store cleanup
  },
};

// Patch the module system: loader.mjs maps "react" via MAP but only for the
// CJS version. The src/ hook imports `useEffect` from "react" — we need to
// inject our stub before importing the hook. We use a lightweight approach:
// import the hook source via the register.mjs transpiler (which handles src/**),
// but first stub `useEffect` on a module-level mock.
//
// Strategy: use esbuild to compile the TS, then evaluate it with the stub
// injected as the `react` module — the same technique as tree-seats.mjs.
import { transformSync } from "esbuild";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath, URL as NodeURL } from "node:url";

const src = readFileSync(
  new NodeURL("../src/ui/hooks/useNamespaceCycleKey.ts", import.meta.url),
  "utf8",
);
// Compile TS → ESM, replacing the React import with our inline stub
const compiledSrc = src.replace(
  /^import\s*\{[^}]+\}\s*from\s*["']react["'];?\s*$/m,
  "// react stub injected by test",
);
const { code } = transformSync(compiledSrc, { loader: "ts", format: "esm" });

// Inject the useEffect stub at the top of the compiled module
const patchedCode = `
const { useEffect } = __reactStub;
${code}
`;

// Write to a temp dir and import
const tmp = mkdtempSync(join(tmpdir(), "ns-cycle-key-"));
writeFileSync(join(tmp, "useNamespaceCycleKey.mjs"), patchedCode);

// Use a data URL with the stub injected as a global
globalThis.__reactStub = reactStub;
const { useNamespaceCycleKey } = await import(
  pathToFileURL(join(tmp, "useNamespaceCycleKey.mjs")).href
);

// ── helpers ──────────────────────────────────────────────────────────────────
const NS = [
  { id: "alpha", label: "Alpha" },
  { id: "beta",  label: "Beta"  },
  { id: "gamma", label: "Gamma" },
];

function fire(key, { target = document.body, metaKey = false, ctrlKey = false, altKey = false } = {}) {
  const ev = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, metaKey, ctrlKey, altKey });
  Object.defineProperty(ev, "target", { value: target });
  document.dispatchEvent(ev);
}

function mountHook(namespace) {
  const calls = [];
  const setNs = (id) => calls.push(id);
  if (cleanupFn) cleanupFn();
  cleanupFn = null;
  useNamespaceCycleKey(NS, namespace, setNs);
  return { calls, setNs };
}

// ── tests ────────────────────────────────────────────────────────────────────

// 1. cycles to the next namespace
{
  const { calls } = mountHook("alpha");
  fire("n");
  assert.deepEqual(calls, ["beta"], "cycles alpha → beta");
}

// 2. wraps from last back to first
{
  const { calls } = mountHook("gamma");
  fire("n");
  assert.deepEqual(calls, ["alpha"], "wraps gamma → alpha");
}

// 3. cycles from middle
{
  const { calls } = mountHook("beta");
  fire("n");
  assert.deepEqual(calls, ["gamma"], "cycles beta → gamma");
}

// 4. does not fire for other keys
{
  const { calls } = mountHook("alpha");
  fire("k");
  fire("N");
  fire(" ");
  assert.deepEqual(calls, [], "ignores non-'n' keys");
}

// 5. does not fire when target is an INPUT
{
  const { calls } = mountHook("alpha");
  const input = dom.window.document.createElement("input");
  dom.window.document.body.appendChild(input);
  fire("n", { target: input });
  dom.window.document.body.removeChild(input);
  assert.deepEqual(calls, [], "ignores keydown on <input>");
}

// 6. does not fire when target is a TEXTAREA
{
  const { calls } = mountHook("alpha");
  const ta = dom.window.document.createElement("textarea");
  dom.window.document.body.appendChild(ta);
  fire("n", { target: ta });
  dom.window.document.body.removeChild(ta);
  assert.deepEqual(calls, [], "ignores keydown on <textarea>");
}

// 7. does not fire when target is a SELECT
{
  const { calls } = mountHook("alpha");
  const sel = dom.window.document.createElement("select");
  dom.window.document.body.appendChild(sel);
  fire("n", { target: sel });
  dom.window.document.body.removeChild(sel);
  assert.deepEqual(calls, [], "ignores keydown on <select>");
}

// 8. does not fire with modifier keys
{
  const { calls } = mountHook("alpha");
  fire("n", { metaKey: true });
  fire("n", { ctrlKey: true });
  fire("n", { altKey: true });
  assert.deepEqual(calls, [], "ignores n with modifier keys");
}

// 9. unknown current namespace falls back to first (idx=-1 → 0)
{
  const { calls } = mountHook("unknown");
  fire("n");
  // findIndex returns -1, so (-1 + 1) % 3 = 0 → "alpha"
  assert.deepEqual(calls, ["alpha"], "unknown namespace cycles to index 0");
}

// 10. cleanup removes the listener (no calls after cleanup)
{
  const { calls } = mountHook("alpha");
  if (cleanupFn) cleanupFn(); // simulate unmount
  cleanupFn = null;
  fire("n");
  assert.deepEqual(calls, [], "cleanup removes keydown listener");
}

console.log("namespace-cycle-key: all 10 assertions passed");
