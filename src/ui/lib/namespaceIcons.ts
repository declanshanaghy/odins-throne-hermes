// Icons for the namespace drilldown tree — pulled from shanaghy.com's live
// icon library (the source of truth; shipped code always points at the live site).
//
// Curated namespaces get a fitting sigil. Unrecognized namespaces carry the
// generic "?" unknown stone — never a borrowed entity's face.
// `namespaceIcon(nsId, opaque)` returns the transparent overlay set (mid state)
// or the opaque profile-card set (full state); the stone answers the light.
// Task nodes get a small per-status icon (hammer/dice/raven/ring).
// TreeIcon swaps in an inline glyph via onError so an offline panel stays legible.

import type { JobStatus } from "../hooks/useNamespaceSummaries";

/** Opaque (profile-card) icon set — `/assets/icons/` on shanaghy.com. */
export const ICON_BASE = "https://www.shanaghy.com/assets/icons/";
/** Transparent overlay icon set — `/assets/icons/overlay/` on shanaghy.com. */
export const OVERLAY_ICON_BASE = "https://www.shanaghy.com/assets/icons/overlay/";

/** Generic unknown-stone icon filename — used for any unrecognized namespace. */
export const UNKNOWN_STONE = "unknown-stone.png";

/** Curated namespace → icon file (known worlds get a fitting sigil). */
const NAMESPACE_CURATED: Record<string, string> = {
  // Fenrir the wolf, guarder of the ledger
  "fenrir-agents": "wolf-coins.png",
  // Gjallarhorn — every say-so proclaimed aloud
  "say-so-agents": "horn.png",
  // Fionn's Salmon of Knowledge — the truth finder
  "mytruthfinder-agents": "fionn-salmon.png",
  // the knot of sites the web hands are tied with
  "shanaghy-com-agents": "webknot.png",
  // the mown moss of the goatmower's rounds
  "re-goatmower-agents": "mossiah.png",
  // Odin's Throne Hermes agents — the candle on the throne hill
  "odins-throne-hermes-agents": "candle.png",
};

/**
 * Icon URL for a namespace.
 * - Curated namespaces return their fitting sigil from NAMESPACE_CURATED.
 * - Unrecognized namespaces return the generic "?" unknown stone.
 * - `opaque = true` returns the opaque profile-card set (full/active state);
 *   `opaque = false` (default) returns the transparent overlay set (mid state).
 */
export function namespaceIcon(nsId: string, opaque = false): string {
  const file = NAMESPACE_CURATED[nsId] ?? UNKNOWN_STONE;
  return (opaque ? ICON_BASE : OVERLAY_ICON_BASE) + file;
}

/** Small per-status icon for task nodes — the task's "sigil of state". */
const TASK_STATUS_ICONS: Record<JobStatus, string> = {
  running: "hammer.png", // at the forge
  pending: "dice.png", // fate not yet cast
  succeeded: "ring.png", // the oath-ring of a deed done
  failed: "raven.png", // ill omen over the field
  cached: "moon.png", // memory kept under the moon
  purged: "candle.png", // burnt out and swept away
};

export function taskIcon(status: string): string {
  const file = TASK_STATUS_ICONS[status as JobStatus];
  return ICON_BASE + (file ?? "scroll.png");
}

/** Inline fallbacks (offline-safe): emoji glyphs with the same semantics. */
export const NAMESPACE_ICON_FALLBACK = "\u{1F310}"; // 🌐 a world
export function taskIconFallback(status: string): string {
  switch (status) {
    case "running":
      return "\u2692"; // ⚒
    case "pending":
      return "\u23F3"; // ⏳
    case "succeeded":
      return "\u2714"; // ✔
    case "failed":
      return "\u2716"; // ✖
    case "cached":
      return "\u{1F319}"; // 🌙
    case "purged":
      return "\u{1F56F}"; // 🕯
    default:
      return "\u25AA"; // ▪
  }
}
