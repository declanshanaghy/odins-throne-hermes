// Markdown message-rendering test — drives the REAL parser and component (from
// the BUILT desktop/plugin.js, same bytes the desktop app loads) with
// representative agent-message markdown and asserts both the parsed block
// tokens and the rendered DOM. Regression guard for the "wall of text" symptom:
// agent bubbles must render rich markdown, and agent text must never inject
// HTML.
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
if (globalThis.navigator) {
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
} else {
  globalThis.navigator = dom.window.navigator;
}

// ── load the built bundle ──────────────────────────────────────────────────
const { parseMarkdown, Markdown } = await import("../desktop/plugin.js");
assert.equal(typeof parseMarkdown, "function", "parseMarkdown exported from the built bundle");
assert.equal(typeof Markdown, "function", "Markdown component exported from the built bundle");

// ── parse-level assertions ───────────────────────────────────────────────────

// headings
{
  const blocks = parseMarkdown("# Title\n\n## Section\n### Sub *section*");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].t, "heading");
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[1].level, 2);
  assert.equal(blocks[2].level, 3);
  assert.equal(blocks[2].c[0].t, "text");
  assert.equal(blocks[2].c[0].v, "Sub ");
  assert.equal(blocks[2].c[1].t, "em");
}

// inline: bold / em / code / del / link / autolink / hard-break
{
  const blocks = parseMarkdown("**bold** and *em* and `x = 1` and ~~gone~~\nline two with [docs](https://example.com/a) and https://example.com/b");
  assert.equal(blocks.length, 1);
  const c = blocks[0].c;
  assert.equal(c[0].t, "strong");
  assert.equal(c[1].v, " and ");
  assert.equal(c[2].t, "em");
  assert.equal(c[4].t, "code");
  assert.equal(c[4].v, "x = 1");
  assert.equal(c[6].t, "del");
  // single newline inside a paragraph is a hard break
  assert.equal(c[7].t, "br");
  const link = c.find((n) => n.t === "link" && n.href === "https://example.com/a");
  assert.ok(link, "markdown link parsed");
  assert.equal(link.c[0].v, "docs");
  const auto = c.find((n) => n.t === "link" && n.href === "https://example.com/b");
  assert.ok(auto, "bare URL autolinked");
}

// snake_case stays literal (no italic), escaped asterisk stays literal
{
  const blocks = parseMarkdown("use snake_case_name here and 2 \\* 3 \\* 4");
  const texts = blocks[0].c.filter((n) => n.t === "text").map((n) => n.v).join("");
  assert.ok(!blocks[0].c.some((n) => n.t === "em"), "no italic from snake_case or escaped asterisks");
  assert.match(texts, /snake_case_name/);
  assert.match(texts, /2 \* 3 \* 4/);
}

// fenced code, language preserved, markdown inside is inert
{
  const blocks = parseMarkdown("before\n\n```ts\nconst x = '**not bold**';\n```\n\nafter");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].t, "code");
  assert.equal(blocks[1].lang, "ts");
  assert.equal(blocks[1].v, "const x = '**not bold**';");
}

// lists: bullets, nesting, ordered switch ends the list
{
  const blocks = parseMarkdown("- one\n- two\n  1. nested-a\n  2. nested-b\n- three");
  assert.equal(blocks.length, 1);
  const list = blocks[0];
  assert.equal(list.t, "list");
  assert.equal(list.ordered, false);
  assert.equal(list.items.length, 3);
  assert.equal(list.items[1].children.length, 1);
  const nested = list.items[1].children[0];
  assert.equal(nested.t, "list");
  assert.equal(nested.ordered, true);
  assert.equal(nested.items.length, 2);
  assert.equal(nested.items[1].c[0].v, "nested-b");
}

// tables with alignment
{
  const blocks = parseMarkdown("| Realm | Tasks |\n|:------|------:|\n| fenrir | 12 |\n| odin | 3 |");
  assert.equal(blocks.length, 1);
  const table = blocks[0];
  assert.equal(table.t, "table");
  assert.equal(table.header[0][0].v, "Realm");
  assert.deepEqual(table.align, ["left", "right"]);
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0][1][0].v, "12");
}

// blockquote + hr
{
  const blocks = parseMarkdown("> quoted line\n> more of it\n\n---\n\nplain");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].t, "quote");
  assert.equal(blocks[0].blocks[0].t, "paragraph");
  assert.equal(blocks[0].blocks[0].c[0].v, "quoted line");
  assert.ok(blocks[0].blocks[0].c.some((n) => n.t === "br"), "quote keeps internal line break");
  assert.equal(blocks[1].t, "hr");
  assert.equal(blocks[2].t, "paragraph");
}

// plain prose: single paragraph, no markup mangled
{
  const blocks = parseMarkdown("The build passed and the vine holds.");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].t, "paragraph");
  assert.equal(blocks[0].c[0].v, "The build passed and the vine holds.");
}

// ── render-level assertions (component DOM) ─────────────────────────────────

const SAMPLE = [
  "## Report",
  "",
  "**fenrir** ledger has `3` open tasks — see [the board](https://example.com/board).",
  "",
  "- check gates",
  "  1. tsc",
  "  2. build",
  "- merge",
  "",
  "```bash",
  "npm run verify",
  "```",
  "",
  "| realm | tasks |",
  "|:------|------:|",
  "| fenrir | 3 |",
  "",
  "> decree held.",
].join("\n");

const root = createRoot(document.getElementById("probe"));
root.render(React.createElement(Markdown, { text: SAMPLE }));
await new Promise((r) => setTimeout(r, 60));
await new Promise((r) => setTimeout(r, 60));

const probe = document.getElementById("probe");
assert.ok(probe.querySelector(".agent-md"), "root .agent-md div rendered");
assert.ok(probe.querySelector(".agent-md-heading.agent-md-h2"), "heading rendered with level class");
assert.equal(probe.querySelectorAll(".agent-md > .agent-md-p").length, 1, "prose paragraph rendered");
assert.ok(probe.querySelector(".agent-md-p strong"), "bold rendered");
assert.ok(probe.querySelector(".agent-md-p .agent-md-code"), "inline code rendered");
const link = probe.querySelector("a.agent-md-link");
assert.ok(link, "link rendered");
assert.equal(link.getAttribute("href"), "https://example.com/board");
assert.equal(link.getAttribute("rel"), "noopener noreferrer");

const ul = probe.querySelector("ul.agent-md-list");
assert.ok(ul, "bullet list rendered");
assert.equal(ul.querySelectorAll(":scope > li").length, 2, "two top-level bullets");
const ol = ul.querySelector("ol.agent-md-list--ordered");
assert.ok(ol, "nested ordered list rendered inside a bullet");
assert.equal(ol.querySelectorAll(":scope > li").length, 2, "two nested ordered items");

const pre = probe.querySelector("pre.agent-md-pre");
assert.ok(pre, "fenced code rendered");
assert.equal(pre.querySelector("code").textContent, "npm run verify");

const table = probe.querySelector("table.agent-md-table");
assert.ok(table, "table rendered");
assert.equal(table.querySelectorAll("th").length, 2, "table header cells");
assert.equal(table.querySelectorAll("tbody tr").length, 1, "table body rows");
assert.equal(table.querySelectorAll("th")[1].style.textAlign, "right", "right-align column honored");

assert.ok(probe.querySelector("blockquote.agent-md-quote"), "blockquote rendered");

// ── HTML injection is impossible: markup-ish agent text renders as text ────

root.render(React.createElement(Markdown, { text: "<script>alert('fenrir')</script> <img src=x onerror=boom> **bold**" }));
await new Promise((r) => setTimeout(r, 60));
await new Promise((r) => setTimeout(r, 60));
assert.equal(probe.querySelectorAll("script").length, 0, "no <script> element ever created");
assert.equal(probe.querySelectorAll("img").length, 0, "no <img> element ever created");
assert.ok(probe.textContent.includes("<script>alert('fenrir')</script>"), "markup text rendered literally");
assert.ok(probe.querySelector(".agent-md-p strong"), "real markdown still works alongside markup text");

root.unmount();

console.log("PASS test/markdown.mjs — message markdown parses + renders rich (no injection)");
