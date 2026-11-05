// Vine-strand geometry for the tree display's job cards — v3.13 (issue #95).
//
// v3.10.5 (round 13): THE LIST PINS TO ITS LANTERN'S BULB — each lantern
// has a RECORDED popup anchor (LANTERN_ANCHOR, in painting %) that pins the
// job list's top-left corner. The vine emerges from the lantern, curls to the
// anchor column, then descends straight down. Cards hang in a strict vertical
// column at fixed pitch (57px standard / 34px compact).
//
// The geometry is from the approved prototype v3.13.2:
//   design/tree-display/tree-display-prototype.html
//
// Pure functions only — no DOM, no React.

import type { LanternSeat } from "./treeSeats";

/** A point in scene/canvas pixel space. */
export interface Pt {
  x: number;
  y: number;
}

/**
 * Which way the world's display leans. "extended" is the roomy sidebar
 * (bigger cards, wider pitch); "normal" tightens both; "compact" is the
 * dense manual-toggle mode (34px pitch, 142px cards, one-line cards).
 */
export type VineMode = "extended" | "normal" | "compact";

/**
 * Vine + card sizing, verbatim from the prototype's `vineFor`/`.jcard`.
 * Pitch is px between card CENTERS on the column; cards are shorter than the
 * pitch so they never overlap at any job count.
 */
export const VINE = {
  /** px between card centers — extended sidebar (same as standard). */
  pitchExtended: 57,
  /** px between card centers — normal sidebar (same as standard). */
  pitchNormal: 57,
  /** px between card centers — compact (dense) mode. */
  pitchCompact: 34,
  /** Card height in px — standard (measured from the prototype). */
  cardHeightStandard: 47,
  /** Card height in px — compact one-line card. */
  cardHeightCompact: 20,
  /** Column offset: anchor.x - this value = vine descent column. */
  columnOffset: 14,
  /** Px kept clear of the scene's left edge when clamping. */
  edgeMarginLeft: 8,
  /** Px kept clear of the scene's right edge when clamping. */
  edgeMarginRight: 6,
  /** Canvas room below the vine's tip so the last card never clips. */
  bottomPadding: 90,
  /** Card width — extended. */
  cardWidthExtended: 212,
  /** Card width — normal. */
  cardWidthNormal: 190,
  /** Card width — compact (dense) mode. */
  cardWidthCompact: 142,
  /**
   * Minimum px between consecutive card centers — matches the compact pitch
   * so cards never overlap even when the arc is very short.
   */
  minCenterSpacing: 34,
  /** Minimum px between card centers in compact mode. */
  minCenterSpacingCompact: 14,
} as const;

/** The pitch (px between card centers) for a display mode. */
export function vinePitch(mode: VineMode): number {
  if (mode === "compact") return VINE.pitchCompact;
  return mode === "normal" ? VINE.pitchNormal : VINE.pitchExtended;
}

/** The vine card's width (px) for a display mode. */
export function vineCardWidth(mode: VineMode): number {
  if (mode === "compact") return VINE.cardWidthCompact;
  return mode === "normal" ? VINE.cardWidthNormal : VINE.cardWidthExtended;
}

/** A vine-strand's shape plus the anchors its cards hang from. */
export interface VineGeometry {
  /** SVG path `d`: bezier from lantern to anchor column, then straight line down. */
  d: string;
  /** Card anchor points on the vertical descent, one per job, in hang order. */
  points: Pt[];
  /** Which way the strand leans (the seat's dir). */
  dir: 1 | -1;
  /** y of the vine's tip — the deepest point the canvas must cover. */
  bottom: number;
}

/**
 * The vine for one open world — `vineFor(w, n)` from the prototype v3.10.5+.
 *
 * The vine curls from the lantern's projected scene-px center to the
 * LANTERN_ANCHOR pin (also in scene px), then descends straight down a
 * column so cards hang in a strict vertical stack.
 *
 * Card placement: first card's TOP sits exactly at the anchor's y; the first
 * card's CENTER is at anchor.y + cardHeight / 2. Subsequent card centers are
 * spaced `pitch` px below the previous.
 *
 * @param lanternPx  - lantern center in scene px (from projectSeat × scene dims)
 * @param anchorPx   - popup pin in scene px (from projectSeat(LANTERN_ANCHOR[seatIdx]) × scene dims)
 * @param count      - number of jobs to hang
 * @param mode       - display mode (affects pitch and card size)
 * @param sceneW     - scene width in px (for right-edge clamping)
 */
export function vineFor(
  lanternPx: Pt,
  anchorPx: Pt,
  count: number,
  mode: VineMode,
  _sceneW: number,
): VineGeometry {
  const pitch = vinePitch(mode);
  const cardH = mode === "compact" ? VINE.cardHeightCompact : VINE.cardHeightStandard;
  // The vine descends 14px to the left of the popup pin (the card's left edge)
  const column = Math.max(VINE.edgeMarginLeft, anchorPx.x - VINE.columnOffset);
  const firstCenterY = anchorPx.y + cardH / 2;
  const lastCenterY = count > 0 ? firstCenterY + (count - 1) * pitch : anchorPx.y + 46;

  // Single cubic bezier from lantern to anchor-column top, then a straight
  // vertical line down — matches the prototype's vineFor() exactly.
  const midX = (lanternPx.x + anchorPx.x) / 2;
  const d = `M${lanternPx.x.toFixed(1)},${lanternPx.y.toFixed(1)} `
    + `C${midX.toFixed(1)},${(lanternPx.y - 10).toFixed(1)} `
    + `${(column - 4).toFixed(1)},${(anchorPx.y - 14).toFixed(1)} `
    + `${column.toFixed(1)},${anchorPx.y.toFixed(1)} `
    + `L${column.toFixed(1)},${lastCenterY.toFixed(1)}`;

  const points: Pt[] = [];
  for (let i = 0; i < count; i++) {
    points.push({ x: column, y: firstCenterY + i * pitch });
  }

  return {
    d,
    points,
    dir: 1,
    bottom: lastCenterY,
  };
}

/** A hung card's box on the canvas (its top-left), clamped into the scene. */
export interface VineCardBox {
  left: number;
  top: number;
  /** Which side of the anchor the card hangs from (CSS stem direction). */
  side: "right" | "left";
}

/**
 * Where a card sits for one anchor point: at the vine column, clamped so no
 * card ever leaves the scene. `top` is the card's center Y (cards use
 * `transform: translateY(-50%)` in CSS, so `top` = center, not the box top).
 */
export function vineCardBox(
  point: Pt,
  dir: 1 | -1,
  cardWidth: number,
  sceneW: number,
): VineCardBox {
  const left = Math.max(
    VINE.edgeMarginLeft,
    Math.min(sceneW - cardWidth - VINE.edgeMarginRight, point.x),
  );
  return { left, top: point.y, side: dir === 1 ? "right" : "left" };
}

/**
 * The scrollable canvas's height: the scene's own height until the vine
 * outgrows it, then the vine's tip plus breathing room.
 */
export function vineCanvasHeight(vine: VineGeometry, sceneH: number): number {
  return Math.max(sceneH, vine.bottom + VINE.bottomPadding);
}

// LanternSeat re-export kept for callers that import from here (not needed
// by this module but avoids import churn in tightly-coupled files).
export type { LanternSeat };
