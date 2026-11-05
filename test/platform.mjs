// Platform-adapter unit test — drives the REAL adapter sources for BOTH
// targets (transpiled on the fly by the test loader, no build needed) and
// asserts each of the five seam points from knowledge/tech-designs/ui-sharing.md
// resolves to the right flavor:
//
//   1. Theme root  — web: <html data-theme>; plugin: <html> untouched.
//   2. WS URL      — web: same-origin /ws; plugin: ${base}/bot/ws?token=.
//   3. REST        — web: same-origin /api/*; plugin: /api/* → /bot/api + bearer.
//   4. Assets      — web: /profiles/*.png URLs; plugin: bundled module URLs.
//   5. App shell   — shell marker + focusLogView (host.navigate vs no-op).
//
// Run: npm test   (node --import ./test/register.mjs test/platform.mjs)

import jsdomPkg from "jsdom";
const { JSDOM } = jsdomPkg;
import assert from "node:assert/strict";

// ── jsdom global environment ────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
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

globalThis.__stubNavigations = [];

// Fetch stub: records (url, init) and answers 200 JSON so the adapter
// methods that await never reject.
const fetchCalls = [];
globalThis.fetch = async (input, init) => {
  fetchCalls.push({ url: String(input), init });
  return { ok: true, status: 200, json: async () => ({}) };
};
dom.window.fetch = globalThis.fetch;

// ── the real sources, transpiled by the loader ─────────────────────────────
const { setPlatform, getPlatform } = await import("../src/ui/platform.ts");
const { webPlatform } = await import("../src/targets/web/platform.ts");
const { pluginPlatform } = await import("../src/targets/plugin/platform.ts");
const { setTheme, currentTheme } = await import("../src/ui/hooks/useTheme.ts");

// ── seam 5: shell markers + adapter installation ───────────────────────────
assert.equal(webPlatform.shell, "web", "web adapter declares the web shell");
assert.equal(pluginPlatform.shell, "plugin", "plugin adapter declares the plugin shell");

setPlatform(webPlatform);
assert.equal(getPlatform(), webPlatform, "setPlatform installs the adapter");
assert.equal(typeof getPlatform().restFetch, "function", "installed adapter exposes the seam methods");
setPlatform(pluginPlatform);
assert.equal(getPlatform(), pluginPlatform, "adapter can be swapped (web ↔ plugin)");

// ── seam 2: WS URL ──────────────────────────────────────────────────────────
assert.equal(
  webPlatform.wsUrl("fenrir-agents"),
  "ws://localhost/ws?namespace=fenrir-agents",
  "web dials the same-origin /ws socket",
);
assert.equal(
  pluginPlatform.wsUrl("fenrir-agents"),
  "wss://odins-throne.shanaghy.com/bot/ws?namespace=fenrir-agents",
  "unpaired plugin dials the bot surface without a token",
);
localStorage.setItem("hlidskjalf:session", "sess-token-123");
assert.equal(
  pluginPlatform.wsUrl("fenrir-agents"),
  "wss://odins-throne.shanaghy.com/bot/ws?namespace=fenrir-agents&token=sess-token-123",
  "paired plugin dials the bot surface with ?token=",
);
localStorage.removeItem("hlidskjalf:session");

// ── seam 3: REST mapping ────────────────────────────────────────────────────
fetchCalls.length = 0;
await webPlatform.restFetch("/api/jobs?namespace=fenrir-agents");
assert.equal(fetchCalls[0].url, "/api/jobs?namespace=fenrir-agents", "web fetches the SPA path same-origin");
assert.ok(!fetchCalls[0].init?.headers, "web sends no explicit auth header (cookie session)");

localStorage.setItem("hlidskjalf:session", "sess-token-123");
await pluginPlatform.restFetch("/api/namespaces");
assert.equal(
  fetchCalls[1].url,
  "https://odins-throne.shanaghy.com/bot/api/namespaces",
  "plugin maps /api/* onto ${base}/bot/api",
);
assert.equal(
  fetchCalls[1].init.headers.get("Authorization"),
  "Bearer sess-token-123",
  "plugin attaches the pairing session as bearer",
);
await pluginPlatform.restFetch("/health");
assert.equal(
  fetchCalls[2].url,
  "https://odins-throne.shanaghy.com/health",
  "non-/api paths pass through to the upstream base untouched",
);
localStorage.removeItem("hlidskjalf:session");

// ── seam 1: theme root ──────────────────────────────────────────────────────
setPlatform(webPlatform);
webPlatform.applyTheme("light");
assert.equal(
  document.documentElement.getAttribute("data-theme"),
  "light",
  "web theme lands on <html>",
);
// Core wiring: the shared useTheme store routes setTheme through the adapter.
setTheme("dark");
assert.equal(document.documentElement.getAttribute("data-theme"), "dark", "setTheme propagates through the web adapter");
assert.equal(currentTheme(), "dark", "currentTheme reflects the shared state");

setPlatform(pluginPlatform);
document.documentElement.setAttribute("data-theme", "dark");
pluginPlatform.applyTheme("light");
assert.equal(
  document.documentElement.getAttribute("data-theme"),
  "dark",
  "plugin applyTheme never touches <html> — roots carry data-theme from React state",
);

// ── seam 4: portraits ───────────────────────────────────────────────────────
assert.equal(webPlatform.avatarUrl("loki", "dark"), "/profiles/loki-dark.png", "web portrait is a same-origin URL");
assert.equal(
  webPlatform.avatarUrl("firemandecko", "light"),
  "/profiles/fireman-decko-light.png",
  "firemandecko's file stem keeps its hyphen",
);
assert.equal(webPlatform.avatarUrl("unknown-agent", "dark"), undefined, "web: unknown agent → undefined");
assert.equal(
  typeof pluginPlatform.avatarUrl("loki", "dark"),
  "string",
  "plugin portrait resolves (bundled data URL at runtime)",
);
assert.ok(pluginPlatform.avatarUrl("odin", "light"), "plugin resolves the light variant too");
assert.equal(pluginPlatform.avatarUrl("unknown-agent", "dark"), undefined, "plugin: unknown agent → undefined");

// ── seam 5 (behavior): focusLogView ─────────────────────────────────────────
const navsBefore = globalThis.__stubNavigations.length;
webPlatform.focusLogView();
assert.equal(globalThis.__stubNavigations.length, navsBefore, "web focusLogView is a no-op");

pluginPlatform.focusLogView();
assert.equal(
  globalThis.__stubNavigations[globalThis.__stubNavigations.length - 1],
  "/odins-throne",
  "plugin focusLogView navigates to /odins-throne when the hash is elsewhere",
);
const afterFirstNav = globalThis.__stubNavigations.length;
dom.window.location.hash = "#/odins-throne";
pluginPlatform.focusLogView();
assert.equal(
  globalThis.__stubNavigations.length,
  afterFirstNav,
  "plugin focusLogView skips navigation when the throne route is already active",
);

console.log("PLATFORM PASS — both target adapters map the five seams to the right flavor (theme root, WS URL, REST mapping, portraits, shell)");
