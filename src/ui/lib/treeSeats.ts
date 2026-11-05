// Lantern seat data for the painted tree scene — v3.9 (issue #69).
//
// The contract is the prototype: design/tree-display/tree-display-prototype.html
// on the design-tree-display branch (v3.9.2, commit 83c1a16). The painting is
// 896x1200 (tall portrait, tree in the left third, eleven painted leaf-lanterns
// climbing the full height). Seats are stored in PAINTING percentages; projectSeat()
// maps them into scene % (cover-center, left-anchored) so the stones sit on the
// painted lanterns at any panel width, in both standard and compact display modes.
//
// Seat assignment: curated namespace ids claim painted lanterns first (never
// stealable); unknown worlds take a deterministic djb2-hashed seat from the
// pool; when the tree is full (11 worlds) every additional world shares the last
// painted lantern rather than looping. This module is the single source of truth
// for seating; components call assignSeats() and never hard-code layout constants
// in JSX. Seat values MUST match the prototype's SEAT_POOL / CURATED_SEATS
// verbatim; re-mapping after a repaint means editing them here (see README.md).

/** A lantern's seat — coordinates are PAINTING %, not scene %. Use projectSeat() before positioning. */
export interface LanternSeat {
  /** Horizontal position, % from the painting's left edge (lantern center). */
  x: number;
  /** Vertical position, % from the painting's top edge (lantern center). */
  y: number;
  /**
   * Which way the world's vine hangs. All vines curl rightward in the v3.13
   * layout; kept for interface stability.
   */
  dir: 1 | -1;
  /** Index into SEAT_POOL (0–10). Used to look up LANTERN_ANCHOR and LANTERN_SIZE. */
  seatIdx: number;
}

/** Scene geometry the painting and its overlays are sized against. */
export const TREE_SCENE = {
  /** The prototype sidebar's fixed scene width, in px (design reference). */
  sidebarWidthPx: 432,
  /** The backdrop's natural pixel size (896x1200 ≈ 3:4 tall portrait). */
  backdropWidthPx: 896,
  backdropHeightPx: 1200,
  /** The scene box ratio the painting is composed for (width / height). */
  aspectRatio: 896 / 1200,
} as const;

/** A painted lantern spot on the backdrop, in PAINTING percent. */
export interface PaintedSeat {
  x: number;
  y: number;
}

/**
 * The eleven painted lantern seats — VERBATIM from the prototype's SEAT_POOL
 * (commit 83c1a16, v3.9.2 — bright-spot centroids detected by
 * scripts/detect-lanterns.py; the hand-visioned v3.9 pool had drifted).
 * Stored in PAINTING %; use projectSeat() to convert
 * to scene % before positioning. Max 11 active namespaces (one per lantern).
 */
export const SEAT_POOL: readonly PaintedSeat[] = [
  { x: 40, y: 73 }, { x: 16, y: 69 }, { x: 46, y: 68 }, { x: 10, y: 64 },
  { x: 30, y: 55 }, { x: 37, y: 50 }, { x: 11, y: 50 }, { x: 18, y: 40 },
  { x: 23, y: 30 }, { x: 40, y: 37 }, { x: 47, y: 33 },
];

/**
 * The parchment painting's eleven amber lantern seats — VERBATIM from the
 * prototype's SEAT_POOL_LIGHT (v3.17, round 25, commit 1dbbe8a). Pixel-detected
 * on the CLEAN ground backdrop-parchment.jpg by detect-lanterns-parchment.py
 * (warm amber-core mask + glow-blob local contrast, left-half bounded per the
 * composition contract), cross-checked by ONE Gemini clean-ground pass —
 * PIXELS WIN (the oracle's absolute centers run biased; it contributed count +
 * x-extent sanity). Painting % — the SAME projectSeat() cover LEFT-anchored
 * crop carries them, no new math. Pixel provenance (painting px, centroid):
 *   0:(333,894); 1:(252,836); 2:(364,835); 3:(271,697); 4:(130,681);
 *   5:(331,622); 6:(369,577); 7:(447,550); 8:(148,484); 9:(387,414); 10:(234,322)
 */
export const SEAT_POOL_LIGHT: readonly PaintedSeat[] = [
  { x: 37.15, y: 74.51 }, { x: 28.07, y: 69.63 }, { x: 40.65, y: 69.61 },
  { x: 30.2, y: 58.12 }, { x: 14.51, y: 56.75 }, { x: 36.92, y: 51.86 },
  { x: 41.14, y: 48.06 }, { x: 49.88, y: 45.82 }, { x: 16.47, y: 40.35 },
  { x: 43.21, y: 34.53 }, { x: 26.13, y: 26.87 },
];

/**
 * Curated namespace id → painted seat index (VERBATIM from the prototype's
 * CURATED_SEATS, commit 99abad7). Claimed FIRST at runtime so a namespace
 * appearing later in the API list — or an unknown one hashing into the same
 * index — can never steal a curated world's painted lantern. Seat indices are
 * shared by BOTH pools (a realm keeps its seat INDEX when the theme flips —
 * it re-seats onto the active painting's own lantern).
 */
export const CURATED_SEATS: Record<string, number> = {
  "fenrir-agents": 9,               // 40,37
  "odins-throne-hermes-agents": 8,  // 23,30
  "shanaghy-com-agents": 7,         // 18,40
  "say-so-agents": 6,               // 11,50
  "re-goatmower-agents": 4,         // 30,55
};

/**
 * Per-lantern popup pin in PAINTING % — the top-left corner of the job list
 * pins here when a world expands (v3.10.5, round 13 of the prototype).
 * Derived: anchor = bright-spot centroid + belly half-width (22*(w/38) path
 * units scaled per LANTERN_SIZE) + 12px stem gap; y = belly center.
 * Provenance (painting px, from detect-lanterns.py centroids):
 *   0:(391,883) 1:(179,836) 2:(438,821) 3:(122,777) 4:(298,665)
 *   5:(362,598) 6:(133,599) 7:(193,488) 8:(239,363) 9:(390,445) 10:(456,396)
 */
export const LANTERN_ANCHOR: readonly PaintedSeat[] = [
  { x: 43.7, y: 73.5 }, { x: 20.0, y: 69.7 }, { x: 48.9, y: 68.4 },
  { x: 13.6, y: 64.7 }, { x: 33.2, y: 55.4 }, { x: 40.4, y: 49.8 },
  { x: 14.9, y: 49.9 }, { x: 21.5, y: 40.7 }, { x: 26.7, y: 30.2 },
  { x: 43.5, y: 37.1 }, { x: 50.9, y: 33.0 },
];

/**
 * Per-lantern popup pin for the LIGHT pool in PAINTING % — VERBATIM from the
 * prototype's LANTERN_ANCHOR_LIGHT (v3.17, round 25). Each parchment bulb's
 * right edge (centroid + core half-width + 12px stem gap, y = centroid + 3),
 * same derivation as LANTERN_ANCHOR.
 */
export const LANTERN_ANCHOR_LIGHT: readonly PaintedSeat[] = [
  { x: 40.3, y: 74.8 }, { x: 32.1, y: 69.9 }, { x: 44.3, y: 69.9 },
  { x: 33.2, y: 58.4 }, { x: 18.5, y: 57.0 }, { x: 41.1, y: 52.1 },
  { x: 44.2, y: 48.3 }, { x: 53.3, y: 46.1 }, { x: 19.5, y: 40.6 },
  { x: 46.8, y: 34.8 }, { x: 29.3, y: 27.1 },
];

/**
 * Per-seat measured lantern sizes in painting px, bright-core w/h from
 * scripts/detect-lanterns.py on the CURRENT backdrop, mapped to SEAT_POOL
 * index order. Each veil/glow/ring scales to its own lantern's shape.
 * Base path is a 38×73-core teardrop (LANTERN_PATH).
 */
export const LANTERN_SIZE: readonly { w: number; h: number }[] = [
  { w: 40, h: 79 }, { w: 38, h: 74 }, { w: 32, h: 68 }, { w: 31, h: 66 },
  { w: 34, h: 68 }, { w: 39, h: 76 }, { w: 35, h: 71 }, { w: 36, h: 71 },
  { w: 38, h: 71 }, { w: 40, h: 76 }, { w: 34, h: 70 },
];

/**
 * Per-seat measured silhouettes for the parchment lanterns — VERBATIM from the
 * prototype's LANTERN_SIZE_LIGHT (v3.17, round 25): core-extent w/h clamped to
 * the teardrop's sane range, mapped to SEAT_POOL_LIGHT index order.
 */
export const LANTERN_SIZE_LIGHT: readonly { w: number; h: number }[] = [
  { w: 28, h: 50 }, { w: 41, h: 53 }, { w: 36, h: 51 }, { w: 26, h: 50 },
  { w: 41, h: 54 }, { w: 44, h: 68 }, { w: 26, h: 50 }, { w: 32, h: 54 },
  { w: 26, h: 54 }, { w: 34, h: 50 }, { w: 28, h: 51 },
];

/** Which painting's lanterns seat the realms — dark = the moonlit tree, light = the parchment tree. */
export type SeatTheme = "dark" | "light";

/** The ACTIVE seat pool for a theme (v3.17: dark SEAT_POOL or light SEAT_POOL_LIGHT). */
export function seatPoolFor(theme: SeatTheme): readonly PaintedSeat[] {
  return theme === "light" ? SEAT_POOL_LIGHT : SEAT_POOL;
}

/** The ACTIVE popup anchors for a theme. */
export function lanternAnchorsFor(theme: SeatTheme): readonly PaintedSeat[] {
  return theme === "light" ? LANTERN_ANCHOR_LIGHT : LANTERN_ANCHOR;
}

/** The ACTIVE per-seat silhouettes for a theme. */
export function lanternSizesFor(theme: SeatTheme): readonly { w: number; h: number }[] {
  return theme === "light" ? LANTERN_SIZE_LIGHT : LANTERN_SIZE;
}

/**
 * SVG path tracing the painted lantern silhouette — a teardrop with neck/cap
 * and drop tip, measured off the backdrop's bright cores (54×83 core,
 * ~62×111 silhouette in painting px). Centered at 0,0; scale per LANTERN_SIZE
 * before positioning. All three light shapes (veil, glow, ring) use this path.
 */
export const LANTERN_PATH =
  "M0,-42 C4,-42 6,-40 6,-37 C6,-35 5,-33 4,-31 C11,-28 19,-20 21,-11 "
  + "C22,-4 22,7 19,18 C16,27 10,35 6,39 C4,41 2,42 0,42 C-2,42 -4,41 -6,39 "
  + "C-10,35 -16,27 -19,18 C-22,7 -22,-4 -21,-11 C-19,-20 -11,-28 -4,-31 "
  + "C-5,-33 -6,-35 -6,-37 C-6,-40 -4,-42 0,-42 Z";

/** djb2 — same hash as namespaceIcons.ts: small, fast, stable across runs. */
function hashKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Assign a lantern seat to every namespace id, in API order:
 *
 *   1. Curated claims first — reserved painted lanterns, never stealable.
 *   2. Remaining worlds take a djb2-hashed painted seat, walking forward
 *      past already-taken seats (deterministic for a given list).
 *   3. When all 11 lanterns are claimed every additional world shares the
 *      last painted lantern (tree full, guard against infinite loop).
 *
 * All vines curl rightward (dir: 1). A namespace added in the backend config
 * simply appears here with a seat — zero code changes.
 *
 * Theme (v3.17, issue #123): every realm keeps its seat INDEX across themes
 * but re-seats onto the ACTIVE painting's own lantern — pass "light" to seat
 * on SEAT_POOL_LIGHT (the parchment tree), omit / "dark" for SEAT_POOL. The
 * projection downstream is the SAME projectSeat() in both themes.
 */
export function assignSeats(
  nsIds: readonly string[],
  theme: SeatTheme = "dark",
): Map<string, LanternSeat> {
  const pool = seatPoolFor(theme);
  const taken = new Set<number>();
  const poolLen = pool.length;
  const seats = new Map<string, LanternSeat>();

  // Pass 1 — curated claims (first claimant in API order wins; two namespaces
  // curated onto the same index is a config error the second one recovers from
  // via the hash pass below).
  for (const id of nsIds) {
    const idx = CURATED_SEATS[id];
    if (idx != null && !Number.isNaN(idx) && !taken.has(idx)) {
      taken.add(idx);
      const p = pool[idx]!;
      seats.set(id, { x: p.x, y: p.y, dir: 1, seatIdx: idx });
    }
  }

  // Pass 2 — hashed claims from the remaining pool; share the last lantern
  // when the tree is full (guard: no looping beyond the pool).
  for (const id of nsIds) {
    if (seats.has(id)) continue;
    let i = hashKey(id) % poolLen;
    let guard = 0;
    while (taken.has(i) && guard++ < poolLen) i = (i + 1) % poolLen;
    if (taken.has(i)) i = poolLen - 1; // tree full — share the last lantern
    taken.add(i);
    const p = pool[i]!;
    seats.set(id, { x: p.x, y: p.y, dir: 1, seatIdx: i });
  }

  return seats;
}

/**
 * Map a painted seat (PAINTING %) to scene % for the measured scene box.
 * Called per-lantern at render time (the scene size changes on resize, so this
 * runs inside the React layout effect loop). Identical in standard and compact
 * display modes — compact affects the vine card list only, not the tree.
 *
 * Painting object-fit: cover, LEFT-anchored (CSS object-position: 0% 50%):
 * scale factor k = max(W/896, H/1200); painting x maps from the scene's LEFT
 * edge (fl = 0), y passes through (painting height dominates when H-limited).
 *
 * Left-anchor is load-bearing: cover-CENTER put every pool seat below painting
 * x ~26% at negative scene x in tall narrow scenes (the ~268px shipped dock
 * scroller) — stones off-pane, invisible + unclickable, including the ACTIVE
 * world (v3.9 regression). The tree occupies the painting's left third, so the
 * left-anchored crop keeps every lantern on-canvas at any panel width.
 *
 * Returns painting % unchanged when sceneW/H are not yet measured (0).
 */
export function projectSeat(
  p: PaintedSeat,
  sceneW: number,
  sceneH: number,
): { x: number; y: number } {
  if (sceneW <= 0 || sceneH <= 0) {
    return { x: p.x, y: p.y };
  }
  const k = Math.max(sceneW / 896, sceneH / 1200);
  const dw = 896 * k;
  const dh = 1200 * k;
  // LEFT-ANCHORED crop: the CSS pins the painting's left edge to the scene's
  // left edge (object-position: 0% 50%), so painting x 0 == scene x 0.
  const fl = 0;
  // VERTICALLY-CENTERED crop (the same object-position's 50% y): in a
  // WIDTH-limited scene (k = W/896) the painting overhangs the scene top AND
  // bottom, and the crop centers it — y maps through dh with offset
  // ft = (H - dh)/2, NOT passthrough. The v3.9 port dropped this half
  // (prototype v3.9.1 carried it), so every top seat rendered low by
  // (py% - 50%)·(H - dh) in wide/short scenes — odins-throne, fenrir and the
  // top-right lantern sat ~50-100px under their painted lanterns. In a
  // height-limited scene dh == H, ft == 0 and y passes through unchanged.
  const ft = (sceneH - dh) / 2;
  const x = (p.x / 100 * dw + fl) / sceneW * 100;
  const y = (p.y / 100 * dh + ft) / sceneH * 100;
  return { x, y };
}

/**
 * Convenience seat lookup for a single namespace (compact rows, one-off
 * queries). For seating a full API list always prefer assignSeats() — it
 * guarantees curated claims and collision-walked hash seats across the whole
 * list. A curated id gets its painted lantern either way.
 */
export function namespaceSeat(nsId: string, theme: SeatTheme = "dark"): LanternSeat {
  return assignSeats([nsId], theme).get(nsId)!;
}
