// Remote icon with a graceful offline fallback for the namespace lantern
// tree. Icons load from https://www.shanaghy.com/assets/icons/ via <img>; if
// the fetch fails (offline, DNS gone, icon missing) onError swaps the <img>
// for an inline emoji glyph, so the tree never renders a broken image.
//
// The "lantern" size seats the icon in a painted lantern on the backdrop
// (issues #11 + #39); the "pip" size is one of the tiny task icons in the
// row beneath it (one per task).

import { useState } from "react";

type IconSize = "ns" | "task" | "lantern" | "pip";

interface Props {
  src: string;
  /** Emoji/rune shown when the remote icon fails to load. */
  fallback: string;
  /** "ns" (row, 13px), "task" (task row, 10px), "lantern" (seated in a
   * painted lantern) or "pip" (a task icon beneath the lantern). */
  size?: IconSize;
}

const SIZE_CLASS: Record<IconSize, string> = {
  ns: "",
  task: "ns-tree__icon--task",
  lantern: "ns-tree__icon--lantern",
  pip: "ns-tree__icon--pip",
};

export function TreeIcon({ src, fallback, size = "ns" }: Props) {
  const [failed, setFailed] = useState(false);
  const cls = ["ns-tree__icon", SIZE_CLASS[size]].filter(Boolean).join(" ");

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
