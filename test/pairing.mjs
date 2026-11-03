// Pairing-flow unit test — drives the REAL src/targets/plugin/upstream.ts
// (transpiled on the fly by the test loader, no build needed) through the
// whole hand-off edge case from the FiremanDecko handoff: pairing card →
// key → bot surface. Covers key validation, session minting/rollback, the
// REST/WS transport mapping, and the device identity the pairing code binds
// to server-side. No network: fetch is stubbed.
//
// Run: npm test   (node --import ./test/register.mjs test/pairing.mjs)

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

// Fetch stub: queue of programmed responses; records every (url, init).
const fetchCalls = [];
let nextResponse = { ok: true, status: 200 };
globalThis.fetch = async (input, init) => {
  fetchCalls.push({ url: String(input), init });
  return nextResponse;
};
dom.window.fetch = globalThis.fetch;

const SESSION_KEY = "hlidskjalf:session";
const URL_KEY = "hlidskjalf:upstream-url";
const CLIENT_KEY = "hlidskjalf:client-id";
const DEFAULT_BASE = "https://odins-throne.fenrirledger.com";

// ── the real source, transpiled by the loader ────────────────────────────────
const upstream = await import("../src/targets/plugin/upstream.ts");
const {
  DEFAULT_UPSTREAM_URL,
  setUpstreamConfig,
  getClientId,
  isConfigured,
  pairingUrl,
  acceptPairingKey,
  restUrl,
  authInit,
  wsUrl,
  getSession,
  clearSession,
  subscribeSession,
  sessionSnapshot,
} = upstream;

// ── transport mapping (seam 2/3 building blocks) ─────────────────────────────
assert.equal(DEFAULT_UPSTREAM_URL, DEFAULT_BASE, "default upstream is the deployed monitor");
setUpstreamConfig(DEFAULT_BASE + "///"); // trailing slashes must be trimmed
assert.equal(
  restUrl("/api/namespaces"),
  `${DEFAULT_BASE}/bot/api/namespaces`,
  "restUrl maps /api/* onto ${base}/bot/api",
);
assert.equal(
  restUrl("/health"),
  `${DEFAULT_BASE}/health`,
  "restUrl passes non-/api paths through untouched",
);
setUpstreamConfig("http://localhost:8080/");
assert.equal(
  wsUrl("fenrir-agents"),
  "ws://localhost:8080/bot/ws?namespace=fenrir-agents",
  "plain-http upstream dials ws, and the trailing slash is trimmed",
);

// authInit: bearer merged with (not replacing) existing headers.
localStorage.setItem(SESSION_KEY, "sess-token-123");
const init = authInit({ headers: { "X-Custom": "yes" } });
assert.equal(init.headers.get("Authorization"), "Bearer sess-token-123", "bearer attaches to the session");
assert.equal(init.headers.get("X-Custom"), "yes", "existing headers survive the merge");
localStorage.removeItem(SESSION_KEY);
const bare = authInit();
assert.ok(!bare.headers.get("Authorization"), "no Authorization header when unpaired");

// Paired ws: token rides as a query param on the wss dial (default upstream).
setUpstreamConfig(DEFAULT_BASE);
localStorage.setItem(SESSION_KEY, "sess-token-123");
assert.equal(
  wsUrl("fenrir-agents"),
  "wss://odins-throne.fenrirledger.com/bot/ws?namespace=fenrir-agents&token=sess-token-123",
  "paired ws dial carries ?token= and upgrades https→wss",
);
localStorage.removeItem(SESSION_KEY);

// ── device identity ─────────────────────────────────────────────────────────
localStorage.removeItem(CLIENT_KEY);
const id1 = getClientId();
assert.match(id1, /^[0-9a-f]{16}$/, "fresh client id is 16 hex chars (two dwords)");
assert.equal(getClientId(), id1, "client id is stable for the install (persisted)");
assert.equal(localStorage.getItem(CLIENT_KEY), id1, "client id is persisted for the next session");

// ── pairing URL (the system-browser hand-off page) ───────────────────────────
assert.equal(
  pairingUrl(),
  `${DEFAULT_BASE}/api/handoff?client=${id1}`,
  "pairing page URL carries the device id and sits behind the site's own auth",
);

// ── isConfigured ──────────────────────────────────────────────────────────────
assert.equal(isConfigured(), false, "default upstream + no session ⇒ not configured");
localStorage.setItem(SESSION_KEY, "sess-token-123");
assert.equal(isConfigured(), true, "a paired session configures the plugin");
localStorage.removeItem(SESSION_KEY);
setUpstreamConfig("http://localhost:8080");
assert.equal(isConfigured(), true, "a URL override configures the plugin (local dev has no auth)");
setUpstreamConfig(DEFAULT_BASE);
assert.equal(isConfigured(), false, "back to defaults ⇒ not configured");

// ── acceptPairingKey: validation ──────────────────────────────────────────────
fetchCalls.length = 0;

// Empty key: rejected before any network activity.
let res = await acceptPairingKey("   ");
assert.equal(res.ok, false, "blank key is rejected");
assert.ok(res.error, "blank key rejection explains itself");
assert.equal(fetchCalls.length, 0, "blank key never hits the network");
assert.equal(getSession(), "", "no session leaks from a blank key");

// Malformed key: rejected before any network activity.
res = await acceptPairingKey("not-a-pairing-key");
assert.equal(res.ok, false, "malformed key is rejected");
assert.equal(fetchCalls.length, 0, "malformed key never hits the network");
assert.equal(getSession(), "", "no session leaks from a malformed key");

// ── acceptPairingKey: success path ───────────────────────────────────────────
let notified = 0;
const unsubscribe = subscribeSession(() => { notified += 1; });
const snapshotBefore = sessionSnapshot();
nextResponse = { ok: true, status: 200 };
res = await acceptPairingKey("  ab12CD34ef.Xy-5678_zw  ");
assert.equal(res.ok, true, "well-formed, accepted key pairs the plugin");
assert.equal(getSession(), "ab12CD34ef.Xy-5678_zw", "key is trimmed and stored as the session");
assert.ok(sessionSnapshot() > snapshotBefore, "session store bumps its version on pairing");
assert.equal(notified, 1, "pane subscribers are notified of the new session");
assert.equal(fetchCalls.length, 1, "acceptance validates the key once against the bot surface");
assert.equal(
  fetchCalls[0].url,
  `${DEFAULT_BASE}/bot/api/namespaces`,
  "validation goes through the token-gated bot surface",
);
assert.equal(
  fetchCalls[0].init.headers.get("Authorization"),
  "Bearer ab12CD34ef.Xy-5678_zw",
  "the candidate key is already used as bearer during validation",
);

// ── acceptPairingKey: rejected key rolls back ────────────────────────────────
nextResponse = { ok: false, status: 401 };
res = await acceptPairingKey("ab12CD34ef.rejected-key-1");
assert.equal(res.ok, false, "a rejected key does not pair");
assert.ok(res.error.includes("401"), "rejection surfaces the HTTP status");
assert.equal(getSession(), "", "rejected key leaves no session behind (rolled back)");
assert.equal(localStorage.getItem(SESSION_KEY), null, "localStorage is clean after rejection");

// ── acceptPairingKey: network failure rolls back ─────────────────────────────
nextResponse = null; // signal the stub to throw
globalThis.fetch = async () => { throw new Error("connection refused"); };
res = await acceptPairingKey("ab12CD34ef.network-down-1");
assert.equal(res.ok, false, "a network failure does not pair");
assert.ok(res.error.includes("connection refused"), "the network error propagates");
assert.equal(getSession(), "", "network failure leaves no session behind (rolled back)");

// clearSession notifies and empties.
localStorage.setItem(SESSION_KEY, "leftover");
const notifiedBefore = notified;
clearSession();
assert.equal(getSession(), "", "clearSession empties the stored session");
assert.equal(notified, notifiedBefore + 1, "clearSession notifies subscribers");
unsubscribe();

console.log("PAIRING PASS — upstream transport mapping, device identity, and the full pairing flow (validate → mint → rollback) are unchanged by the restructure");
