// Opacity assertion tests for interactive tree components (issue #40).
//
// Principle: transparency must never be applied to an active/interactive
// component. This test locks that the two previously-transparent surfaces
// have opaque (≥96% alpha) backgrounds in BOTH the source CSS and the
// bundled desktop/plugin.js so the fix doesn't regress silently.
//
//   1. .jcard background gradient — all rgba stops ≥ 0.96 alpha
//   2. --glabel-bg variable — rgba alpha ≥ 0.96
//   3. Both rules verified in src/ui/styles/index.css AND desktop/plugin.js
//
// Run: npm test   (node --import ./test/register.mjs test/opacity.mjs)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS_PATH = new URL("../src/ui/styles/index.css", import.meta.url);
const PLUGIN_PATH = new URL("../desktop/plugin.js", import.meta.url);

const css = readFileSync(CSS_PATH, "utf8");
const plugin = readFileSync(PLUGIN_PATH, "utf8");

// Extract all rgba(r, g, b, a) alpha values from a gradient string.
function gradientAlphas(str) {
  const alphas = [];
  for (const m of str.matchAll(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/g)) {
    alphas.push(parseFloat(m[1]));
  }
  return alphas;
}

// Extract --glabel-bg value from a CSS/JS string.
function glabelBgAlpha(str) {
  const m = str.match(/--glabel-bg\s*:\s*rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/);
  if (!m) return null;
  return parseFloat(m[1]);
}

// Extract .jcard background gradient from a CSS/JS string (the first one found).
function jcardGradient(str) {
  // Find the .jcard block (preceded by either `.jcard` or `.odins-throne-root .jcard`)
  const m = str.match(/\.jcard\s*\{[^}]*background\s*:\s*(linear-gradient\([^;]+\))/);
  if (!m) return null;
  return m[1];
}

const MIN_ALPHA = 0.96;

// ── 1. src/ui/styles/index.css ──────────────────────────────────────────────

const cssGradient = jcardGradient(css);
assert.ok(cssGradient, "src/ui/styles/index.css: .jcard has a background gradient");

const cssAlphas = gradientAlphas(cssGradient);
assert.ok(cssAlphas.length > 0, "src/ui/styles/index.css: .jcard gradient has rgba stops");
for (const a of cssAlphas) {
  assert.ok(
    a >= MIN_ALPHA,
    `src/ui/styles/index.css: .jcard gradient stop alpha ${a} must be ≥ ${MIN_ALPHA} (interactive components must be opaque)`,
  );
}

const cssGlabelAlpha = glabelBgAlpha(css);
assert.ok(cssGlabelAlpha !== null, "src/ui/styles/index.css: --glabel-bg is defined as rgba");
assert.ok(
  cssGlabelAlpha >= MIN_ALPHA,
  `src/ui/styles/index.css: --glabel-bg alpha ${cssGlabelAlpha} must be ≥ ${MIN_ALPHA} (hover labels must be opaque)`,
);

// ── 2. desktop/plugin.js (the bundled desktop mirror) ───────────────────────

const pluginGradient = jcardGradient(plugin);
assert.ok(pluginGradient, "desktop/plugin.js: .jcard has a background gradient");

const pluginAlphas = gradientAlphas(pluginGradient);
assert.ok(pluginAlphas.length > 0, "desktop/plugin.js: .jcard gradient has rgba stops");
for (const a of pluginAlphas) {
  assert.ok(
    a >= MIN_ALPHA,
    `desktop/plugin.js: .jcard gradient stop alpha ${a} must be ≥ ${MIN_ALPHA} (interactive components must be opaque)`,
  );
}

const pluginGlabelAlpha = glabelBgAlpha(plugin);
assert.ok(pluginGlabelAlpha !== null, "desktop/plugin.js: --glabel-bg is defined as rgba");
assert.ok(
  pluginGlabelAlpha >= MIN_ALPHA,
  `desktop/plugin.js: --glabel-bg alpha ${pluginGlabelAlpha} must be ≥ ${MIN_ALPHA} (hover labels must be opaque)`,
);

console.log("opacity: .jcard gradient and --glabel-bg are opaque (≥96% alpha) in both CSS source and desktop bundle — issue #40 non-regression guard");
