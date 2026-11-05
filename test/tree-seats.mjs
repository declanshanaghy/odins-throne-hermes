// Unit + bundle tests for the tree-scene UI assets + lantern seating — v3.9
// (issues #10 + #11 + #69 — garden pattern waves 0-1, epic #7).
//
// Locks what the issues demand:
//   1. the painted backdrop SHIPS: src/ui/assets/tree-backdrop.jpg is the
//      v3.9 tall painting (magic bytes + 896x1200 ~3:4 portrait) and the
//      build inlines it into desktop/plugin.js;
//   2. lantern seats are TYPED DATA matching the v3.9.2 prototype SEAT_POOL /
//      CURATED_SEATS (11 painting-% lanterns, verbatim — bright-spot
//      centroids from scripts/detect-lanterns.py);
//   3. projectSeat() maps painting % → scene % correctly per mode;
//   4. seats are ASSIGNED at runtime over whatever the backend API returns:
//      curated painted lanterns claimed first (never stealable), djb2-hash
//      fallback, share-last-seat guard when the tree is full (11 worlds max);
//   5. task pips (issue #39): icon count = task count up to the cap, a "+N"
//      chip beyond it, the row in-scene on the side away from the vine.
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
const { TREE_SCENE, SEAT_POOL, CURATED_SEATS, LANTERN_ANCHOR, SEAT_POOL_LIGHT, LANTERN_ANCHOR_LIGHT, LANTERN_SIZE_LIGHT, seatPoolFor, lanternAnchorsFor, lanternSizesFor, assignSeats, namespaceSeat, projectSeat } = await import(
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

// ── the LIGHT painting ships as its own backdrop asset (issue #123) ─────────
const jpgLight = readFileSync(new URL("../src/ui/assets/tree-backdrop-light.jpg", import.meta.url));
assert.equal(jpgLight[0], 0xff, "light backdrop magic byte 0 (JPEG SOI)");
assert.equal(jpgLight[1], 0xd8, "light backdrop magic byte 1 (JPEG SOI)");
const dimsLight = jpegDims(jpgLight);
assert.ok(dimsLight, "light backdrop JPEG has a parseable SOF frame header");
assert.equal(dimsLight.w, TREE_SCENE.backdropWidthPx, "light backdrop width matches TREE_SCENE (896)");
assert.equal(dimsLight.h, TREE_SCENE.backdropHeightPx, "light backdrop height matches TREE_SCENE (1200)");
assert.ok(
  Buffer.compare(jpg, jpgLight) !== 0,
  "light painting is a SEPARATE asset from the dark painting (byte-distinct)",
);

// ── SEAT_POOL_LIGHT + anchors/silhouettes match the v3.17 prototype VERBATIM ─
// Values from design/tree-display/tree-display-prototype.html (v3.17, round
// 25, commit 1dbbe8a — pixel-detected amber lantern cores, PIXELS WIN).
const PROTOTYPE_SEAT_POOL_LIGHT = [
  { x: 37.15, y: 74.51 }, { x: 28.07, y: 69.63 }, { x: 40.65, y: 69.61 },
  { x: 30.2, y: 58.12 }, { x: 14.51, y: 56.75 }, { x: 36.92, y: 51.86 },
  { x: 41.14, y: 48.06 }, { x: 49.88, y: 45.82 }, { x: 16.47, y: 40.35 },
  { x: 43.21, y: 34.53 }, { x: 26.13, y: 26.87 },
];
assert.equal(SEAT_POOL_LIGHT.length, 11, "light pool has one lantern per painted seat (11)");
for (let i = 0; i < PROTOTYPE_SEAT_POOL_LIGHT.length; i++) {
  assert.deepEqual(SEAT_POOL_LIGHT[i], PROTOTYPE_SEAT_POOL_LIGHT[i], `light painted seat ${i} matches the v3.17 prototype`);
}
// every light seat is a valid painting % and sits in the left half (composition contract)
for (const s of SEAT_POOL_LIGHT) {
  assert.ok(s.x > 0 && s.x < 50, `light seat x in (0,50) — lanterns live in the left half (${s.x})`);
  assert.ok(s.y > 0 && s.y <= 100, `light seat y in (0,100] (${s.y})`);
}
const PROTOTYPE_LANTERN_ANCHOR_LIGHT = [
  { x: 40.3, y: 74.8 }, { x: 32.1, y: 69.9 }, { x: 44.3, y: 69.9 },
  { x: 33.2, y: 58.4 }, { x: 18.5, y: 57.0 }, { x: 41.1, y: 52.1 },
  { x: 44.2, y: 48.3 }, { x: 53.3, y: 46.1 }, { x: 19.5, y: 40.6 },
  { x: 46.8, y: 34.8 }, { x: 29.3, y: 27.1 },
];
assert.equal(LANTERN_ANCHOR_LIGHT.length, 11, "LANTERN_ANCHOR_LIGHT has one entry per seat (11)");
for (let i = 0; i < 11; i++) {
  assert.deepEqual(LANTERN_ANCHOR_LIGHT[i], PROTOTYPE_LANTERN_ANCHOR_LIGHT[i], `light anchor ${i} matches the v3.17 prototype`);
  assert.ok(Math.abs(LANTERN_ANCHOR_LIGHT[i].x - SEAT_POOL_LIGHT[i].x) < 15, `light anchor ${i}.x near its seat`);
  assert.ok(Math.abs(LANTERN_ANCHOR_LIGHT[i].y - SEAT_POOL_LIGHT[i].y) < 15, `light anchor ${i}.y near its seat`);
}
const PROTOTYPE_LANTERN_SIZE_LIGHT = [
  { w: 28, h: 50 }, { w: 41, h: 53 }, { w: 36, h: 51 }, { w: 26, h: 50 },
  { w: 41, h: 54 }, { w: 44, h: 68 }, { w: 26, h: 50 }, { w: 32, h: 54 },
  { w: 26, h: 54 }, { w: 34, h: 50 }, { w: 28, h: 51 },
];
assert.equal(LANTERN_SIZE_LIGHT.length, 11, "LANTERN_SIZE_LIGHT has one entry per seat (11)");
for (let i = 0; i < 11; i++) {
  assert.deepEqual(LANTERN_SIZE_LIGHT[i], PROTOTYPE_LANTERN_SIZE_LIGHT[i], `light silhouette ${i} matches the v3.17 prototype`);
}

// theme-selectors return the ACTIVE pool / anchors / silhouettes
assert.equal(seatPoolFor("dark"), SEAT_POOL, "seatPoolFor(dark) === SEAT_POOL");
assert.equal(seatPoolFor("light"), SEAT_POOL_LIGHT, "seatPoolFor(light) === SEAT_POOL_LIGHT");
assert.equal(lanternAnchorsFor("dark"), LANTERN_ANCHOR, "lanternAnchorsFor(dark) === LANTERN_ANCHOR");
assert.equal(lanternAnchorsFor("light"), LANTERN_ANCHOR_LIGHT, "lanternAnchorsFor(light) === LANTERN_ANCHOR_LIGHT");
assert.equal(lanternSizesFor("dark").length, 11, "lanternSizesFor(dark) has 11 entries");
assert.equal(lanternSizesFor("light"), LANTERN_SIZE_LIGHT, "lanternSizesFor(light) === LANTERN_SIZE_LIGHT");

// ── seat pool + curated claims match the v3.9.2 prototype VERBATIM ──
// Values from design/tree-display/tree-display-prototype.html (commit
// 83c1a16, v3.9.2 — bright-spot centroids from scripts/detect-lanterns.py).
const PROTOTYPE_SEAT_POOL = [
  { x: 40, y: 73 }, { x: 16, y: 69 }, { x: 46, y: 68 }, { x: 10, y: 64 },
  { x: 30, y: 55 }, { x: 37, y: 50 }, { x: 11, y: 50 }, { x: 18, y: 40 },
  { x: 23, y: 30 }, { x: 40, y: 37 }, { x: 47, y: 33 },
];
assert.equal(SEAT_POOL.length, PROTOTYPE_SEAT_POOL.length, "painted seat pool size matches the v3.9 prototype (11)");
for (let i = 0; i < PROTOTYPE_SEAT_POOL.length; i++) {
  assert.deepEqual(SEAT_POOL[i], PROTOTYPE_SEAT_POOL[i], `painted seat ${i} matches the prototype`);
}

// ── LANTERN_ANCHOR: per-seat popup pins verbatim from v3.13.2 prototype ───────
assert.equal(LANTERN_ANCHOR.length, 11, "LANTERN_ANCHOR has one entry per seat (11)");
assert.ok(Math.abs(LANTERN_ANCHOR[0].x - 43.7) < 0.01, "LANTERN_ANCHOR[0].x ≈ 43.7");
assert.ok(Math.abs(LANTERN_ANCHOR[0].y - 73.5) < 0.01, "LANTERN_ANCHOR[0].y ≈ 73.5");
assert.ok(Math.abs(LANTERN_ANCHOR[10].x - 50.9) < 0.01, "LANTERN_ANCHOR[10].x ≈ 50.9");
assert.ok(Math.abs(LANTERN_ANCHOR[10].y - 33.0) < 0.01, "LANTERN_ANCHOR[10].y ≈ 33.0");
// every anchor is a small offset from its painted lantern
for (let i = 0; i < SEAT_POOL.length; i++) {
  const s = SEAT_POOL[i];
  const a = LANTERN_ANCHOR[i];
  assert.ok(Math.abs(a.x - s.x) < 15, `LANTERN_ANCHOR[${i}].x is near SEAT_POOL[${i}].x`);
  assert.ok(Math.abs(a.y - s.y) < 15, `LANTERN_ANCHOR[${i}].y is near SEAT_POOL[${i}].y`);
}
const PROTOTYPE_CURATED = {
  "fenrir-agents": 9,
  "odins-throne-hermes-agents": 8,
  "shanaghy-com-agents": 7,
  "say-so-agents": 6,
  "re-goatmower-agents": 4,
};
assert.deepEqual(CURATED_SEATS, PROTOTYPE_CURATED, "curated seat claims match the v3.9 prototype");

// djb2 — mirrored from the module (verified against namespaceIcons.ts).
function hashKey(key) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── runtime seating over an API list ─────────────────────────────────────────
const LIVE_LIST = [
  "fenrir-agents",
  "say-so-agents",
  "mytruthfinder-agents",
  "shanaghy-com-agents",
  "re-goatmower-agents",
];

const seats = assignSeats(LIVE_LIST);
assert.equal(seats.size, LIVE_LIST.length, "every API namespace gets exactly one seat");
// Curated painted lanterns are claimed with their v3.9 painting % coordinates.
assert.deepEqual(seats.get("fenrir-agents"), { x: 40, y: 37, dir: 1, seatIdx: 9 }, "fenrir-agents → its curated painted lantern (40,37, idx 9)");
assert.deepEqual(seats.get("say-so-agents"), { x: 11, y: 50, dir: 1, seatIdx: 6 }, "say-so-agents → its curated painted lantern (11,50, idx 6)");
assert.deepEqual(seats.get("shanaghy-com-agents"), { x: 18, y: 40, dir: 1, seatIdx: 7 }, "shanaghy-com-agents → its curated painted lantern (18,40, idx 7)");
assert.deepEqual(seats.get("re-goatmower-agents"), { x: 30, y: 55, dir: 1, seatIdx: 4 }, "re-goatmower-agents → its curated painted lantern (30,55, idx 4)");

// No two worlds share a seat; every seat is a valid painting % with dir 1 and a valid seatIdx.
const claimed = new Set();
for (const [id, seat] of seats) {
  const key = `${seat.x},${seat.y}`;
  assert.ok(!claimed.has(key), `seat (${key}) claimed by only one world (${id})`);
  claimed.add(key);
  assert.ok(seat.x > 0 && seat.x <= 100, `seat x in (0,100] for ${id} (got ${seat.x})`);
  assert.ok(seat.y > 0 && seat.y <= 100, `seat y in (0,100] for ${id} (got ${seat.y})`);
  assert.equal(seat.dir, 1, `seat dir = 1 (all vines go right to branch rail) for ${id}`);
  assert.ok(seat.seatIdx >= 0 && seat.seatIdx < SEAT_POOL.length, `seatIdx in [0,10] for ${id} (got ${seat.seatIdx})`);
  assert.equal(seat.x, SEAT_POOL[seat.seatIdx].x, `seat.x matches SEAT_POOL[seatIdx].x for ${id}`);
  assert.equal(seat.y, SEAT_POOL[seat.seatIdx].y, `seat.y matches SEAT_POOL[seatIdx].y for ${id}`);
}

// Deterministic: the same list seats identically across runs.
assert.deepEqual(assignSeats(LIVE_LIST), seats, "seating is deterministic for a given list");

// ── theme-selected seating (issue #123): same seat INDEX, its own painting's
// lantern — the light pool seats the SAME realms on SEAT_POOL_LIGHT through
// the SAME assignSeats()/projectSeat() machinery, no new projection math.
const seatsLight = assignSeats(LIVE_LIST, "light");
assert.equal(seatsLight.size, LIVE_LIST.length, "light seating seats every namespace");
for (const [id, darkSeat] of seats) {
  const lightSeat = seatsLight.get(id);
  assert.ok(lightSeat, `light seat exists for ${id}`);
  assert.equal(lightSeat.seatIdx, darkSeat.seatIdx, `${id} keeps its seat INDEX across themes`);
  assert.equal(lightSeat.dir, 1, `${id} light seat dir = 1`);
  assert.equal(lightSeat.x, SEAT_POOL_LIGHT[lightSeat.seatIdx].x, `${id} light seat.x from SEAT_POOL_LIGHT`);
  assert.equal(lightSeat.y, SEAT_POOL_LIGHT[lightSeat.seatIdx].y, `${id} light seat.y from SEAT_POOL_LIGHT`);
  assert.notDeepEqual([lightSeat.x, lightSeat.y], [darkSeat.x, darkSeat.y], `${id} re-seats onto the parchment painting's own lantern`);
}
// curated claims keep their indices in light too
assert.equal(seatsLight.get("fenrir-agents").seatIdx, 9, "fenrir-agents keeps curated seat index 9 in light");
assert.equal(seatsLight.get("say-so-agents").seatIdx, 6, "say-so-agents keeps curated seat index 6 in light");
// determinism in light as well
assert.deepEqual(assignSeats(LIVE_LIST, "light"), seatsLight, "light seating is deterministic");
// the SAME projectSeat() carries the light pool on-canvas wherever the
// painting's left-50% composition stays inside the cover crop. The narrowest
// dock scroller (268x746) crops the painting at scene x = 268/557 ≈ 48.1%,
// past light seat 7 (x 49.88%) — the projection is still EXACT there (the
// stone tracks its lantern; the lantern itself is cropped out with the
// painting, the same limitation the dark pool's anchor 10 at x 50.9 has).
for (const [W, H] of [[432, 640], [500, 800], [800, 600], [668, 443]]) {
  for (const p of SEAT_POOL_LIGHT) {
    const r = projectSeat(p, W, H);
    assert.ok(r.x >= 0 && r.x <= 100, `light seat (${p.x},${p.y}) on-canvas at ${W}x${H}: scene x ${r.x.toFixed(2)}`);
    assert.ok(r.y >= 0 && r.y <= 100, `light seat (${p.x},${p.y}) scene y in range at ${W}x${H}: ${r.y.toFixed(2)}`);
  }
}
// formula-exactness at the narrowest dock: the light seat maps through the
// SAME left-anchored + vertically-centered crop math as the dark pool
{
  const [W, H] = [268, 746];
  const k = Math.max(W / 896, H / 1200);
  const dw = 896 * k, dh = 1200 * k;
  const fl = 0, ft = (H - dh) / 2;
  for (const p of SEAT_POOL_LIGHT) {
    const r = projectSeat(p, W, H);
    const expectedX = (p.x / 100 * dw + fl) / W * 100;
    const expectedY = (p.y / 100 * dh + ft) / H * 100;
    assert.ok(Math.abs(r.x - expectedX) < 0.01, `narrow dock: light seat (${p.x},${p.y}) x is formula-exact`);
    assert.ok(Math.abs(r.y - expectedY) < 0.01, `narrow dock: light seat (${p.x},${p.y}) y is formula-exact`);
  }
}

// ── curated seats are never stealable ─────────────────────────────────────────
const laterList = ["brand-new-world", ...LIVE_LIST];
const laterSeats = assignSeats(laterList);
assert.deepEqual(
  laterSeats.get("fenrir-agents"),
  { x: 40, y: 37, dir: 1, seatIdx: 9 },
  "a namespace appearing later in the API list keeps its curated seat",
);
// An unknown world whose djb2 hash lands ON a curated seat walks past it.
for (const curatedIdx of Object.values(PROTOTYPE_CURATED)) {
  let probe = `unknown-world-${curatedIdx}`;
  let guard = 0;
  while (hashKey(probe) % SEAT_POOL.length !== curatedIdx && guard++ < 10_000) {
    probe = `unknown-world-${curatedIdx}-${guard}`;
  }
  assert.equal(
    hashKey(probe) % SEAT_POOL.length,
    curatedIdx,
    `probe id found that hashes onto curated seat ${curatedIdx}`,
  );
  const probed = assignSeats(["fenrir-agents", probe]);
  assert.notDeepEqual(
    [probed.get(probe).x, probed.get(probe).y],
    [40, 37],
    `hash collision walks past fenrir's curated lantern (probe on index ${curatedIdx})`,
  );
}
// Order independence for curated claims.
for (const id of Object.keys(PROTOTYPE_CURATED)) {
  assert.deepEqual(
    assignSeats([...LIVE_LIST].reverse()).get(id),
    seats.get(id),
    `curated seat for ${id} is order-independent`,
  );
}

// ── share-last-seat guard: tree full → share lantern 10 (not loop) ───────────
const fullList = Array.from({ length: SEAT_POOL.length + 4 }, (_, i) => `world-${i}`);
const fullSeats = assignSeats(fullList);
assert.equal(fullSeats.size, fullList.length, "every world in an oversized list still gets a seat");
// Overflow worlds share the last lantern (index 10 = {x:47,y:33})
const lastSeat = SEAT_POOL[SEAT_POOL.length - 1];
const lastKey = `${lastSeat.x},${lastSeat.y}`;
let sharedCount = 0;
for (const [, seat] of fullSeats) {
  if (`${seat.x},${seat.y}` === lastKey) sharedCount++;
}
assert.ok(sharedCount >= 1, "last lantern is used as the overflow seat");
assert.ok(sharedCount <= fullList.length - SEAT_POOL.length + 1, "overflow count is bounded");
// Deterministic
assert.deepEqual(assignSeats(fullList), fullSeats, "overflow seating is deterministic");

// ── projectSeat: mode-independent cover-center projection ─────────────────────
// Compact affects the vine card list only — the tree projection is identical in
// both modes. projectSeat() no longer accepts a mode argument.
// No scene yet: returns painting % unchanged
{
  const p = { x: 30, y: 55 };
  const result = projectSeat(p, 0, 0);
  assert.equal(result.x, 30, "unmeasured scene: x passes through unchanged");
  assert.equal(result.y, 55, "unmeasured scene: y passes through unchanged");
}
// Cover-center, left-anchored (object-position: 0% 50%) projection
{
  const W = 432, H = 1200; // H-limited: k = max(432/896, 1200/1200) = 1.0
  // dw = 896*1 = 896, fl = 0 (LEFT anchor — matches CSS object-position 0% 50%)
  // For x=40: (40/100*896 + 0) / 432 * 100 = 358.4/432*100 = 82.96
  const p = { x: 40, y: 73 };
  const result = projectSeat(p, W, H);
  const k = Math.max(W / 896, H / 1200); // = 1.0
  const dw = 896 * k;
  const fl = 0;
  const expectedX = (p.x / 100 * dw + fl) / W * 100;
  assert.ok(Math.abs(result.x - expectedX) < 0.01, `projection x correct (expected ~${expectedX.toFixed(2)}, got ${result.x.toFixed(2)})`);
  assert.equal(result.y, 73, "projection y passes through unchanged");
}
// Mode-independent: compact and standard produce identical results for every seat
{
  const cases = [
    [268, 746], // shipped dock scroller (300px pane) — height-limited
    [432, 640], // design reference sidebar (TREE_SCENE.sidebarWidthPx) — height-limited
    [500, 800], // web hall sidebar — height-limited
    [800, 600], // wide/short pane (resizable sidebar dragged wide) — WIDTH-limited
    [668, 443], // the reported misalignment ratio — WIDTH-limited
  ];
  for (const [W, H] of cases) {
    for (const p of SEAT_POOL) {
      const r = projectSeat(p, W, H);
      assert.ok(
        r.x >= 0 && r.x <= 100,
        `seat (${p.x},${p.y}) on-canvas at ${W}x${H}: scene x ${r.x.toFixed(2)}`,
      );
      assert.ok(
        r.y >= 0 && r.y <= 100,
        `seat (${p.x},${p.y}) scene y in range at ${W}x${H}: ${r.y.toFixed(2)}`,
      );
    }
  }
}
// Width-limited scenes: y maps through the VERTICALLY-CENTERED cover crop
// (object-position 50% y — ft = (H - dh)/2), NOT passthrough. The v3.9 port
// dropped this half from prototype v3.9.1; top seats rendered low by
// (py% - 50%)·(H - dh) — the reported odins-throne/fenrir/top-right drift.
{
  const cases = [
    [800, 600], // k = 800/896 — width-limited
    [668, 443], // k = 668/896 — width-limited (reported ratio)
  ];
  for (const [W, H] of cases) {
    const k = Math.max(W / 896, H / 1200);
    assert.ok(k > H / 1200 + 1e-9, `case ${W}x${H} is width-limited`);
    const dw = 896 * k, dh = 1200 * k;
    const fl = 0, ft = (H - dh) / 2;
    for (const p of SEAT_POOL) {
      const r = projectSeat(p, W, H);
      const expectedX = (p.x / 100 * dw + fl) / W * 100;
      const expectedY = (p.y / 100 * dh + ft) / H * 100;
      assert.ok(Math.abs(r.x - expectedX) < 0.01, `width-limited ${W}x${H} x for (${p.x},${p.y})`);
      assert.ok(Math.abs(r.y - expectedY) < 0.01,
        `width-limited ${W}x${H} y for (${p.x},${p.y}): expected ~${expectedY.toFixed(2)}, got ${r.y.toFixed(2)}`);
      // the stone (projected seat) must land ON the painted lantern's client y
      const stoneY = r.y / 100 * H;
      const lanternY = p.y / 100 * dh + ft;
      assert.ok(Math.abs(stoneY - lanternY) < 0.01,
        `width-limited ${W}x${H}: stone on lantern y for (${p.x},${p.y}) — Δ ${Math.abs(stoneY - lanternY).toFixed(2)}px`);
    }
  }
}
// …and the CSS crop matches the math: the standard backdrop rule is LEFT-anchored
{
  const css = readFileSync(new URL("../src/ui/styles/index.css", import.meta.url), "utf8");
  const m = css.match(/\.ns-tree__backdrop\s*\{[^}]*\}/);
  assert.ok(m, "standard .ns-tree__backdrop rule exists in CSS source");
  assert.ok(m[0].includes("object-fit: cover"), "standard backdrop is object-fit cover");
  assert.ok(
    m[0].includes("object-position: 0% 50%"),
    "standard backdrop is LEFT-anchored (object-position: 0% 50%) — matches projectSeat's fl = 0",
  );
}

// ── single-id convenience ────────────────────────────────────────────────────
assert.deepEqual(namespaceSeat("fenrir-agents"), { x: 40, y: 37, dir: 1, seatIdx: 9 }, "namespaceSeat singleton → curated lantern with seatIdx 9");
for (const ns of ["mytruthfinder-agents", "brand-new-world", "odins-throne-plugin"]) {
  const a = namespaceSeat(ns);
  assert.deepEqual(a, namespaceSeat(ns), `namespaceSeat is deterministic for "${ns}"`);
  assert.ok(a.x > 0 && a.x <= 100 && a.y > 0 && a.y <= 100, `namespaceSeat in-scene for "${ns}"`);
  assert.equal(a.dir, 1, `namespaceSeat dir = 1 for "${ns}"`);
}

// ── task pips beneath the lantern (issue #39) ───────────────────────────────
const { TASK_PIPS, taskPips, pipSlots, pipRowWidth, pipRowLayout, pipStripWidth, pipStripLeft } = await import(
  "../src/ui/lib/taskPips.ts"
);
const { vineFor } = await import("../src/ui/lib/vineGeometry.ts");
const tasksN = (n) =>
  Array.from({ length: n }, (_, i) => ({ sessionId: `s-${i}`, status: ["running", "failed", "pending", "succeeded"][i % 4] }));

assert.deepEqual(taskPips([]), { pips: [], overflow: 0, count: 0 }, "an empty world has no pips");
for (let n = 0; n <= 40; n++) {
  const row = taskPips(tasksN(n));
  assert.equal(row.count, n, `pip row stands for all ${n} tasks`);
  assert.equal(row.pips.length + row.overflow, n, `visible pips + overflow = task count (${n})`);
  assert.ok(pipSlots(row) <= TASK_PIPS.cap, `never more than ${TASK_PIPS.cap} slots (${n} tasks)`);
  if (n <= TASK_PIPS.cap) {
    assert.equal(row.overflow, 0, `no overflow chip at or under the cap (${n})`);
    assert.equal(row.pips.length, n, `icon count = task count under the cap (${n})`);
  } else {
    assert.equal(row.pips.length, TASK_PIPS.cap - 1, `over the cap the last slot is the chip (${n})`);
    assert.equal(row.overflow, n - (TASK_PIPS.cap - 1), `the chip folds the rest (${n})`);
  }
}
assert.deepEqual(
  taskPips(tasksN(3)).pips.map((p) => p.sessionId),
  ["s-0", "s-1", "s-2"],
  "pips keep the caller's hang order",
);
assert.equal(taskPips(tasksN(5), 3).overflow, 3, "a custom cap folds past it");
assert.equal(pipRowWidth(0), 0, "no columns → no width");
assert.equal(pipRowWidth(1), TASK_PIPS.sizePx, "one column is one pip wide");
assert.equal(pipRowWidth(4), 4 * TASK_PIPS.sizePx + 3 * TASK_PIPS.gapPx, "columns + gaps");

// Unmeasured scene: full-width row, away from the vine, no clamp.
assert.deepEqual(
  pipRowLayout({ x: 50, y: 30, dir: 1 }, 0, 8),
  { columns: 4, width: pipRowWidth(4), left: -TASK_PIPS.clearPx - pipRowWidth(4) },
  "dir 1 (vine leans right) → the row sits left of the lantern",
);
assert.deepEqual(
  pipRowLayout({ x: 50, y: 30, dir: -1 }, 0, 2),
  { columns: 2, width: pipRowWidth(2), left: TASK_PIPS.clearPx },
  "dir -1 (vine leans left) → the row sits right of the lantern",
);

// ── the build inlines BOTH paintings into the shipped bundle ────────────────
const bundle = readFileSync(new URL("../desktop/plugin.js", import.meta.url), "utf8");
assert.ok(
  bundle.includes("data:image/jpeg;base64,"),
  "painted backdrop is bundled into desktop/plugin.js as an inlined data URL",
);
assert.ok(
  (bundle.match(/data:image\/jpeg;base64,/g) ?? []).length >= 2,
  "BOTH paintings (dark moonlit + light parchment) are bundled into desktop/plugin.js",
);
// the tree picks the painting by theme (issue #123)
const treeSrc = readFileSync(new URL("../src/ui/components/NamespaceTree.tsx", import.meta.url), "utf8");
assert.ok(treeSrc.includes("tree-backdrop-light.jpg"), "NamespaceTree imports the light painting");
assert.ok(
  treeSrc.includes('theme === "light" ? treeBackdropLight : treeBackdrop'),
  "NamespaceTree picks the painting by theme",
);

// ── single-row pip strip left anchor (issue #54) ──────────────────────────────
assert.equal(pipStripLeft({ x: 50, y: 30, dir: 1 }, 0, 0), 0, "unmeasured scene: strip left = 0");
assert.equal(pipStripLeft({ x: 50, y: 30, dir: 1 }, 432, 0), 0, "zero-width strip: left = 0");
const midLeft = pipStripLeft({ x: 50, y: 30, dir: 1 }, 432, 50);
assert.equal(midLeft, 0, "mid-scene seat: strip starts at li's left edge (offset 0)");
const nearLeft = pipStripLeft({ x: 1, y: 30, dir: 1 }, 432, 20);
assert.ok(nearLeft >= 0, "near-left seat: strip never clips the left scene edge");
const narrowStrip = 80;
const nearRightLeft = pipStripLeft({ x: 95, y: 30, dir: -1 }, 432, narrowStrip);
const seatPx95 = (95 / 100) * 432;
const stripSceneRight = seatPx95 + nearRightLeft + narrowStrip;
assert.ok(stripSceneRight <= 432 - TASK_PIPS.edgePx + 0.01, "near-right seat: strip clamped to stay in-scene");

// Every painted seat: strip in-scene for all slots
const allSeats = [...assignSeats(Array.from({ length: SEAT_POOL.length }, (_, i) => `world-${i}`)).values()];
for (const seat of allSeats) {
  for (const n of [1, 4, 8]) {
    const row = taskPips(tasksN(n));
    const w = pipStripWidth(row);
    for (const sceneW of [320, 432]) {
      const left = pipStripLeft(seat, sceneW, w);
      const sp = (seat.x / 100) * sceneW;
      const right = sp + left + w;
      assert.ok(sp + left >= TASK_PIPS.edgePx - 0.01, `strip left in-scene for seat ${seat.x},${seat.y} (${n} pips, sceneW=${sceneW})`);
      assert.ok(right <= sceneW - TASK_PIPS.edgePx + 0.01, `strip right in-scene for seat ${seat.x},${seat.y} (${n} pips, sceneW=${sceneW})`);
    }
  }
}
// pipStripWidth: single row width matches prototype formula
assert.equal(pipStripWidth({ pips: [], overflow: 0, count: 0 }), 0, "empty pip row has zero strip width");
assert.equal(
  pipStripWidth({ pips: [{ sessionId: "s0", status: "running" }], overflow: 0, count: 1 }),
  TASK_PIPS.sizePx,
  "one pip: width = sizePx",
);
assert.equal(
  pipStripWidth({ pips: [{ sessionId: "s0", status: "running" }, { sessionId: "s1", status: "failed" }], overflow: 0, count: 2 }),
  2 * TASK_PIPS.sizePx + 1 * TASK_PIPS.gapPx,
  "two pips: width = 2*sizePx + 1*gapPx",
);
const rowWith7Visible = taskPips(tasksN(12));
assert.ok(pipStripWidth(rowWith7Visible) > 7 * TASK_PIPS.sizePx + 6 * TASK_PIPS.gapPx, "overflow row: strip width includes the chip");

console.log("tree-seats: paintings (dark v3.9 tall + light v3.17 parchment) + BOTH painted-% seat pools + LANTERN_ANCHOR(_LIGHT) + theme-selected seating + projectSeat + task pip rows + single-row strip (issues #10, #11, #39, #54, #69, #95, #123) verified");
