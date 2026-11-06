// Pinned-session overlay tests — Odin's memory on the tree.
//
// lib/cachedOverlay is the merge that hangs pinned sessions (the localStorage
// pin cache) on their realm's vine as gold "cached" cards, so the header's
// session count and the tree's strands agree. smoke.mjs proves the BUILT
// artifact renders the cards end-to-end; this suite pins the semantics:
//   • cachedJobFromMeta — pin metadata → wire Job (parseJob-compatible)
//   • cachedOverlayEntries — realm attribution (recorded realm wins; legacy
//     pins follow the active namespace), live sessions excluded
//   • mergeCachedIntoSummaries — counts + jobs land on the realm, live
//     duplicates never duplicated, missing/errored realms untouched, an
//     empty overlay returns the input identity
//
// Run: npm test   (node --import ./test/register.mjs test/cached-tree.mjs)

import jsdomPkg from "jsdom";
const { JSDOM } = jsdomPkg;
import assert from "node:assert/strict";

// localStorage is the pin cache's store — jsdom provides it.
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { cachedJobFromMeta, cachedOverlayEntries, mergeCachedIntoSummaries } =
  await import("../src/ui/lib/cachedOverlay.ts");
const { parseJob } = await import("../src/ui/hooks/useJobs.ts");

/** Seed a pinned session exactly the way pinSession() writes it. */
function pin(id, extra = {}) {
  localStorage.setItem(`odin-throne:cache:${id}`, "2026-01-01T00:00:00Z pinned\n");
  localStorage.setItem(
    `odin-throne:cache-meta:${id}`,
    JSON.stringify({
      sessionId: id,
      name: `agent-${id}`,
      issueNumber: 42,
      agent: "firemandecko",
      step: 1,
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T01:00:00Z",
      issueTitle: "a kept session",
      branchName: null,
      pinnedAt: Date.now(),
      ...extra,
    }),
  );
}

// A cache entry without metadata cannot render — never an overlay entry.
localStorage.setItem("odin-throne:cache:orphan-pin", "content only, no meta");

// ── cachedJobFromMeta: meta → wire Job ──────────────────────────────────────
{
  const job = cachedJobFromMeta({
    sessionId: "s-1",
    name: "agent-s-1",
    issueNumber: 42,
    agent: "loki",
    step: 2,
    startedAt: "2026-01-01T00:00:00Z",
    completedAt: null,
    issueTitle: "the breaker's work",
    branchName: "fix/branch",
    pinnedAt: 1,
    namespace: "fenrir-agents",
  });
  assert.equal(job.status, "cached", "pin metadata becomes a cached job");
  assert.equal(job.podName, null, "a cached job has no pod — it was reaped");
  assert.equal(job.issueNumber, 42, "issue number carries over");
  assert.equal(job.agent, "loki", "agent key carries over");
  // parseJob consumes it exactly like a REST job — the tree renders cached
  // cards through the same path as live ones.
  const display = parseJob(job);
  assert.equal(display.status, "cached", "parseJob reads the cached status");
  assert.equal(display.agentName, "Loki", "agent name resolves through AGENT_NAMES");
  assert.equal(display.issue, "42", "issue parses to the display string");
  assert.equal(display.issueTitle, "the breaker's work", "title carries over");
}

// ── cachedOverlayEntries: attribution + live exclusion ─────────────────────
pin("s-modern", { namespace: "re-goatmower-agents" });
pin("s-legacy"); // pinned before the namespace field existed
pin("s-live"); // pinned, but its pod still lives in the WS list
{
  const entries = cachedOverlayEntries(new Set(["s-live"]), "fenrir-agents");
  assert.equal(
    entries.length,
    2,
    "live pinned session excluded (already rendered); orphan cache entry skipped",
  );
  const nsById = Object.fromEntries(entries.map((e) => [e.job.sessionId, e.ns]));
  assert.equal(nsById["s-modern"], "re-goatmower-agents", "the recorded realm wins");
  assert.equal(nsById["s-legacy"], "fenrir-agents", "legacy pin follows the active namespace");
  for (const e of entries) {
    assert.equal(e.job.status, "cached", "every overlay entry is a cached job");
    assert.equal(e.job.name, `agent-${e.job.sessionId}`, "meta name carried onto the job");
  }
  // Empty cache (fresh localStorage) → empty overlay.
  localStorage.clear();
  assert.equal(
    cachedOverlayEntries(new Set(), "fenrir-agents").length,
    0,
    "empty pin cache overlays nothing",
  );
}

// ── mergeCachedIntoSummaries ────────────────────────────────────────────────
function baseCounts() {
  return { pending: 0, running: 0, succeeded: 0, failed: 0, purged: 0, cached: 0 };
}
{
  // Re-seed: s-legacy (no realm) + s-dup (realm fenrir, but already live there).
  pin("s-legacy");
  pin("s-dup", { namespace: "fenrir-agents" });
  const summaries = {
    "fenrir-agents": {
      total: 1,
      counts: { ...baseCounts(), running: 1 },
      jobs: [{ sessionId: "s-dup", status: "running" }],
      error: null,
    },
    "broken-agents": {
      total: 0,
      counts: baseCounts(),
      jobs: [],
      error: "HTTP 503",
    },
  };
  const entries = cachedOverlayEntries(new Set(), "fenrir-agents");
  const merged = mergeCachedIntoSummaries(summaries, entries);

  const fenrir = merged["fenrir-agents"];
  assert.equal(fenrir.total, 2, "legacy pin lands on the active realm (1 live + 1 cached)");
  assert.equal(fenrir.counts.cached, 1, "cached count increments");
  assert.equal(fenrir.counts.running, 1, "live counts untouched");
  assert.equal(fenrir.jobs.length, 2, "the cached job joins the realm's job list");
  assert.equal(fenrir.jobs[1].sessionId, "s-legacy", "the pinned session hangs after the live one");
  assert.ok(
    !fenrir.jobs.some((j) => j.sessionId === "s-dup" && j.status === "cached"),
    "a pinned-but-live session is never duplicated",
  );
  assert.equal(
    merged["broken-agents"],
    summaries["broken-agents"],
    "an errored realm keeps its summary-unavailable state untouched",
  );
  assert.equal(
    merged["re-goatmower-agents"],
    undefined,
    "a realm with no healthy summary stays absent — no phantom realms",
  );
  assert.notEqual(merged, summaries, "the merge is pure — input summaries never mutated");
  assert.equal(
    summaries["fenrir-agents"].total,
    1,
    "input summaries object not mutated by the merge",
  );
}
{
  const summaries = { "fenrir-agents": { total: 0, counts: baseCounts(), jobs: [], error: null } };
  assert.equal(
    mergeCachedIntoSummaries(summaries, []),
    summaries,
    "an empty overlay returns the input summaries by identity",
  );
}

console.log(
  "cached-tree PASS — pin metadata becomes a wire Job, overlay attribution honors the recorded realm " +
    "(legacy pins follow the active namespace), the merge lands counts + jobs on the realm without " +
    "duplicating live sessions or touching errored realms",
);
