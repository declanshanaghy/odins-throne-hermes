// Unit + bundle tests for the tree-scene UI assets + lantern seating — v3.9
// (issues #10 + #11 + #69 — garden pattern waves 0-1, epic #7).
//
// Locks what the issues demand:
//   1. the painted backdrop SHIPS: src/ui/assets/tree-backdrop.jpg is the
//      v3.9 tall painting (magic bytes + 896x1200 ~3:4 portrait) and the
//      build inlines it into desktop/plugin.js;
//   2. lantern seats are TYPED DATA matching the v3.9 prototype SEAT_POOL /
//      CURATED_SEATS (11 painting-% lanterns, verbatim);
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
const { TREE_SCENE, SEAT_POOL, CURATED_SEATS, assignSeats, namespaceSeat, projectSeat } = await import(
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

// ── seat pool + curated claims match the v3.9 prototype VERBATIM ───────────
// Values from design/tree-display/tree-display-prototype.html (commit 99abad7).
const PROTOTYPE_SEAT_POOL = [
  { x: 40, y: 73 }, { x: 16, y: 69 }, { x: 39, y: 67 }, { x: 10, y: 64 },
  { x: 30, y: 55 }, { x: 37, y: 49 }, { x: 11, y: 49 }, { x: 18, y: 40 },
  { x: 22, y: 35 }, { x: 15, y: 28 }, { x: 47, y: 33 },
];
assert.equal(SEAT_POOL.length, PROTOTYPE_SEAT_POOL.length, "painted seat pool size matches the v3.9 prototype (11)");
for (let i = 0; i < PROTOTYPE_SEAT_POOL.length; i++) {
  assert.deepEqual(SEAT_POOL[i], PROTOTYPE_SEAT_POOL[i], `painted seat ${i} matches the prototype`);
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
  "odins-throne-plugin",
];

const seats = assignSeats(LIVE_LIST);
assert.equal(seats.size, LIVE_LIST.length, "every API namespace gets exactly one seat");
// Curated painted lanterns are claimed with their v3.9 painting % coordinates.
assert.deepEqual(seats.get("fenrir-agents"), { x: 15, y: 28, dir: 1 }, "fenrir-agents → its curated painted lantern (15,28)");
assert.deepEqual(seats.get("say-so-agents"), { x: 11, y: 49, dir: 1 }, "say-so-agents → its curated painted lantern (11,49)");
assert.deepEqual(seats.get("shanaghy-com-agents"), { x: 18, y: 40, dir: 1 }, "shanaghy-com-agents → its curated painted lantern (18,40)");
assert.deepEqual(seats.get("re-goatmower-agents"), { x: 30, y: 55, dir: 1 }, "re-goatmower-agents → its curated painted lantern (30,55)");

// No two worlds share a seat; every seat is a valid painting % with dir 1.
const claimed = new Set();
for (const [id, seat] of seats) {
  const key = `${seat.x},${seat.y}`;
  assert.ok(!claimed.has(key), `seat (${key}) claimed by only one world (${id})`);
  claimed.add(key);
  assert.ok(seat.x > 0 && seat.x <= 100, `seat x in (0,100] for ${id} (got ${seat.x})`);
  assert.ok(seat.y > 0 && seat.y <= 100, `seat y in (0,100] for ${id} (got ${seat.y})`);
  assert.equal(seat.dir, 1, `seat dir = 1 (all vines go right to branch rail) for ${id}`);
}

// Deterministic: the same list seats identically across runs.
assert.deepEqual(assignSeats(LIVE_LIST), seats, "seating is deterministic for a given list");

// ── curated seats are never stealable ─────────────────────────────────────────
const laterList = ["brand-new-world", ...LIVE_LIST];
const laterSeats = assignSeats(laterList);
assert.deepEqual(
  laterSeats.get("fenrir-agents"),
  { x: 15, y: 28, dir: 1 },
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
    [15, 28],
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

// ── projectSeat: compact returns painting % unchanged ─────────────────────────
{
  const p = { x: 40, y: 73 };
  const result = projectSeat(p, "compact", 432, 640);
  assert.equal(result.x, 40, "compact mode: x passes through unchanged");
  assert.equal(result.y, 73, "compact mode: y passes through unchanged");
}
// No scene yet: returns painting % unchanged
{
  const p = { x: 30, y: 55 };
  const result = projectSeat(p, "standard", 0, 0);
  assert.equal(result.x, 30, "unmeasured scene: x passes through unchanged");
  assert.equal(result.y, 55, "unmeasured scene: y passes through unchanged");
}
// Standard: cover-center projection
{
  const W = 432, H = 1200; // H-limited: k = max(432/896, 1200/1200) = 1.0
  // dw = 896*1 = 896, fl = -(896-432)/2 = -232
  // For x=40: (40/100*896 + (-232)) / 432 * 100 = (358.4-232)/432*100 = 126.4/432*100 = 29.26
  const p = { x: 40, y: 73 };
  const result = projectSeat(p, "standard", W, H);
  const k = Math.max(W / 896, H / 1200); // = 1.0
  const dw = 896 * k;
  const fl = -(dw - W) / 2;
  const expectedX = (p.x / 100 * dw + fl) / W * 100;
  assert.ok(Math.abs(result.x - expectedX) < 0.01, `standard projection x correct (expected ~${expectedX.toFixed(2)}, got ${result.x.toFixed(2)})`);
  assert.equal(result.y, 73, "standard projection y passes through unchanged");
}
// Standard at typical sidebar size: stones stay in scene
{
  const W = 432, H = 640;
  for (const p of SEAT_POOL) {
    const result = projectSeat(p, "standard", W, H);
    assert.ok(result.x >= -5 && result.x <= 105, `projected x in scene range for seat (${p.x},${p.y}): ${result.x.toFixed(2)}`);
    assert.ok(result.y >= 0 && result.y <= 100, `projected y in scene range for seat (${p.x},${p.y}): ${result.y.toFixed(2)}`);
  }
}

// ── single-id convenience ────────────────────────────────────────────────────
assert.deepEqual(namespaceSeat("fenrir-agents"), { x: 15, y: 28, dir: 1 }, "namespaceSeat singleton → curated lantern");
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

// ── the build inlines the painting into the shipped bundle ───────────────────
const bundle = readFileSync(new URL("../desktop/plugin.js", import.meta.url), "utf8");
assert.ok(
  bundle.includes("data:image/jpeg;base64,"),
  "painted backdrop is bundled into desktop/plugin.js as an inlined data URL",
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

console.log("tree-seats: painting (v3.9 tall) + 11 painted-% seat pool + runtime seating + projectSeat + task pip rows + single-row strip (issues #10, #11, #39, #54, #69) verified");
