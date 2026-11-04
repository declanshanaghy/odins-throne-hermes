// Lantern seat data for the painted tree scene — v3.9 (issue #69).
//
// The contract is the prototype: design/tree-display/tree-display-prototype.html
// on the design-tree-display branch (v3.9.2, commit 83c1a16). The painting is
// 896x1200 (tall portrait, tree in the left third, eleven painted leaf-lanterns
// climbing the full height). Seats are stored in PAINTING percentages; projectSeat()
// maps them into scene % per display mode (cover-center in standard, fill in
// compact) so the stones sit on the painted lanterns at any panel width.
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
   * Which way the world's vine hangs. All vines curl rightward to the branch
   * rail (dir: 1) in the v3.9 layout; kept for interface stability.
   */
  dir: 1 | -1;
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
 * Curated namespace id → painted seat index (VERBATIM from the prototype's
 * CURATED_SEATS, commit 99abad7). Claimed FIRST at runtime so a namespace
 * appearing later in the API list — or an unknown one hashing into the same
 * index — can never steal a curated world's painted lantern.
 */
export const CURATED_SEATS: Record<string, number> = {
  "fenrir-agents": 9,               // 40,37
  "odins-throne-hermes-agents": 8,  // 23,30
  "shanaghy-com-agents": 7,         // 18,40
  "say-so-agents": 6,               // 11,50
  "re-goatmower-agents": 4,         // 30,55
};

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
 * All vines curl rightward to the branch rail (dir: 1). A namespace added
 * in the backend config simply appears here with a seat — zero code changes.
 */
export function assignSeats(nsIds: readonly string[]): Map<string, LanternSeat> {
  const taken = new Set<number>();
  const poolLen = SEAT_POOL.length;
  const seats = new Map<string, LanternSeat>();

  // Pass 1 — curated claims (first claimant in API order wins; two namespaces
  // curated onto the same index is a config error the second one recovers from
  // via the hash pass below).
  for (const id of nsIds) {
    const idx = CURATED_SEATS[id];
    if (idx != null && !Number.isNaN(idx) && !taken.has(idx)) {
      taken.add(idx);
      const p = SEAT_POOL[idx]!;
      seats.set(id, { x: p.x, y: p.y, dir: 1 });
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
    const p = SEAT_POOL[i]!;
    seats.set(id, { x: p.x, y: p.y, dir: 1 });
  }

  return seats;
}

/**
 * Map a painted seat (PAINTING %) to scene % for the given display mode and
 * measured scene box. Called per-lantern at render time (the scene size changes
 * on resize, so this runs inside the React layout effect loop).
 *
 *   compact — painting object-fit: fill (the painting IS the scene box),
 *             so painting % map 1:1 to scene %.
 *   standard — painting object-fit: cover, LEFT-anchored (CSS
 *              object-position: 0% 50%): scale factor k = max(W/896,
 *              H/1200); the painting may overhang on one axis; painting x
 *              maps from the scene's LEFT edge (fl = 0), y passes through
 *              (the painting height dominates when H-limited).
 *
 *              Left-anchor is load-bearing: cover-CENTER put every pool
 *              seat below painting x ~26% at negative scene x in tall
 *              narrow scenes (the ~268px shipped dock scroller) — stones
 *              off-pane, invisible + unclickable, including the ACTIVE
 *              world (v3.9 regression). The tree occupies the painting's
 *              left third, so the left-anchored crop keeps every lantern
 *              on-canvas at any panel width.
 *
 * Returns painting % unchanged when sceneW/H are not yet measured (0).
 */
export function projectSeat(
  p: PaintedSeat,
  mode: "standard" | "compact",
  sceneW: number,
  sceneH: number,
): { x: number; y: number } {
  if (mode === "compact" || sceneW <= 0 || sceneH <= 0) {
    return { x: p.x, y: p.y };
  }
  const k = Math.max(sceneW / 896, sceneH / 1200);
  const dw = 896 * k;
  // LEFT-ANCHORED crop: the CSS pins the painting's left edge to the scene's
  // left edge (object-position: 0% 50%), so painting x 0 == scene x 0.
  const fl = 0;
  const x = (p.x / 100 * dw + fl) / sceneW * 100;
  return { x, y: p.y };
}

/**
 * Convenience seat lookup for a single namespace (compact rows, one-off
 * queries). For seating a full API list always prefer assignSeats() — it
 * guarantees curated claims and collision-walked hash seats across the whole
 * list. A curated id gets its painted lantern either way.
 */
export function namespaceSeat(nsId: string): LanternSeat {
  return assignSeats([nsId]).get(nsId)!;
}
