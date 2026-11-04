// Unit tests for the vine-strand job cards (issue #12, garden pattern
// wave 2, epic #7) — the geometry + ordering contracts the issue demands:
//
//   1. VINE GEOMETRY (src/ui/lib/vineGeometry.ts, the prototype's vineFor):
//      the strand starts at the open lantern's SEAT, cascades downward with
//      one pitch of growth per card (extends with the job count), cards are
//      evenly spread along the curve and NEVER overlap — at any job count,
//      in both display modes;
//   2. HANG ORDER (src/ui/hooks/useJobs.ts sortJobs): running → failed →
//      pending → succeeded (then cached, then purged), stable within a
//      status;
//   3. STATUS SIGILS (src/ui/lib/namespaceIcons.ts taskIcon contract):
//      hammer while running, dice while pending, raven for failure, ring
//      when succeeded — with inline fallbacks for offline.
//
// Run: npm test   (node --import ./test/register.mjs test/vine.mjs)

import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

// ── compile the pure modules to JS on the fly (node has no TS loader) ──────
const tmp = mkdtempSync(join(tmpdir(), "vine-"));
function compileTs(rel, out) {
  const src = readFileSync(new URL(rel, import.meta.url), "utf8");
  const { code } = transformSync(src, { loader: "ts", format: "esm" });
  writeFileSync(join(tmp, out), code);
  return import(pathToFileURL(join(tmp, out)).href);
}

const {
  vineFor,
  vineCardBox,
  vineCardWidth,
  vineCanvasHeight,
  vinePitch,
  VINE,
} = await compileTs("../src/ui/lib/vineGeometry.ts", "vineGeometry.mjs");
const { assignSeats, SEAT_POOL } = await compileTs("../src/ui/lib/treeSeats.ts", "treeSeats.mjs");
const { taskIcon, taskIconFallback, ICON_BASE } = await compileTs(
  "../src/ui/lib/namespaceIcons.ts",
  "namespaceIcons.mjs",
);
// useJobs pulls react + localStorage at import — bundle it for node.
const useJobsSrc = readFileSync(new URL("../src/ui/hooks/useJobs.ts", import.meta.url), "utf8");
const { code: useJobsCode } = transformSync(useJobsSrc, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
// Strip the react/localStorage imports — sortJobs is pure and needs none of
// them; a bare bundling of the hook's deps drags the DOM into node.
const pureUseJobs = useJobsCode
  .replace(/^\s*import .* from "react";$/m, "")
  .replace(/^\s*import .* from "\.\.\/lib\/constants";$/m, "")
  .replace(/^\s*import .* from "\.\.\/lib\/localStorageLogs";$/m, "");
writeFileSync(join(tmp, "useJobs.mjs"), pureUseJobs);
const { sortJobs } = await import(pathToFileURL(join(tmp, "useJobs.mjs")).href);

// ── scene fixtures ─────────────────────────────────────────────────────────
const MODES = ["extended", "normal", "compact"];
const SCENE = { w: 432, h: 576 }; // the prototype sidebar's painted box (3:4)
const seats = assignSeats(["fenrir-agents", "say-so-agents", "a-new-world-x"]);
const seat = seats.get("fenrir-agents");

// ── 1. the strand starts at the lantern's seat and cascades downward ──────
for (const mode of MODES) {
  const n = 5;
  const v = vineFor(seat, n, SCENE.w, SCENE.h, mode);
  const L = { x: (seat.x / 100) * SCENE.w, y: (seat.y / 100) * SCENE.h };
  assert.ok(v.d.startsWith(`M${L.x.toFixed(1)},${L.y.toFixed(1)}`), `${mode}: the vine extends FROM the lantern's seat`);
  assert.equal(v.points.length, n, `${mode}: one anchor per hung card`);
  assert.ok(v.d.includes("C"), `${mode}: the strand is a bezier cascade`);
  assert.ok(v.bottom > L.y, `${mode}: the strand cascades DOWNWARD from the seat`);
  // every anchor lies at or below the lantern's hang line start
  for (const p of v.points) {
    assert.ok(p.y >= L.y - 0.5, `${mode}: no card hangs above its lantern`);
  }
  assert.equal(v.dir, seat.dir, `${mode}: the strand leans off the seat's dir`);
}

// ── 2. cards never overlap at ANY job count, in every mode ───────────────
for (const mode of MODES) {
  const minSpacing = mode === "compact" ? VINE.minCenterSpacingCompact : VINE.minCenterSpacing;
  for (let n = 1; n <= 64; n++) {
    const v = vineFor(seat, n, SCENE.w, SCENE.h, mode);
    let prevY = -Infinity;
    for (let i = 0; i < v.points.length; i++) {
      const p = v.points[i];
      assert.ok(p.y > prevY, `${mode} n=${n}: anchors hang in strict downward order`);
      const dy = p.y - (i === 0 ? v.points[0].y : v.points[i - 1].y);
      if (i > 0) {
        assert.ok(
          dy >= minSpacing,
          `${mode} n=${n}: card ${i} centers ≥ ${minSpacing}px apart (got ${dy.toFixed(1)}px) — never overlapping`,
        );
      }
      prevY = p.y;
    }
  }
}

// ── 3. the vine EXTENDS with the job count ─────────────────────────────────
const v5 = vineFor(seat, 5, SCENE.w, SCENE.h, "extended");
const v6 = vineFor(seat, 6, SCENE.w, SCENE.h, "extended");
assert.ok(
  v6.bottom > v5.bottom + vinePitch("extended") - 1,
  "one more job grows the strand by ~one pitch (it extends with the job count)",
);
const v1 = vineFor(seat, 1, SCENE.w, SCENE.h, "extended");
assert.equal(v1.points.length, 1, "a lone card hangs alone");
assert.equal(vineFor(seat, 0, SCENE.w, SCENE.h, "extended").points.length, 0, "an empty world hangs nothing");
assert.ok(v1.points[0].y > (seat.y / 100) * SCENE.h, "a lone card hangs below its lantern");
assert.ok(
  vineFor(seat, 24, SCENE.w, SCENE.h, "extended").bottom >
    vineFor(seat, 12, SCENE.w, SCENE.h, "extended").bottom,
  "a longer strand reaches deeper",
);

// ── 4. the canvas scrolls when the strand outgrows the panel ──────────────
const vShort = vineFor(seat, 3, SCENE.w, SCENE.h, "extended");
assert.equal(
  vineCanvasHeight(vShort, SCENE.h),
  SCENE.h,
  "a short strand fits the scene — no scroll",
);
const vLong = vineFor(seat, 64, SCENE.w, SCENE.h, "extended");
assert.ok(
  vineCanvasHeight(vLong, SCENE.h) > SCENE.h,
  "a strand that outgrows the panel grows the canvas (the scene scrolls)",
);
assert.equal(
  vineCanvasHeight(vLong, SCENE.h),
  vLong.bottom + VINE.bottomPadding,
  "canvas height = vine tip + breathing room",
);

// ── 5. every hung card stays clamped inside the scene box, in every mode ──
for (const mode of MODES) {
  const cardW = vineCardWidth(mode);
  for (const s of SEAT_POOL) {
    const v = vineFor({ x: s.x, y: s.y, dir: s.x > 66 ? -1 : 1 }, 9, SCENE.w, SCENE.h, mode);
    for (const p of v.points) {
      const box = vineCardBox(p, v.dir, cardW, SCENE.w);
      assert.ok(
        box.left >= VINE.edgeMarginLeft - 0.01 && box.left <= SCENE.w - cardW + VINE.edgeMarginRight + 0.01,
        `${mode} seat ${s.x},${s.y}: card stays inside the scene (left=${box.left.toFixed(1)})`,
      );
      assert.ok(box.top >= 0, `${mode} seat ${s.x},${s.y}: card top in-scene`);
      assert.equal(box.side, v.dir === 1 ? "right" : "left", "side follows the hang direction");
    }
  }
}

// ── 5b. compact mode: 34px pitch, 142px cards, denser than normal ──────────
{
  const vc = vineFor(seat, 2, SCENE.w, SCENE.h, "compact");
  const vn = vineFor(seat, 2, SCENE.w, SCENE.h, "normal");
  assert.ok(vc.bottom < vn.bottom, "compact strand is shorter (tighter pitch) than normal at same count");
  assert.equal(vineCardWidth("compact"), VINE.cardWidthCompact, "compact card width is the dense value");
  assert.equal(vinePitch("compact"), VINE.pitchCompact, "compact pitch is 34px");
}

// ── 6. hang order: running → failed → pending → succeeded ──────────────────
function dj(status, startTime = 0) {
  return {
    sessionId: `${status}-${startTime}`,
    name: "job",
    issue: "1",
    step: "1",
    agentName: "Anon",
    status,
    startTime,
    completionTime: null,
    issueTitle: null,
    branchName: null,
  };
}
const shuffled = [
  dj("succeeded", 500),
  dj("pending", 400),
  dj("failed", 300),
  dj("running", 200),
  dj("succeeded", 100),
  dj("cached", 50),
  dj("purged", 40),
  dj("pending", 600),
  dj("failed", 700),
];
const ranked = [...shuffled].sort(sortJobs);
const expectedStatuses = [
  "running",
  "failed",
  "failed",
  "pending",
  "pending",
  "succeeded",
  "succeeded",
  "cached",
  "purged",
];
assert.deepEqual(
  ranked.map((j) => j.status),
  expectedStatuses,
  "vine hang order: running → failed → pending → succeeded → cached → purged",
);
// stable within a status: newest start first
assert.equal(ranked[1].startTime, 700, "within failed, newest start hangs first");
assert.equal(ranked[3].startTime, 600, "within pending, newest start hangs first");

// ── 7. the status sigil contract — hammer/dice/raven/ring ───────────────────
assert.equal(taskIcon("running"), `${ICON_BASE}hammer.png`, "running forges with the hammer");
assert.equal(taskIcon("pending"), `${ICON_BASE}dice.png`, "pending waits on the dice");
assert.equal(taskIcon("failed"), `${ICON_BASE}raven.png`, "failed flies the raven");
assert.equal(taskIcon("succeeded"), `${ICON_BASE}ring.png`, "succeeded seals with the ring");
for (const s of ["running", "pending", "failed", "succeeded", "cached", "purged"]) {
  assert.ok(taskIconFallback(s).length > 0, `inline fallback exists for ${s}`);
}

console.log("VINE PASS — strand geometry (seat-anchored bezier, extends with job count, never-overlapping at any count in all three modes incl. compact 34px pitch, clamped in-scene, canvas scrolls), hang order (running → failed → pending → succeeded), status sigils (hammer/dice/raven/ring + fallbacks)");
process.exit(0);