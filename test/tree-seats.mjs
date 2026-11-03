// Unit + bundle tests for the tree-scene UI assets + lantern seating
// (issues #10 + #11 — garden pattern waves 0-1, epic #7).
//
// Locks what the issues demand:
//   1. the painted backdrop SHIPS: src/ui/assets/tree-backdrop.jpg is the
//      prototype's identical JPEG (magic bytes + 896x1200 ~3:4 portrait) and
//      the build inlines it into desktop/plugin.js;
//   2. lantern seats are TYPED DATA matching the updated prototype
//      (SEAT_POOL / CURATED_SEATS, percent-of-scene, verbatim);
//   3. seats are ASSIGNED at runtime over whatever the backend API returns:
//      curated painted lanterns claimed first (never stealable — not by a
//      later-arriving namespace, not by an unknown one hashing into the same
//      index), djb2-hash fallback for unknown worlds, deterministic terrace
//      stacking beyond the painted pool, every seat in-scene with dir ±1.
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
const { TREE_SCENE, SEAT_POOL, CURATED_SEATS, assignSeats, namespaceSeat } = await import(
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

// ── seat pool + curated claims match the updated prototype VERBATIM ─────────
// Values copied from design/tree-display/tree-display-prototype.html
// (SEAT_POOL / CURATED_SEATS sections, commit 727a108).
const PROTOTYPE_SEAT_POOL = [
  { x: 8, y: 52 }, { x: 17, y: 28 }, { x: 25, y: 22 }, { x: 41, y: 20 },
  { x: 59, y: 19 }, { x: 57, y: 37 }, { x: 76, y: 23 }, { x: 85, y: 28 },
];
assert.equal(SEAT_POOL.length, PROTOTYPE_SEAT_POOL.length, "painted seat pool size matches the prototype");
for (let i = 0; i < PROTOTYPE_SEAT_POOL.length; i++) {
  assert.deepEqual(SEAT_POOL[i], PROTOTYPE_SEAT_POOL[i], `painted seat ${i} matches the prototype`);
}
const PROTOTYPE_CURATED = {
  "fenrir-agents": 1,
  "shanaghy-com-agents": 3,
  "say-so-agents": 4,
  "odins-throne-hermes-agents": 5,
  "re-goatmower-agents": 7,
};
assert.deepEqual(CURATED_SEATS, PROTOTYPE_CURATED, "curated seat claims match the prototype");

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
  "odins-throne-plugin",
].map((id) => id); // whatever /api/namespaces returns — never hardcoded in the tree

const seats = assignSeats(LIVE_LIST);
assert.equal(seats.size, LIVE_LIST.length, "every API namespace gets exactly one seat");
// Curated painted lanterns are claimed, with the prototype's hang direction
// (dir: x > 66 → leftward).
assert.deepEqual(seats.get("fenrir-agents"), { x: 17, y: 28, dir: 1 }, "fenrir-agents → its curated painted lantern");
assert.deepEqual(seats.get("say-so-agents"), { x: 59, y: 19, dir: 1 }, "say-so-agents → its curated painted lantern");
assert.deepEqual(seats.get("shanaghy-com-agents"), { x: 41, y: 20, dir: 1 }, "shanaghy-com-agents → its curated painted lantern");
assert.deepEqual(seats.get("re-goatmower-agents"), { x: 85, y: 28, dir: -1 }, "re-goatmower-agents → right-bough lantern, vine hangs left");

// No two worlds share a seat; every seat is in-scene with dir ±1.
const claimed = new Set();
for (const [id, seat] of seats) {
  const key = `${seat.x},${seat.y}`;
  assert.ok(!claimed.has(key), `seat (${key}) claimed by only one world (${id})`);
  claimed.add(key);
  assert.ok(seat.x > 0 && seat.x <= 100, `seat x in (0,100] for ${id} (got ${seat.x})`);
  assert.ok(seat.y > 0 && seat.y <= 100, `seat y in (0,100] for ${id} (got ${seat.y})`);
  assert.ok(seat.dir === 1 || seat.dir === -1, `seat dir ±1 for ${id}`);
}

// Deterministic: the same list seats identically across runs.
assert.deepEqual(assignSeats(LIVE_LIST), seats, "seating is deterministic for a given list");

// ── curated seats are never stealable (issue #11 amendment) ──────────────────
// A namespace appearing LATER in the API list cannot steal a curated lantern.
const laterList = ["brand-new-world", ...LIVE_LIST];
const laterSeats = assignSeats(laterList);
assert.deepEqual(
  laterSeats.get("fenrir-agents"),
  { x: 17, y: 28, dir: 1 },
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
    [17, 28],
    `hash collision walks past fenrir's curated lantern (probe on index ${curatedIdx})`,
  );
}
// Order independence for curated claims: same list, any permutation.
for (const id of Object.keys(PROTOTYPE_CURATED)) {
  assert.deepEqual(
    assignSeats([...LIVE_LIST].reverse()).get(id),
    seats.get(id),
    `curated seat for ${id} is order-independent`,
  );
}

// ── beyond the painted pool: deterministic terrace stacking ───────────────────
const bigList = Array.from({ length: SEAT_POOL.length + 4 }, (_, i) => `world-${i}`);
const bigSeats = assignSeats(bigList);
assert.equal(bigSeats.size, bigList.length, "every world in an oversized list still gets a seat");
const bigCoords = new Set(bigList.map((id) => {
  const s = bigSeats.get(id);
  assert.ok(s.y > 0 && s.y <= 100, `terrace seat y in-scene for ${id} (got ${s.y})`);
  assert.ok(s.x > 0 && s.x <= 100, `terrace seat x in-scene for ${id} (got ${s.x})`);
  return `${s.x},${s.y}`;
}));
assert.equal(bigCoords.size, bigList.length, "terrace seating never collides");
// The first painted-pool-count worlds sit in the painted band (< 64% y);
// overflow worlds terrace below it in API order.
const painted = bigList.slice(0, SEAT_POOL.length).map((id) => bigSeats.get(id).y);
assert.ok(painted.every((y) => y < 64), "painted-band worlds stay on the painting's boughs");
const overflow = bigList.slice(SEAT_POOL.length).map((id) => bigSeats.get(id).y);
assert.ok(overflow.every((y) => y >= 64), "overflow worlds terrace below the painted band");
assert.deepEqual(assignSeats(bigList), bigSeats, "terrace seating is deterministic");

// ── single-id convenience ────────────────────────────────────────────────────
assert.deepEqual(namespaceSeat("fenrir-agents"), { x: 17, y: 28, dir: 1 }, "namespaceSeat singleton → curated lantern");
for (const ns of ["mytruthfinder-agents", "brand-new-world", "odins-throne-plugin"]) {
  const a = namespaceSeat(ns);
  assert.deepEqual(a, namespaceSeat(ns), `namespaceSeat is deterministic for "${ns}"`);
  assert.ok(a.x > 0 && a.x <= 100 && a.y > 0 && a.y <= 100, `namespaceSeat in-scene for "${ns}"`);
  assert.ok(a.dir === 1 || a.dir === -1, `namespaceSeat dir ±1 for "${ns}"`);
}

// ── the build inlines the painting into the shipped bundle ───────────────────
// Same precondition as smoke.mjs: run `npm run build` before `npm test`.
const bundle = readFileSync(new URL("../desktop/plugin.js", import.meta.url), "utf8");
assert.ok(
  bundle.includes("data:image/jpeg;base64,"),
  "painted backdrop is bundled into desktop/plugin.js as an inlined data URL",
);

console.log("tree-seats: painting + painted seat pool + runtime lantern seating verified (issues #10 + #11)");
