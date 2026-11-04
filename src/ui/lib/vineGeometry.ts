// Vine-strand geometry for the tree display's job cards — v3.9 (issue #69).
//
// The open world's branch is a TWO-SEGMENT CURVED VINE that extends from its
// lantern's seat: the first bezier curls out to a fixed BRANCH RAIL at 44% of
// the scene width, the second descends the rail so cards stack downward through
// the right half, never crowding the painted tree. Cards hang along the second
// segment; the whole scene (painting + stones + vine) scrolls together.
//
// The geometry is from the approved prototype (design/tree-display/
// tree-display-prototype.html, v3.9, commit 99abad7). All constants live here.
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
 * Pitch is px between card CENTERS on the curve; cards are shorter than the
 * pitch, so they can never overlap at any job count.
 */
export const VINE = {
  /** px between card centers — extended sidebar. */
  pitchExtended: 57,
  /** px between card centers — normal sidebar. */
  pitchNormal: 56,
  /** px between card centers — compact (dense) mode. */
  pitchCompact: 34,
  /** Branch rail x as a fraction of scene width (44%). */
  railFrac: 0.44,
  /** px below the lantern where the first bezier reaches the rail. */
  railJoinDrop: 36,
  /** Vertical arc (second bezier) base: arc = base + (count - 1) * pitch. */
  arcBase: 40,
  /** Vertical arc for a lone card. */
  singleArc: 54,
  /** t-start for card sampling on the second bezier segment. */
  tStart: 0.05,
  /** t-span for card sampling: cards are spread from tStart to tStart + tSpan. */
  tSpan: 0.93,
  /** Card width — extended. */
  cardWidthExtended: 212,
  /** Card width — normal. */
  cardWidthNormal: 190,
  /** Card width — compact (dense) mode. */
  cardWidthCompact: 142,
  /** Card offset past its anchor point (toward the hang side, px). */
  cardOffset: 14,
  /** Px kept clear of the scene's left edge when clamping. */
  edgeMarginLeft: 8,
  /** Px kept clear of the scene's right edge when clamping. */
  edgeMarginRight: 6,
  /** Canvas room below the vine's tip so the last card never clips. */
  bottomPadding: 90,
  /**
   * Guaranteed minimum px between consecutive card centers — larger than a
   * card's height in normal/extended mode, so cards never overlap.
   */
  minCenterSpacing: 24,
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

/** Cubic bezier point at parameter t (0..1). */
function bez4(t: number, P0: Pt, C1: Pt, C2: Pt, P3: Pt): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * P0.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t * t * t * P3.x,
    y: u * u * u * P0.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t * t * t * P3.y,
  };
}

/** A vine-strand's shape plus the anchors its cards hang from. */
export interface VineGeometry {
  /** SVG path `d`: two cubic beziers — lantern → rail join → descend. */
  d: string;
  /** Card anchor points on the second bezier, one per job, in hang order. */
  points: Pt[];
  /** Which way the strand leans (the seat's dir). */
  dir: 1 | -1;
  /** y of the vine's tip — the deepest point the canvas must cover. */
  bottom: number;
}

/**
 * The vine for one open world — `vineFor(w, n)` from the prototype (v3.9).
 *
 * The seat arrives in scene % (PAINTING % already projected by projectSeat()
 * before this call). The scene's measured pixel box converts it to canvas px.
 *
 * Two cubic bezier segments:
 *   1. Lantern (L) → rail join (J) at 44% sceneW.
 *   2. Rail join (J) → tip (P3) descending the rail; cards hang along this.
 */
export function vineFor(
  seat: LanternSeat,
  count: number,
  sceneW: number,
  sceneH: number,
  mode: VineMode,
): VineGeometry {
  const L: Pt = { x: (seat.x / 100) * sceneW, y: (seat.y / 100) * sceneH };
  const dir = seat.dir;
  const pitch = vinePitch(mode);
  const arc = count <= 1 ? VINE.singleArc : VINE.arcBase + (count - 1) * pitch;
  const railX = sceneW * VINE.railFrac;

  // First bezier: lantern → rail join
  const J: Pt = { x: railX, y: L.y + VINE.railJoinDrop };
  const C1: Pt = { x: railX, y: L.y + 14 };
  // d string: M L.x,L.y C C1.x,C1.y railX,(J.y-16) J.x,J.y
  const seg1 = `M${L.x.toFixed(1)},${L.y.toFixed(1)} C${C1.x.toFixed(1)},${C1.y.toFixed(1)} ${railX.toFixed(1)},${(J.y - 16).toFixed(1)} ${J.x.toFixed(1)},${J.y.toFixed(1)}`;

  // Second bezier: rail join → descend (cards hang here)
  const D1: Pt = { x: railX, y: J.y + arc * 0.34 };
  const D2: Pt = { x: railX + 10 * dir, y: J.y + arc * 0.68 };
  const P3: Pt = { x: railX + 6 * dir, y: J.y + arc };
  const seg2 = ` C${D1.x.toFixed(1)},${D1.y.toFixed(1)} ${D2.x.toFixed(1)},${D2.y.toFixed(1)} ${P3.x.toFixed(1)},${P3.y.toFixed(1)}`;

  const n = Math.max(count, 0);
  const points: Pt[] = [];
  if (n === 1) {
    points.push(bez4(0.5, J, D1, D2, P3));
  } else if (n > 1) {
    for (let i = 0; i < n; i++) {
      const t = VINE.tStart + VINE.tSpan * (i / (n - 1));
      points.push(bez4(t, J, D1, D2, P3));
    }
  }

  return {
    d: seg1 + seg2,
    points,
    dir,
    bottom: P3.y,
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
 * Where a card sits for one anchor point: past the point toward the hang
 * side, vertically centered on it — clamped so no card ever leaves the
 * scene (the prototype's `left` math). `top` centers the card on the
 * anchor via translateY(-50%) in CSS.
 */
export function vineCardBox(
  point: Pt,
  dir: 1 | -1,
  cardWidth: number,
  sceneW: number,
): VineCardBox {
  const raw = dir === 1 ? point.x + VINE.cardOffset : point.x - VINE.cardOffset - cardWidth;
  const left = Math.max(
    VINE.edgeMarginLeft,
    Math.min(Math.max(sceneW - cardWidth - VINE.edgeMarginRight, VINE.edgeMarginLeft), raw),
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
