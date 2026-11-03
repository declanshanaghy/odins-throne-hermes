// Remote icon with a graceful offline fallback for the namespace lantern
// tree. Icons load from https://www.shanaghy.com/assets/icons/ via <img>; if
// the fetch fails (offline, DNS gone, icon missing) onError swaps the <img>
// for an inline emoji glyph, so the tree never renders a broken image.
//
// The "lantern" size seats the icon INSIDE a lantern node (issue:11): bigger,
// and counter-rotated against the lantern's tilt so the glyph reads upright.

import { useState } from "react";

type IconSize = "ns" | "task" | "lantern";

interface Props {
  src: string;
  /** Emoji/rune shown when the remote icon fails to load. */
  fallback: string;
  /** "ns" (row, 16px), "task" (task row, 12px) or "lantern" (seated in a
   * lantern node — sized + counter-rotated against the lantern's tilt). */
  size?: IconSize;
}

export function TreeIcon({ src, fallback, size = "ns" }: Props) {
  const [failed, setFailed] = useState(false);
  const cls = ["ns-tree__icon", size === "task" ? "ns-tree__icon--task" : "", size === "lantern" ? "ns-tree__icon--lantern" : ""]
    .filter(Boolean)
    .join(" ");

  if (failed) {
    return (
      <span
        className={[cls, "ns-tree__icon--fallback"].filter(Boolean).join(" ")}
        aria-hidden="true"
        data-icon-fallback={fallback}
      >
        {fallback}
      </span>
    );
  }

  return (
    <img
      className={cls}
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
