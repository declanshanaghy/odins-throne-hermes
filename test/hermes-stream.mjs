// Hermes-harness log parsing test — drives the REAL useLogStream hook (from the
// BUILT desktop/plugin.js, same bytes the desktop app loads) with a synthetic
// Hermes pretty-format session and asserts the structured entries the Norse
// log terminal renders: agent bubbles, tool batches, plan tracking, warnings,
// the decree verdict, and the suppression of the duplicated `Query:` prompt
// echo. Regression guard for "hermes vs claude" harness divergence.
//
// Run: npm test   (requires `npm run build` first — verify runs build first)

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

// ── jsdom global environment ────────────────────────────────────────────────
const dom = new JSDOM("<!doctype html><html><head></head><body><div id='probe'></div></body></html>", {
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
class FakeWebSocket {
  constructor() { this.readyState = 0; }
  addEventListener() {}
  removeEventListener() {}
  send() {}
  close() {}
}
globalThis.WebSocket = FakeWebSocket;
dom.window.WebSocket = FakeWebSocket;
// RAF buffering (issue:106) requires requestAnimationFrame in the global scope.
// jsdom provides it on dom.window (pretendToBeVisual: true); bridge it to globalThis.
globalThis.requestAnimationFrame = (cb) => dom.window.requestAnimationFrame(cb);

// ── load the built bundle ──────────────────────────────────────────────────
const { useLogStream, parseDecree } = await import("../desktop/plugin.js");

// ── probe component capturing the hook ──────────────────────────────────────
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
assert.ok(handle, "useLogStream hook captured from the rendered probe");
handle.clearEntries();

// ── synthetic Hermes pretty-format session (distilled from a real one) ────
const DIV = "────────────────────────────────────────";
const SESSION_LINES = [
  "=== Agent Sandbox Entrypoint ===",
  "Session: issue-9-step1-firemandecko-4b1c0445",
  "Branch: fix/issue-9-odins-throne-hermes-project",
  "Model: anthropic/claude-sonnet-4.6",
  "[ok] DNS ready (attempt 1)",
  "=== Starting Hermes Agent ===",
  "Model: anthropic/claude-sonnet-4.6 (provider: openrouter)",
  "Session: issue-9-step1-firemandecko-4b1c0445",
  "--- TASK PROMPT ---",
  "You are FiremanDecko, the Principal Engineer. Fix GitHub Issue #9.",
  "--- END PROMPT ---",
  "[hermes] WARNING: this process is PID 1 with no init above it.",
  "Query: You are FiremanDecko, the Principal Engineer. Fix GitHub Issue #9.",
  "ECHO LINE THAT MUST NEVER RENDER",
  DIV,
  "☤ Hermes",
  "I'll start by verifying the environment and checking for prior work.",
  DIV,
  "",
  "💻 $ git branch --show-current + 1 command  1.1s",
  "✗ $ npm test  2.0s [exit 1]",
  "📖 Read web/content/projects/gwent.html",
  "🔎 Searching tools · todo list create track  0.1s",
  "📖 Reading tool details · 1 tool",
  "📋 Plan 1/10 task(s)",
  "✍️ Write /workspace/repo/web/content/projects/x.html",
  "│ web/content/projects/x.html",
  "│ @@ -0,0 +1,2 @@",
  "│ +<div>hello</div>",
  "🔧 Patch /workspace/repo/web/content/projects.html",
  "│ @@ -150,7 +150,7 @@",
  "│ -    ×6",
  "│ +    ×7",
  "",
  "📋 Plan update 5/10 ✓",
  DIV,
  "☤ Hermes",
  "᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭ISSUE: #9VERDICT: DONEPR: https://github.com/declanshanaghy/shanaghy.com/pull/11SUMMARY:- Added the project page\n- Updated the indexCHECKS:- tsc: PASS\n- build: PASSSEAL: FiremanDecko · ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᛟ · Principal EngineerSIGNOFF: Forged in fire, tempered by craft᛭᛭᛭ END DECREE ᛭᛭᛭",
  DIV,
  "",
  "Resume this session with:",
  "hermes --resume local-abc123",
  "Session:        local-abc123",
  "Title:          Add odins-throne-hermes plugin to projects",
  "Duration:       4m 36s",
  "Messages:       78 (1 user, 76 tool calls)",
];

for (const line of SESSION_LINES) {
  handle.handleMessage({ type: "log-line", ts: 0, sessionId: "s-hermes", line });
}
await flush();
await flush();

const entries = handle.entries;
const byType = (t) => entries.filter((e) => e.type === t);

// ── entrypoint + task prompt ────────────────────────────────────────────────
const group = byType("entrypoint-group")[0];
assert.ok(group, "entrypoint setup collapsed into a group");
assert.equal(group.text, "Agent Sandbox Setup");
assert.ok(group.children.some((c) => c.type === "entrypoint-ok"), "[ok] step captured");
assert.ok(group.children.some((c) => c.type === "entrypoint-info" && c.detail === "Branch"), "Branch KV captured");
const header = entries.find((e) => e.type === "entrypoint-header" && e.text === "Starting Hermes Agent");
assert.ok(header, "Hermes harness header emitted (StartupBlock groups it)");
const rawStartup = byType("raw").filter((e) => /^Model: /.test(e.text ?? ""));
assert.equal(rawStartup.length, 1, "startup Model: KV stays raw for StartupBlock grouping");
const task = byType("entrypoint-task")[0];
assert.ok(task && task.text?.includes("FiremanDecko"), "task prompt rendered as the decree tablet");

// ── query-echo suppression ───────────────────────────────────────────────────
assert.ok(
  !entries.some((e) => JSON.stringify(e).includes("ECHO LINE THAT MUST NEVER RENDER")),
  "Query: echo is suppressed, not rendered",
);

// ── warning ─────────────────────────────────────────────────────────────────
assert.equal(byType("warning").length, 1, "[hermes] WARNING mapped to a warning entry");
assert.ok(byType("warning")[0].message.includes("PID 1"));

// ── assistant turns ──────────────────────────────────────────────────────────
const bubbles = byType("assistant-text");
assert.equal(bubbles.length, 2, "two ☤ Hermes turns rendered as agent bubbles");
assert.ok(bubbles[0].text.includes("verifying the environment"));

// ── tool batch ───────────────────────────────────────────────────────────────
const batches = byType("tool-batch");
assert.equal(batches.length, 1, "all tool calls batched into one accordion");
const tools = batches[0].children;
assert.deepEqual(
  tools.map((t) => t.toolName),
  ["terminal", "terminal", "read_file", "tool_search", "tool_search", "plan", "write_file", "patch", "plan"],
  "Hermes tool lines mapped to tool entries",
);
const failed = tools[1];
assert.ok(failed.toolIsError, "✗ terminal call flagged as error");
assert.equal(failed.toolResult, "exit 1", "exit code captured");
const okCmd = JSON.parse(tools[0].toolInput).command;
assert.equal(okCmd, "git branch --show-current + 1 command", "duration suffix stripped from command");
const readTool = JSON.parse(tools[2].toolInput);
assert.equal(readTool.file_path, "web/content/projects/gwent.html", "read_file path captured");
const search = JSON.parse(tools[3].toolInput);
assert.equal(search.pattern, "todo list create track", "tool_search query captured");
const write = tools[6];
assert.ok(write.toolResult?.includes("+<div>hello</div>"), "│ diff lines attached to write_file");
const patch = tools[7];
assert.ok(patch.toolResult?.includes("×7") && patch.toolResult?.includes("-    ×6"), "│ diff lines attached to patch");
assert.ok(batches[0].complete, "batch completed when the next assistant turn arrived");

// ── decree + verdict ─────────────────────────────────────────────────────────
const decreeText = bubbles[1].text ?? "";
assert.ok(decreeText.includes("DECREE COMPLETE"), "decree flows as assistant text (renders as DecreeBlock)");
const verdicts = byType("verdict");
assert.equal(verdicts.length, 1, "decree produced a verdict entry");
assert.equal(verdicts[0].verdictResult, "PASS", "VERDICT: DONE maps to PASS");

const parsed = parseDecree(decreeText);
assert.equal(parsed.format, "canonical", "glued (newline-eaten) decree parses canonically");
assert.equal(parsed.issue, "#9");
assert.equal(parsed.verdict, "DONE");
assert.equal(parsed.pr, "https://github.com/declanshanaghy/shanaghy.com/pull/11");
assert.equal(parsed.summary.length, 2, "SUMMARY bullets recovered from the glued decree");
assert.equal(parsed.checks.length, 2, "CHECKS bullets recovered from the glued decree");
assert.equal(parsed.checks[0].name, "tsc");
assert.equal(parsed.checks[0].value, "PASS");
assert.equal(parsed.agentKey, "firemandecko", "agent derived from SEAL");

// a well-formed multi-line decree must parse identically (no double-mangling)
const wellFormed = [
  "᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭",
  "ISSUE: #9",
  "VERDICT: DONE",
  "PR: N/A",
  "SUMMARY:",
  "- one thing",
  "CHECKS:",
  "- tsc: PASS",
  "SEAL: Loki · ᛚᛟᚲᛁ · QA Tester",
  "SIGNOFF: Forged in fire, tempered by craft",
  "᛭᛭᛭ END DECREE ᛭᛭᛭",
].join("\n");
const wf = parseDecree(wellFormed);
assert.equal(wf.format, "canonical");
assert.equal(wf.issue, "#9");
assert.equal(wf.verdict, "DONE");
assert.equal(wf.pr, null, "PR: N/A → null");
assert.equal(wf.summary.length, 1);
assert.equal(wf.agentKey, "loki");

// ── session footer ──────────────────────────────────────────────────────────
const infos = byType("entrypoint-info");
assert.deepEqual(
  infos.map((i) => i.detail),
  ["Session", "Title", "Duration", "Messages"],
  "trailing session summary rendered as info rows",
);

console.log("HERMES STREAM PASS — Hermes pretty-format sessions parse into structured entries");

// ── live harness format (issue:126) ──────────────────────────────────────────
// The live hermes/glm-5.3 harness prints most assistant turns WITHOUT the ☤
// Hermes marker (divider-delimited prose), plus ∴ Thought / 🔎 Grep / ⚙️ Proc
// wait glyphs the old parser dropped to raw. Fixture verbatim-shape from job
// agent-issue-78-step1-firemandecko-6ac25402. Zero fixture lines may land raw.
handle.clearEntries();
await flush();

const LIVE_LINES = [
  // Query echo activates the parser (suppressed until the first divider), as in a live session
  "Query: You are FiremanDecko, the Principal Engineer. Fix GitHub Issue #126.",
  DIV,
  "∴ Thought for 3s",
  DIV,
  "",
  "💻 $ git branch --show-current + 3 commands  0.9s",
  "🔎 Grep relaunch_search|delete_search  0.4s",
  "📖 Read api.rs L440-759",
  "⚙️ Proc wait proc_46kgk  1.2s",
  DIV,
  "Now I understand the structure. `delete_search` does:",
  "1. Get search",
  "2. If not terminal: kill Job (best-effort)",
  "```rust",
  "fn delete_search(&self, id: Uuid) -> Result<()> {",
  "```",
  DIV,
  "∴ Thought for 1s",
  DIV,
  "☤ Hermes",
  "Branch is fresh. Reading the affected code now.",
  DIV,
];
for (const line of LIVE_LINES) {
  handle.handleMessage({ type: "log-line", ts: 0, sessionId: "s-hermes-live", line });
}
await flush();
await flush();

const liveEntries = handle.entries;
assert.equal(
  liveEntries.filter((e) => e.type === "raw").length,
  0,
  "live-format fixture: zero lines land as raw dim text",
);

// ∴ Thought for Ns → dim thinking-style marker, never raw
const thoughts = liveEntries.filter((e) => e.type === "assistant-text" && e.detail === "thinking");
assert.deepEqual(
  thoughts.map((t) => t.text),
  ["Thought for 3s", "Thought for 1s"],
  "∴ Thought markers render as dim thinking entries",
);

// ☤-less prose between dividers → rich agent bubbles
const liveBubbles = liveEntries.filter((e) => e.type === "assistant-text" && e.detail !== "thinking");
assert.equal(liveBubbles.length, 2, "☤-less prose turn + ☤ turn both render as agent bubbles");
assert.ok(
  liveBubbles[0].text.includes("Now I understand the structure") && liveBubbles[0].text.includes("```rust"),
  "prose turn keeps markdown body incl. code fence",
);
assert.ok(liveBubbles[1].text.includes("Branch is fresh"), "☤-headed turn still captured");

// 🔎 Grep / ⚙️ Proc wait → tool-batch children
const liveTools = liveEntries.filter((e) => e.type === "tool-batch").flatMap((b) => b.children ?? []);
assert.deepEqual(
  liveTools.map((t) => t.toolName),
  ["terminal", "grep", "read_file", "proc"],
  "live glyphs map to tool entries in the batch",
);
const grepInput = JSON.parse(liveTools[1].toolInput);
assert.equal(grepInput.pattern, "relaunch_search|delete_search", "🔎 Grep pattern captured, duration stripped");
const procInput = JSON.parse(liveTools[3].toolInput);
assert.deepEqual(procInput, { op: "wait", id: "proc_46kgk" }, "⚙️ Proc wait op+id captured, duration stripped");
assert.equal(
  JSON.parse(liveTools[0].toolInput).command,
  "git branch --show-current + 3 commands",
  "live terminal command captured",
);
assert.equal(JSON.parse(liveTools[2].toolInput).file_path, "api.rs L440-759", "live read_file captured");

// unknown future glyphs degrade to raw — no worse than before
handle.handleMessage({ type: "log-line", ts: 0, sessionId: "s-hermes-live", line: "🧿 some future harness glyph" });
await flush();
await flush();
assert.equal(
  handle.entries.filter((e) => e.type === "raw").length,
  1,
  "unknown glyph line degrades to exactly one raw entry",
);

console.log("HERMES STREAM LIVE FORMAT PASS — ☤-less prose, ∴ Thought, 🔎 Grep, ⚙️ Proc wait all structured");
