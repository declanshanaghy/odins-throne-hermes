// Remote icon with a graceful offline fallback for the namespace drilldown
// tree. Icons load from https://www.shanaghy.com/assets/icons/ via <img>; if
// the fetch fails (offline, DNS gone, icon missing) onError swaps the <img>
// for an inline emoji glyph, so the tree never renders a broken image.

import { useState } from "react";

interface Props {
  src: string;
  /** Emoji/rune shown when the remote icon fails to load. */
  fallback: string;
  /** "ns" (namespace row, 16px) or "task" (task row, 12px). */
  size?: "ns" | "task";
}

export function TreeIcon({ src, fallback, size = "ns" }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={
          size === "task"
            ? "ns-tree__icon ns-tree__icon--task ns-tree__icon--fallback"
            : "ns-tree__icon ns-tree__icon--fallback"
        }
        aria-hidden="true"
        data-icon-fallback={fallback}
      >
        {fallback}
      </span>
    );
  }

  return (
    <img
      className={
        size === "task" ? "ns-tree__icon ns-tree__icon--task" : "ns-tree__icon"
      }
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
