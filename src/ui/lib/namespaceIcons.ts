// Icons for the namespace drilldown tree — pulled from shanaghy.com's live
// icon library at https://www.shanaghy.com/assets/icons/ (verified 200s).
//
// Namespaces get a curated icon where the fit is obvious; anything unknown
// still gets a deterministic icon by hashing the namespace id into the pool,
// so the tree is never icon-less and never flickers between refreshes.
// Task nodes get a small per-status icon (hammer while running, raven for
// failure, …). The <img> tags load remotely; TreeIcon swaps in an inline
// glyph via onError so an offline panel never shows broken images.

import type { JobStatus } from "../hooks/useNamespaceSummaries";

export const ICON_BASE = "https://www.shanaghy.com/assets/icons/";

/** The root icon library on shanaghy.com — the fallback hash pool. */
export const ICON_POOL: readonly string[] = [
  "raven.png",
  "scroll.png",
  "horn.png",
  "moon.png",
  "ring.png",
  "hammer.png",
  "cauldron.png",
  "dice.png",
  "octopi.png",
  "wolf-coins.png",
  "fianna-watch.png",
  "fionn-salmon.png",
  "gleipnir.png",
  "moss-quiet.png",
  "mossiah.png",
  "moinin.png",
  "sean-chai.png",
  "hal9005.png",
  "the-daykeeper.png",
  "candle.png",
  "smith-odin.png",
  "forge-logo.png",
  "webknot.png",
  "backup-keeper.png",
  "deco.png",
  "zigbee2mqtt.png",
  "cyclone-vacuum.png",
  "front-doorbell.png",
];

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
};

/** djb2 — small, fast, stable across runs. */
function hashKey(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Icon URL for a namespace — curated map first, deterministic hash fallback. */
export function namespaceIcon(nsId: string): string {
  const curated = NAMESPACE_CURATED[nsId];
  if (curated) return ICON_BASE + curated;
  return ICON_BASE + ICON_POOL[hashKey(nsId) % ICON_POOL.length]!;
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
