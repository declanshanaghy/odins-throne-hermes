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
//      stacking beyond the painted pool, every seat in-scene with dir ±1;
//   4. task pips (issue #39): icon count = task count up to the cap, a "+N"
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

// ── task pips beneath the lantern (issue #39) ───────────────────────────────
// One small task icon per task, capped at TASK_PIPS.cap slots with a "+N"
// chip; the row sits on the side away from the vine and narrows to fit.
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

// Every seat (painted pool + terrace), both modes, any count: the row stays
// in-scene, on the side away from the vine, and the strand never crosses it.
const SCENES = [
  { w: 432, h: 578, mode: "extended" },
  { w: 320, h: 428, mode: "normal" },
];
const PIP_ROW_TOP = 14; // px below the lantern center (.ns-tree__tasks top)
const allSeats = [...assignSeats(bigList).values()];
for (const { w, h, mode } of SCENES) {
  for (const seat of allSeats) {
    for (const slots of [1, 3, 4, TASK_PIPS.cap]) {
      const lay = pipRowLayout(seat, w, slots);
      const seatX = (seat.x / 100) * w;
      const seatY = (seat.y / 100) * h;
      const left = seatX + lay.left;
      const right = left + lay.width;
      assert.ok(left >= TASK_PIPS.edgePx - 1e-9 && right <= w - TASK_PIPS.edgePx + 1e-9, `${mode}: pip row in-scene at seat ${seat.x},${seat.y} (${slots} slots)`);
      assert.ok(seat.dir === 1 ? right <= seatX : left >= seatX, `${mode}: pip row on the side away from the vine at seat ${seat.x},${seat.y}`);
      const lines = Math.ceil(slots / lay.columns);
      const top = seatY + PIP_ROW_TOP;
      const bottom = top + lines * (TASK_PIPS.sizePx + TASK_PIPS.gapPx);
      for (const count of [1, 5, 20]) {
        const v = vineFor(seat, count, w, h, mode);
        const nums = v.d.match(/-?\d+(\.\d+)?/g).map(Number);
        const [p0x, p0y, c1x, c1y, c2x, c2y, p3x, p3y] = nums;
        for (let t = 0; t <= 1; t += 0.005) {
          const u = 1 - t;
          const x = u * u * u * p0x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p3x;
          const y = u * u * u * p0y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p3y;
          if (y < top || y > bottom) continue;
          assert.ok(x < left || x > right, `${mode}: the vine never crosses the pip row at seat ${seat.x},${seat.y} (${count} jobs)`);
        }
      }
    }
  }
}

// ── the build inlines the painting into the shipped bundle ───────────────────
// Same precondition as smoke.mjs: run `npm run build` before `npm test`.
const bundle = readFileSync(new URL("../desktop/plugin.js", import.meta.url), "utf8");
assert.ok(
  bundle.includes("data:image/jpeg;base64,"),
  "painted backdrop is bundled into desktop/plugin.js as an inlined data URL",
);

// ── single-row pip strip left anchor (issue #54) ──────────────────────────────
// The strip is left-anchored at the lantern's left edge, clamped to the scene.
assert.equal(pipStripLeft({ x: 50, y: 30, dir: 1 }, 0, 0), 0, "unmeasured scene: strip left = 0");
assert.equal(pipStripLeft({ x: 50, y: 30, dir: 1 }, 432, 0), 0, "zero-width strip: left = 0");
// Mid-scene seat (x=50%, sceneW=432): seatPx=216, strip starts at 216 from scene edge.
// 216 is well within scene (< sceneW - edgePx - rowW), so no clamping.
const midLeft = pipStripLeft({ x: 50, y: 30, dir: 1 }, 432, 50);
assert.equal(midLeft, 0, "mid-scene seat: strip starts at li's left edge (offset 0)");
// Near-left seat (x=1%, sceneW=432): seatPx≈4, edgePx=3, strip would start at 4 from scene edge.
// 4 >= edgePx=3, so no clamping.
const nearLeft = pipStripLeft({ x: 1, y: 30, dir: 1 }, 432, 20);
assert.ok(nearLeft >= 0, "near-left seat: strip never clips the left scene edge");
// Near-right seat with wide strip should clamp to stay in-scene.
const narrowStrip = 80;
const nearRightLeft = pipStripLeft({ x: 95, y: 30, dir: -1 }, 432, narrowStrip);
const seatPx95 = (95 / 100) * 432;
const stripSceneRight = seatPx95 + nearRightLeft + narrowStrip;
assert.ok(stripSceneRight <= 432 - TASK_PIPS.edgePx + 0.01, "near-right seat: strip clamped to stay in-scene");
// Every seat: strip in-scene for all slots
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
const rowWith7Visible = taskPips(tasksN(12)); // 7 visible + "+5" chip
assert.ok(pipStripWidth(rowWith7Visible) > 7 * TASK_PIPS.sizePx + 6 * TASK_PIPS.gapPx, "overflow row: strip width includes the chip");

console.log("tree-seats: painting + painted seat pool + runtime lantern seating + task pip rows + single-row strip (issues #10, #11, #39, #54) verified");
