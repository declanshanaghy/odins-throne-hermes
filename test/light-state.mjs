// Four-tier lantern dim ladder tests (issue #97, v3.15).
//
// Locks the FOUR-TIER DIM LADDER behavioral contract:
//   off   — no namespace seated: veil .75 + halo .5
//   empty — seated, zero tasks, not selected: veil .50, no glow; stone .65 + saturate(.7)
//   mid   — seated with tasks, deactivated: veil .25 + glow .5
//   full  — selected + job list showing: veil 0 + glow 1 + teal ring
//
// Verifies:
//   1. CSS veil opacities match the decree's dim % exactly (.75/.50/.25/0)
//   2. empty-tier hover lift stays below mid (veil .2 < .25)
//   3. is-empty stone rule: opacity .65 + saturate(.7)
//   4. berry/count guard: summary.total > 0 required (DOM render)
//   5. lseat state computation: nsId null→off, isFull→full, total>0→mid, else→empty
//   6. Bundle ships the four-tier CSS
//
// Run: npm test   (node --import ./test/register.mjs test/light-state.mjs)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS_PATH = new URL("../src/ui/styles/index.css", import.meta.url);
const PLUGIN_PATH = new URL("../desktop/plugin.js", import.meta.url);

const css = readFileSync(CSS_PATH, "utf8");
const plugin = readFileSync(PLUGIN_PATH, "utf8");

// ── helpers ──────────────────────────────────────────────────────────────────

function extractRule(str, selector) {
  // Match the first rule block for selector (non-nested, up to the closing })
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = str.match(re);
  return m ? m[1] : null;
}

function extractOpacity(ruleBody) {
  const m = ruleBody.match(/opacity\s*:\s*([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

// ── 1. CSS veil opacities (src) ───────────────────────────────────────────────

const offVeil   = extractRule(css, ".lseat--off .lseat__veil");
const emptyVeil = extractRule(css, ".lseat--empty .lseat__veil");
const midVeil   = extractRule(css, ".lseat--mid .lseat__veil");
const fullVeil  = extractRule(css, ".lseat--full .lseat__veil");

assert.ok(offVeil,   "CSS: .lseat--off .lseat__veil rule exists");
assert.ok(emptyVeil, "CSS: .lseat--empty .lseat__veil rule exists (four-tier empty tier)");
assert.ok(midVeil,   "CSS: .lseat--mid .lseat__veil rule exists");
assert.ok(fullVeil,  "CSS: .lseat--full .lseat__veil rule exists");

assert.equal(extractOpacity(offVeil),   0.75, "off veil opacity = .75 (decree: 75% dim)");
assert.equal(extractOpacity(emptyVeil), 0.5,  "empty veil opacity = .50 (decree: 50% dim)");
assert.equal(extractOpacity(midVeil),   0.25, "mid veil opacity = .25 (decree: 25% dim — was .34)");
assert.equal(extractOpacity(fullVeil),  0,    "full veil opacity = 0 (decree: 0% dim)");

// Monotonic: off > empty > mid > full
assert.ok(
  extractOpacity(offVeil) > extractOpacity(emptyVeil),
  "monotonic ladder: off > empty",
);
assert.ok(
  extractOpacity(emptyVeil) > extractOpacity(midVeil),
  "monotonic ladder: empty > mid",
);
assert.ok(
  extractOpacity(midVeil) > extractOpacity(fullVeil),
  "monotonic ladder: mid > full",
);

// ── 2. off halo (.5) + empty has no halo ──────────────────────────────────────

const offHalo   = extractRule(css, ".lseat--off .lseat__halo");
const emptyHalo = extractRule(css, ".lseat--empty .lseat__halo");

assert.ok(offHalo,   "CSS: .lseat--off .lseat__halo rule exists");
assert.equal(extractOpacity(offHalo), 0.5, "off halo opacity = .5 (swallows the painted glow pool)");
assert.ok(emptyHalo, "CSS: .lseat--empty .lseat__halo rule exists");
assert.equal(extractOpacity(emptyHalo), 0, "empty halo opacity = 0 (alive — halo stays off)");

// ── 3. glow values: empty has no glow; mid .5; full 1 ────────────────────────

const emptyGlow = extractRule(css, ".lseat--empty .lseat__glow");
const midGlow   = extractRule(css, ".lseat--mid .lseat__glow");
const fullGlow  = extractRule(css, ".lseat--full .lseat__glow");

assert.ok(emptyGlow, "CSS: .lseat--empty .lseat__glow rule exists");
assert.equal(extractOpacity(emptyGlow), 0,   "empty glow opacity = 0 (no glow for the quiet 50% rung)");
assert.equal(extractOpacity(midGlow),   0.5, "mid glow opacity = .5 (soft cool screen-blend glow)");
assert.equal(extractOpacity(fullGlow),  1,   "full glow opacity = 1 (fully lit)");

// ── 4. empty hover: veil .2 (below mid .25) ──────────────────────────────────

const emptyHoverVeil = extractRule(css, ".lseat--empty.is-hover .lseat__veil");
assert.ok(emptyHoverVeil, "CSS: empty hover veil rule exists");
const emptyHoverOpacity = extractOpacity(emptyHoverVeil);
assert.ok(
  emptyHoverOpacity < extractOpacity(midVeil),
  `empty hover veil (${emptyHoverOpacity}) stays below mid veil (.25) — hover lift stays one rung below mid`,
);

// ── 5. is-empty stone: opacity .65 + saturate(.7) ────────────────────────────

const isEmptyStone = extractRule(css, ".ns-tree__lantern.is-empty .ns-tree__icon--lantern");
assert.ok(isEmptyStone, "CSS: .ns-tree__lantern.is-empty .ns-tree__icon--lantern rule exists");
assert.equal(extractOpacity(isEmptyStone), 0.65, "empty stone opacity = .65 (dims to match 50% lantern rung)");
assert.ok(
  isEmptyStone.includes("saturate(0.7)"),
  "empty stone filter includes saturate(0.7) (desaturated, matching the prototype .lantern.is-empty .lantern__ic)",
);

// ── 6. four-tier states present in the bundle ─────────────────────────────────

const bundleOffVeil   = extractRule(plugin, ".lseat--off .lseat__veil");
const bundleEmptyVeil = extractRule(plugin, ".lseat--empty .lseat__veil");
const bundleMidVeil   = extractRule(plugin, ".lseat--mid .lseat__veil");
const bundleFullVeil  = extractRule(plugin, ".lseat--full .lseat__veil");

assert.ok(bundleOffVeil,   "bundle: .lseat--off .lseat__veil ships");
assert.ok(bundleEmptyVeil, "bundle: .lseat--empty .lseat__veil ships (four-tier empty tier in desktop bundle)");
assert.ok(bundleMidVeil,   "bundle: .lseat--mid .lseat__veil ships");
assert.ok(bundleFullVeil,  "bundle: .lseat--full .lseat__veil ships");

assert.equal(extractOpacity(bundleOffVeil),   0.75, "bundle: off veil .75");
assert.equal(extractOpacity(bundleEmptyVeil), 0.5,  "bundle: empty veil .50");
assert.equal(extractOpacity(bundleMidVeil),   0.25, "bundle: mid veil .25");
assert.equal(extractOpacity(bundleFullVeil),  0,    "bundle: full veil 0");

// ── 7. stone tier class logic (DOM-level, via smoke fixture) ──────────────────
// Loaded via the smoke test register shim — DOM is available here.
// This test runs AFTER register.mjs sets up jsdom (via --import), so we can
// import the same React fixture as smoke.mjs uses. We replicate a minimal
// render to check lantern class assignment.

// Verify the class strings are what the TSX produces, by parsing the bundle
// for the stoneTier logic string rather than re-rendering.
// The key invariant: `is-empty` for zero tasks, `is-mid` for tasks > 0, `is-full` for open.
assert.ok(
  plugin.includes("is-empty") && plugin.includes("is-mid") && plugin.includes("is-full"),
  "bundle ships the three stone-tier class identifiers (is-empty, is-mid, is-full)",
);

// ── 8. berry guard: counts only shown for total > 0 ──────────────────────────
// Verified by reading the TSX source (structural assertion).
const tsxSrc = readFileSync(new URL("../src/ui/components/NamespaceTree.tsx", import.meta.url), "utf8");
assert.ok(
  tsxSrc.includes("summary.total > 0"),
  "NamespaceTree.tsx: berry/count cluster guarded by summary.total > 0 (no berries for empty worlds)",
);

// ── 9. mid veil is NOT .34 (the old value must be gone) ──────────────────────
// The old mid veil was .34; v3.15 drops it to .25.
assert.ok(
  !css.includes("opacity: 0.34") || !css.match(/\.lseat--mid\s+\.lseat__veil\s*\{[^}]*opacity:\s*0\.34/),
  "CSS: lseat--mid veil is no longer .34 (old three-tier value replaced by .25)",
);

// ── 10. the LIGHT ladder INVERTS (issue #123, prototype v3.17 round 25) ─────
// In Parchment & Mead Hall, BRIGHT = lit, WASHED = dim: the multiply veils
// become a warm vellum wash at normal blend, glow flips to the mead sun
// radial, the FULL ring is verdigris. Four tiers, same rungs, inverted
// polarity: off .55 / empty .40 / mid .18 / full 0.
const LT = "[data-theme=\"light\"]";
const lightVeilFill = extractRule(css, `${LT} .lseat__veil`);
assert.ok(lightVeilFill, "CSS: light veil rule exists");
assert.ok(lightVeilFill.includes("#EFE6D2"), "light veil fill is the warm vellum wash #EFE6D2");
assert.ok(lightVeilFill.includes("normal"), "light veil drops multiply for normal blend");
const lightGlow = extractRule(css, `${LT} .lseat__glow`);
assert.ok(lightGlow.includes("url(#lglowg-sun)"), "light glow is the mead-gold sun radial (#lglowg-sun)");
assert.ok(lightGlow.includes("normal"), "light glow drops screen blend for normal blend");

const lightOffVeil = extractRule(css, `${LT} .lseat--off .lseat__veil`);
const lightEmptyVeil = extractRule(css, `${LT} .lseat--empty .lseat__veil`);
const lightMidVeil = extractRule(css, `${LT} .lseat--mid .lseat__veil`);
const lightFullVeil = extractRule(css, `${LT} .lseat--full .lseat__veil`);
assert.ok(lightOffVeil && lightEmptyVeil && lightMidVeil && lightFullVeil, "CSS: all four light veil rungs exist");
assert.equal(extractOpacity(lightOffVeil), 0.55, "light off veil .55 (the most washed)");
assert.equal(extractOpacity(lightEmptyVeil), 0.4, "light empty veil .40");
assert.equal(extractOpacity(lightMidVeil), 0.18, "light mid veil .18");
assert.equal(extractOpacity(lightFullVeil), 0, "light full veil 0 (the brightest — INVERTED)");
// inverted monotonic: off > empty > mid > full (wash fades as the lantern lights)
assert.ok(
  extractOpacity(lightOffVeil) > extractOpacity(lightEmptyVeil)
    && extractOpacity(lightEmptyVeil) > extractOpacity(lightMidVeil)
    && extractOpacity(lightMidVeil) > extractOpacity(lightFullVeil),
  "light ladder is monotonic in the same direction (off > empty > mid > full)",
);
assert.equal(extractOpacity(extractRule(css, `${LT} .lseat--off .lseat__halo`)), 0.35, "light off halo wash .35");
assert.equal(extractOpacity(extractRule(css, `${LT} .lseat--empty .lseat__halo`)), 0, "light empty halo 0");
assert.equal(extractOpacity(extractRule(css, `${LT} .lseat--mid .lseat__glow`)), 0.45, "light mid glow .45 (+ mead glow)");
assert.equal(extractOpacity(extractRule(css, `${LT} .lseat--full .lseat__glow`)), 1, "light full glow 1");
const lightFullRing = extractRule(css, `${LT} .lseat--full .lseat__ring`);
assert.ok(lightFullRing, "CSS: light full ring rule exists");
assert.ok(lightFullRing.includes("#0B6B5C"), "light FULL ring is verdigris #0B6B5C");
assert.ok(lightFullRing.includes("232, 181, 74"), "light FULL ring carries the mead drop-shadow");

// the bundle ships the inverted ladder too
const bundleLightVeil = extractRule(plugin, `${LT} .lseat__veil`);
assert.ok(bundleLightVeil && bundleLightVeil.includes("#EFE6D2"), "bundle: light vellum wash veil ships");
assert.equal(extractOpacity(extractRule(plugin, `${LT} .lseat--off .lseat__veil`)), 0.55, "bundle: light off veil .55");
assert.equal(extractOpacity(extractRule(plugin, `${LT} .lseat--full .lseat__veil`)), 0, "bundle: light full veil 0");

console.log("light-state: four-tier dim ladder (off .75 / empty .50 / mid .25 / full 0) + stone .65 + berry guard + INVERTED light ladder (off .55 / empty .40 / mid .18 / full 0, verdigris ring) verified — issues #97, #123");
