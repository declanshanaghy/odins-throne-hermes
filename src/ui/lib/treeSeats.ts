// Lantern seat data for the painted tree scene (issue:10 — wave-0 slice of the
// garden pattern, epic #7).
//
// The tree display's approved contract is the interactive prototype on the
// design-tree-display branch (design/tree-display/tree-display-prototype.html):
// a painted backdrop (src/ui/assets/tree-backdrop.jpg — the identical JPEG
// embedded in that prototype) with JSON-mapped overlays. Each namespace is a
// "world" whose lantern hangs at a vision-mapped seat on the painting,
// expressed as PERCENT-OF-SCENE coordinates so the mapping survives any
// rendered scene size (432px sidebar in the prototype, fluid in the pane).
//
// This module is the single source of truth for those seats — components read
// it via namespaceSeat() and never hard-code layout constants in JSX. Seat
// values MUST match the prototype's WORLDS array verbatim; re-mapping after a
// repaint means editing WORLD_SEATS here (see src/ui/assets/README.md).

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

/**
 * Vision-mapped lantern seats for the prototype's four worlds — copied
 * VERBATIM from the prototype's WORLDS array (percent-of-scene, per world).
 * Keys are the prototype's world ids; the repo's live namespace ids are
 * bridged by NAMESPACE_WORLD below.
 */
export const WORLD_SEATS: Record<string, LanternSeat> = {
  fenrir: { x: 17, y: 28, dir: 1 }, // Fenrir Ledger Agents
  hills: { x: 41, y: 20, dir: 1 }, // Summer Hills Watch
  sayso: { x: 59, y: 19, dir: 1 }, // SaySo Agents
  hearth: { x: 85, y: 28, dir: -1 }, // Mossy Hearth Agents
};

/**
 * Repo namespace id → prototype world id. Curated like the icon map in
 * namespaceIcons.ts; a namespace without an entry gets a deterministic
 * fallback seat (below) until its lantern is vision-mapped onto the painting.
 */
const NAMESPACE_WORLD: Record<string, string> = {
  "fenrir-agents": "fenrir",
  "say-so-agents": "sayso",
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
 * Deterministic fallback seat for namespaces not yet vision-mapped: a stable
 * pseudo-random spot inside the painted bough band (roughly the upper fifth
 * to third of the scene, where the prototype's lanterns hang). Identical on
 * every render and refresh, like the icon hash fallback.
 */
function fallbackSeat(nsId: string): LanternSeat {
  const h = hashKey(nsId);
  return {
    x: 8 + (h % 78), // 8–86 % — clear of both panel edges
    y: 16 + (Math.floor(h / 32) % 14), // 16–30 % — the lantern bough band
    dir: h % 2 === 0 ? 1 : -1,
  };
}

/**
 * The lantern seat for a namespace — curated prototype mapping first,
 * deterministic fallback for worlds not yet mapped onto the painting.
 */
export function namespaceSeat(nsId: string): LanternSeat {
  const world = NAMESPACE_WORLD[nsId];
  const seat = world ? WORLD_SEATS[world] : undefined;
  return seat ?? fallbackSeat(nsId);
}
