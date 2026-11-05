// matchesQuery helper tests (issue #117).
//
// Run: npm test   (node --import ./test/register.mjs test/session-filter.mjs)

import assert from "node:assert/strict";

const { matchesQuery } = await import("../src/ui/lib/matchesQuery.ts");

function job(overrides = {}) {
  return {
    sessionId: "issue-117-step1-firemandecko-ab12cd34",
    name: "firemandecko-ab12cd34",
    issue: "117",
    step: "1",
    agentKey: "firemandecko",
    agentName: "FiremanDecko",
    status: "running",
    startTime: null,
    completionTime: null,
    issueTitle: "Hlidskjalf session filter",
    branchName: "fix/issue-117-session-filter",
    fixture: false,
    ...overrides,
  };
}

// empty query always matches
assert.ok(matchesQuery(job(), ""), "empty string matches");
assert.ok(matchesQuery(job(), "   "), "whitespace-only matches");

// issue number: "117"
assert.ok(matchesQuery(job(), "117"), "matches issue number");
assert.ok(matchesQuery(job(), "#117"), "matches #issue number");
assert.ok(!matchesQuery(job(), "999"), "does not match wrong issue number");

// issueTitle
assert.ok(matchesQuery(job(), "session filter"), "matches issueTitle substring");
assert.ok(matchesQuery(job(), "HLIDSKJALF"), "case-insensitive issueTitle");
assert.ok(matchesQuery(job({ issueTitle: null }), "117"), "null issueTitle skipped, falls through to issue #");

// agentName
assert.ok(matchesQuery(job(), "FiremanDecko"), "matches agentName");
assert.ok(matchesQuery(job(), "firemandecko"), "case-insensitive agentName");
assert.ok(!matchesQuery(job(), "luna"), "does not match wrong agentName");

// branchName
assert.ok(matchesQuery(job(), "issue-117"), "matches branchName substring");
assert.ok(matchesQuery(job(), "session-filter"), "matches branchName slug");
assert.ok(matchesQuery(job({ branchName: null }), "117"), "null branchName skipped, falls through to issue #");

// sessionId
assert.ok(matchesQuery(job(), "ab12cd34"), "matches sessionId suffix");
assert.ok(matchesQuery(job(), "issue-117-step1"), "matches sessionId prefix");
assert.ok(!matchesQuery(job(), "zzzzzzz"), "does not match absent token");

// no false positives across all fields
assert.ok(!matchesQuery(job(), "xyz999"), "no false positive");

console.log("session-filter: all tests pass");
