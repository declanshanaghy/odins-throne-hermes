// Copy-to-clipboard button on decree blocks — issue #107 non-regression guard.
//
// Locks the contract for:
//   1. DecreeBlock.tsx: CopyDecreeButton component present, uses navigator.clipboard
//   2. CSS: .decree-card-copy-btn class with hover + copied state rules
//   3. CSS: .decree-card-actions layout class present
//   4. CSS: .decree-card-format-badge class present (moved from inline to class)
//   5. DecreeBlock.tsx: aria-label "Copy decree text" on the button
//   6. After build: desktop/plugin.js mirrors all CSS classes and clipboard usage
//
// Run: npm test   (node --import ./test/register.mjs test/decree-copy.mjs)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const css = read("src/ui/styles/index.css");
const src = read("src/ui/components/DecreeBlock.tsx");
const plugin = read("desktop/plugin.js");

// ── 1. DecreeBlock.tsx: CopyDecreeButton uses clipboard API ─────────────────
{
  assert.ok(
    /CopyDecreeButton/.test(src),
    "DecreeBlock.tsx: CopyDecreeButton component defined",
  );
  assert.ok(
    /navigator\.clipboard\.writeText/.test(src),
    "DecreeBlock.tsx: uses navigator.clipboard.writeText to copy raw decree text",
  );
  assert.ok(
    /aria-label.*Copy decree text/.test(src),
    "DecreeBlock.tsx: copy button has aria-label 'Copy decree text'",
  );
  assert.ok(
    /decree-card-copy-btn/.test(src),
    "DecreeBlock.tsx: button uses .decree-card-copy-btn class",
  );
}

// ── 2. CSS: .decree-card-copy-btn class with interaction states ──────────────
{
  assert.ok(
    /\.decree-card-copy-btn\s*\{/.test(css),
    "index.css: .decree-card-copy-btn class defined",
  );
  assert.ok(
    /\.decree-card-copy-btn:hover/.test(css),
    "index.css: .decree-card-copy-btn:hover state defined",
  );
  assert.ok(
    /\.decree-card-copy-btn\.copied/.test(css),
    "index.css: .decree-card-copy-btn.copied state defined",
  );
}

// ── 3. CSS: .decree-card-actions layout class ────────────────────────────────
{
  assert.ok(
    /\.decree-card-actions\s*\{/.test(css),
    "index.css: .decree-card-actions layout class defined",
  );
}

// ── 4. CSS: .decree-card-format-badge class (badge moved out of inline style) ─
{
  assert.ok(
    /\.decree-card-format-badge\s*\{/.test(css),
    "index.css: .decree-card-format-badge class defined",
  );
}

// ── 5. Bundle mirrors clipboard usage and CSS classes ────────────────────────
{
  assert.ok(
    /navigator\.clipboard\.writeText/.test(plugin),
    "desktop/plugin.js: clipboard writeText present in bundle",
  );
  assert.ok(
    /decree-card-copy-btn/.test(plugin),
    "desktop/plugin.js: .decree-card-copy-btn class present in bundle",
  );
  assert.ok(
    /decree-card-actions/.test(plugin),
    "desktop/plugin.js: .decree-card-actions class present in bundle",
  );
  assert.ok(
    /decree-card-format-badge/.test(plugin),
    "desktop/plugin.js: .decree-card-format-badge class present in bundle",
  );
}

// ── 6. CopyDecreeButton receives the raw `text` prop ─────────────────────────
{
  // The button component is rendered with text={text} where text is the raw
  // decree string passed into DecreeBlock. Guard that the prop wiring exists.
  assert.ok(
    /CopyDecreeButton\s+text=\{text\}/.test(src),
    "DecreeBlock.tsx: CopyDecreeButton is passed the raw text prop",
  );
}

console.log("decree-copy: copy-to-clipboard button on decree blocks verified (issue #107)");
