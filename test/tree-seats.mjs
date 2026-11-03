// Unit + bundle tests for the tree-scene UI assets (issue:10 — wave-0 slice of
// the garden pattern, epic #7).
//
// Locks three things the issue demands:
//   1. the painted backdrop SHIPS: src/ui/assets/tree-backdrop.jpg is the
//      prototype's identical JPEG (magic bytes + 896x1200 ~3:4 portrait) and
//      the build inlines it into desktop/plugin.js;
//   2. lantern seat coordinates are TYPED DATA matching the prototype's
//      WORLDS mapping verbatim (percent-of-scene, per world);
//   3. every namespace resolves to a deterministic, in-scene seat.
//
// Run: npm test   (node --import ./test/register.mjs test/tree-seats.mjs)
// The bundle assertion requires `npm run build` first (same as smoke.mjs).

import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

// ── compile the pure data module to JS on the fly (node has no TS loader) ──
const src = readFileSync(new URL("../src/ui/lib/treeSeats.ts", import.meta.url), "utf8");
const { code } = transformSync(src, { loader: "ts", format: "esm" });
const tmp = mkdtempSync(join(tmpdir(), "tree-seats-"));
writeFileSync(join(tmp, "treeSeats.mjs"), code);
const { WORLD_SEATS, TREE_SCENE, namespaceSeat } = await import(
  pathToFileURL(join(tmp, "treeSeats.mjs")).href
);

// ── the painting ships as the backdrop asset ────────────────────────────────
const jpg = readFileSync(new URL("../src/ui/assets/tree-backdrop.jpg", import.meta.url));
assert.equal(jpg[0], 0xff, "backdrop magic byte 0 (JPEG SOI)");
assert.equal(jpg[1], 0xd8, "backdrop magic byte 1 (JPEG SOI)");

function jpegDims(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}
const dims = jpegDims(jpg);
assert.ok(dims, "backdrop JPEG has a parseable SOF frame header");
assert.equal(dims.w, TREE_SCENE.backdropWidthPx, "backdrop width matches TREE_SCENE");
assert.equal(dims.h, TREE_SCENE.backdropHeightPx, "backdrop height matches TREE_SCENE");
assert.ok(
  Math.abs(TREE_SCENE.aspectRatio - 3 / 4) < 0.01,
  `scene ratio ~3:4 (got ${TREE_SCENE.aspectRatio.toFixed(4)})`,
);
assert.equal(TREE_SCENE.sidebarWidthPx, 432, "prototype sidebar scene width");

// ── seats match the prototype's WORLDS mapping VERBATIM ─────────────────────
// Values copied from design/tree-display/tree-display-prototype.html.
const PROTOTYPE_WORLDS = {
  fenrir: { x: 17, y: 28, dir: 1 },
  hills: { x: 41, y: 20, dir: 1 },
  sayso: { x: 59, y: 19, dir: 1 },
  hearth: { x: 85, y: 28, dir: -1 },
};
for (const [world, seat] of Object.entries(PROTOTYPE_WORLDS)) {
  assert.deepEqual(WORLD_SEATS[world], seat, `world "${world}" seat matches the prototype mapping`);
}

// Curated bridges from live repo namespace ids to prototype worlds.
assert.deepEqual(namespaceSeat("fenrir-agents"), PROTOTYPE_WORLDS.fenrir, "fenrir-agents → fenrir seat");
assert.deepEqual(namespaceSeat("say-so-agents"), PROTOTYPE_WORLDS.sayso, "say-so-agents → sayso seat");

// Deterministic fallback for worlds not yet vision-mapped: same id → same
// seat, always inside the scene, hang direction ±1.
for (const ns of ["mytruthfinder-agents", "shanaghy-com-agents", "re-goatmower-agents", "brand-new-world"]) {
  const a = namespaceSeat(ns);
  const b = namespaceSeat(ns);
  assert.deepEqual(a, b, `fallback seat for "${ns}" is deterministic across calls`);
  assert.ok(a.x > 0 && a.x <= 100, `fallback x in (0,100] for "${ns}" (got ${a.x})`);
  assert.ok(a.y > 0 && a.y <= 100, `fallback y in (0,100] for "${ns}" (got ${a.y})`);
  assert.ok(a.dir === 1 || a.dir === -1, `fallback dir ±1 for "${ns}"`);
}

// ── the build inlines the painting into the shipped bundle ───────────────────
// Same precondition as smoke.mjs: run `npm run build` before `npm test`.
const bundle = readFileSync(new URL("../desktop/plugin.js", import.meta.url), "utf8");
assert.ok(
  bundle.includes("data:image/jpeg;base64,"),
  "painted backdrop is bundled into desktop/plugin.js as an inlined data URL",
);

console.log("tree-seats: painting + lantern seat data verified (issue:10)");
