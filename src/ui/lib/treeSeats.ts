// Lantern seat data for the painted tree scene (issues #10 + #11 — garden
// pattern waves 0-1, epic #7).
//
// The tree display's approved contract is the interactive prototype on the
// design-tree-display branch (design/tree-display/tree-display-prototype.html,
// commit 727a108): a painted backdrop (src/ui/assets/tree-backdrop.jpg — the
// identical JPEG embedded in that prototype) with the world's lanterns seated
// at vision-mapped spots on the painting. Seats are expressed as
// PERCENT-OF-SCENE coordinates so the mapping survives any rendered scene size.
//
// Per the issue #11 amendment, the world list is READ FROM THE BACKEND API at
// runtime — never hardcoded — so seats are ASSIGNED at runtime over whatever
// the API returns: curated namespace ids claim their painted lanterns first,
// and unknown worlds take a deterministic djb2-hashed seat from the painted
// pool (the same hash pattern as namespaceIcons.ts). This module is the
// single source of truth for that seating; components call assignSeats() and
// never hard-code layout constants in JSX. Seat values MUST match the
// prototype's SEAT_POOL / CURATED_SEATS verbatim; re-mapping after a repaint
// means editing them here (see src/ui/assets/README.md).

/** A lantern's seat on the painted scene, in percent of scene box. */
export interface LanternSeat {
  /** Horizontal position, % from the scene's left edge (lantern center). */
  x: number;
  /** Vertical position, % from the scene's top edge (lantern center). */
  y: number;
  /**
   * Which way the world's vine hangs off the lantern: 1 = rightward,
   * -1 = leftward. (The prototype's `dir`.)
   */
  dir: 1 | -1;
}

/** Scene geometry the painting and its overlays are sized against. */
export const TREE_SCENE = {
  /** The prototype sidebar's fixed scene width, in px (design reference). */
  sidebarWidthPx: 432,
  /** The backdrop's natural pixel size (896x1200 ≈ 3:4 portrait). */
  backdropWidthPx: 896,
  backdropHeightPx: 1200,
  /** The scene box ratio the painting is composed for (width / height). */
  aspectRatio: 896 / 1200,
} as const;

/** A painted lantern spot on the backdrop, in percent of scene box. */
export interface PaintedSeat {
  x: number;
  y: number;
}

/**
 * The painted lantern seat pool — copied VERBATIM from the prototype's
 * SEAT_POOL (percent-of-scene, in paint order). Worlds claim seats from this
 * pool at runtime; it holds more seats than the prototype's four demo worlds
 * so a backend list of up to eight worlds still seats everyone on a painted
 * lantern.
 */
export const SEAT_POOL: readonly PaintedSeat[] = [
  { x: 8, y: 52 },
  { x: 17, y: 28 },
  { x: 25, y: 22 },
  { x: 41, y: 20 },
  { x: 59, y: 19 },
  { x: 57, y: 37 },
  { x: 76, y: 23 },
  { x: 85, y: 28 },
];

/**
 * Curated namespace id → painted seat index (the prototype's CURATED_SEATS,
 * verbatim). Claimed FIRST at runtime, so a namespace appearing later in the
 * API list — or an unknown one hashing into the same index — can never steal
 * a curated world's painted lantern.
 */
export const CURATED_SEATS: Record<string, number> = {
  "fenrir-agents": 1, // 17,28 — the wolf's lantern on the left bough
  "shanaghy-com-agents": 3, // 41,20
  "say-so-agents": 4, // 59,19
  "odins-throne-hermes-agents": 5, // 57,37
  "re-goatmower-agents": 7, // 85,28 — the right bough's edge lantern
};

/** djb2 — same hash as namespaceIcons.ts: small, fast, stable across runs. */
function hashKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** A lantern's hang direction: rightward until the right bough, then left. */
function dirFor(x: number): 1 | -1 {
  return x > 66 ? -1 : 1;
}

/*
 * Overflow terrace — more worlds than painted seats. The painting has eight
 * lanterns; a longer backend list stacks deterministically BELOW the painted
 * band (4 per row, API order, 10% rows marching down from 64%) so every
 * world still lands on a stable, in-scene seat. The scene scrolls, so the
 * terrace extends as far as the list needs. Constants live here, not in JSX.
 */
const TERRACE_COLUMNS = 4;
const TERRACE_COLUMN_STEP = 24; // % x between terrace columns
const TERRACE_COLUMN_ORIGIN = 15; // % x of the leftmost terrace column
const TERRACE_ROW_ORIGIN = 64; // % y of the first terrace row
const TERRACE_ROW_STEP = 10; // % y between terrace rows

function terraceSeat(overflowIndex: number): LanternSeat {
  const row = Math.floor(overflowIndex / TERRACE_COLUMNS);
  const col = overflowIndex % TERRACE_COLUMNS;
  const x = TERRACE_COLUMN_ORIGIN + col * TERRACE_COLUMN_STEP;
  return { x, y: TERRACE_ROW_ORIGIN + row * TERRACE_ROW_STEP, dir: dirFor(x) };
}

/**
 * Assign a lantern seat to every namespace id, in API order:
 *
 *   1. Curated claims first — reserved painted lanterns, never stealable.
 *   2. Remaining worlds take the djb2-hashed painted seat, walking forward
 *      past already-taken seats (deterministic for a given list).
 *   3. Worlds beyond the painted pool stack on the terrace below the boughs.
 *
 * A namespace added in the backend config simply appears here with a seat —
 * zero code changes. Duplicate ids in the list keep one seat (Map semantics).
 */
export function assignSeats(nsIds: readonly string[]): Map<string, LanternSeat> {
  const taken = new Set<number>();
  const poolLen = SEAT_POOL.length;
  const seats = new Map<string, LanternSeat>();

  // Pass 1 — curated claims (first claimant in API order wins a seat index;
  // two namespaces curated onto the same painted lantern is a config error
  // the second one recovers from via the hash pass below).
  for (const id of nsIds) {
    const idx = CURATED_SEATS[id];
    if (idx != null && !Number.isNaN(idx) && !taken.has(idx)) {
      taken.add(idx);
      const painted = SEAT_POOL[idx]!;
      seats.set(id, { x: painted.x, y: painted.y, dir: dirFor(painted.x) });
    }
  }

  // Pass 2 — hashed claims from the remaining pool, then terrace overflow.
  let overflow = 0;
  for (const id of nsIds) {
    if (seats.has(id)) continue;
    if (taken.size < poolLen) {
      let i = hashKey(id) % poolLen;
      while (taken.has(i)) i = (i + 1) % poolLen;
      taken.add(i);
      const painted = SEAT_POOL[i]!;
      seats.set(id, { x: painted.x, y: painted.y, dir: dirFor(painted.x) });
    } else {
      seats.set(id, terraceSeat(overflow));
      overflow += 1;
    }
  }

  return seats;
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
