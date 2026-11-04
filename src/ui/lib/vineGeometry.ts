// Vine-strand geometry for the tree display's job cards (issue #12, garden
// pattern wave 2, epic #7).
//
// The open world's branch is a CURVED VINE that extends from its lantern's
// seat: a cubic-bezier strand leaning off the lantern (dir ±1 from
// lib/treeSeats.ts) and cascading mostly DOWNWARD, with the world's job
// cards hung along it — evenly spaced, never overlapping, in the approved
// hang order (running → failed → pending → succeeded, via useJobs.sortJobs).
//
// The geometry is copied from the approved interactive prototype on the
// design-tree-display branch (design/tree-display/tree-display-prototype.html,
// `vineFor`): the arc LENGTH grows with the job count (one pitch per extra
// card) so the vine extends as work grows, cards sample the curve at evenly
// spread t values, and every card is clamped inside the scene box. All
// constants live HERE, never in JSX (same rule as treeSeats.ts).
//
// Pure functions only — no DOM, no React — so test/vine.mjs can lock the
// "never overlapping at any job count" and "extends with the job count"
// contracts by construction.

import type { LanternSeat } from "./treeSeats";

/** A point in scene/canvas pixel space. */
export interface Pt {
  x: number;
  y: number;
}

/**
 * Which way the world's display leans. "extended" is the roomy sidebar
 * (bigger cards, wider pitch); "normal" tightens both. Compact mode never
 * renders a vine (initials-chip list instead).
 */
export type VineMode = "extended" | "normal";

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
  /** Horizontal lean of the control points off the lantern (× dir, px). */
  leanC1: 16,
  leanC2: 30,
  /** Horizontal offset of the vine's tip (× dir, px). */
  tipLean: 34,
  /** Vertical arc when a lone card hangs (px). */
  singleArc: 54,
  /** Arc base: arc = base + (count - 1) * pitch — the vine extends per card. */
  arcBase: 40,
  /** First card samples the curve slightly below the lantern. */
  tStart: 0.07,
  /** Cards sample tStart .. tStart + tSpan. */
  tSpan: 0.92,
  /** A lone card hangs at this t. */
  singleT: 0.55,
  /** Card width — extended. */
  cardWidthExtended: 212,
  /** Card width — normal. */
  cardWidthNormal: 190,
  /** Card offset past its anchor point (toward the hang side, px). */
  cardOffset: 14,
  /** Px kept clear of the scene's left edge when clamping. */
  edgeMarginLeft: 8,
  /** Px kept clear of the scene's right edge when clamping. */
  edgeMarginRight: 6,
  /** Canvas room below the vine's tip so the last card never clips. */
  bottomPadding: 90,
  /**
   * Guaranteed minimum px between consecutive card centers on the curve —
   * larger than a card's height in either mode, so cards never overlap.
   */
  minCenterSpacing: 40,
} as const;

/** The pitch (px between card centers) for a display mode. */
export function vinePitch(mode: VineMode): number {
  return mode === "normal" ? VINE.pitchNormal : VINE.pitchExtended;
}

/** The vine card's width (px) for a display mode. */
export function vineCardWidth(mode: VineMode): number {
  return mode === "normal" ? VINE.cardWidthNormal : VINE.cardWidthExtended;
}

/** Cubic bezier point at parameter t (0..1) — the prototype's `bez4`. */
function bez4(t: number, P0: Pt, C1: Pt, C2: Pt, P3: Pt): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * P0.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t * t * t * P3.x,
    y: u * u * u * P0.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t * t * t * P3.y,
  };
}

/** A vine-strand's shape plus the anchors its cards hang from. */
export interface VineGeometry {
  /** SVG path `d`: from the lantern's seat, cascading down. */
  d: string;
  /** Card anchor points on the curve, one per job, in hang order. */
  points: Pt[];
  /** Which way the strand leans (the seat's dir). */
  dir: 1 | -1;
  /** y of the vine's tip — the deepest point the canvas must cover. */
  bottom: number;
}

/**
 * The vine for one open world: a gentle cascade off the lantern's seat —
 * `vineFor(w, n)` from the prototype. The seat arrives in percent-of-scene;
 * the scene's measured pixel box converts it to the canvas space the SVG
 * path and the absolutely-positioned cards share.
 *
 * Cards sample the curve at EVEN VERTICAL intervals (equal y steps along
 * the strand, not equal t): the prototype's t-uniform sampling scrunches
 * near the lantern where the curve runs shallow, dipping under a card's
 * height at high job counts — equal-y spacing keeps every pair of card
 * centers a full even pitch apart, so cards NEVER overlap at any count.
 */
export function vineFor(
  seat: LanternSeat,
  count: number,
  sceneW: number,
  sceneH: number,
  mode: VineMode,
): VineGeometry {
  const L: Pt = { x: (seat.x / 100) * sceneW, y: (seat.y / 100) * sceneH };
  const dir = seat.dir; // which way the cards hang
  const pitch = vinePitch(mode);
  // the vine extends with the job count — one pitch per extra card
  const arc = count <= 1 ? VINE.singleArc : VINE.arcBase + (count - 1) * pitch;
  // a gentle cascade: slight lean off the lantern, mostly downward
  const C1: Pt = { x: L.x + dir * VINE.leanC1, y: L.y + arc * 0.22 };
  const C2: Pt = { x: L.x + dir * VINE.leanC2, y: L.y + arc * 0.55 };
  const P3: Pt = { x: L.x + dir * VINE.tipLean, y: L.y + arc };
  const n = Math.max(count, 0);
  const yOf = (t: number): number => bez4(t, L, C1, C2, P3).y;
  const points: Pt[] = [];
  if (n === 1) {
    points.push(bez4(VINE.singleT, L, C1, C2, P3));
  } else if (n > 1) {
    // even vertical spread: card i centers at yStart + span * i/(n-1)
    const yStart = yOf(VINE.tStart);
    const yEnd = yOf(VINE.tStart + VINE.tSpan);
    for (let i = 0; i < n; i++) {
      const target = yStart + ((yEnd - yStart) * i) / (n - 1);
      // invert the monotonic cascade by bisection on [tStart, tEnd]
      let lo: number = VINE.tStart;
      let hi: number = VINE.tStart + VINE.tSpan;
      for (let step = 0; step < 24; step++) {
        const mid = (lo + hi) / 2;
        if (yOf(mid) < target) lo = mid;
        else hi = mid;
      }
      points.push(bez4((lo + hi) / 2, L, C1, C2, P3));
    }
  }
  return {
    d:
      `M${L.x.toFixed(1)},${L.y.toFixed(1)} ` +
      `C${C1.x.toFixed(1)},${C1.y.toFixed(1)} ` +
      `${C2.x.toFixed(1)},${C2.y.toFixed(1)} ` +
      `${P3.x.toFixed(1)},${P3.y.toFixed(1)}`,
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
 * outgrows it, then the vine's tip plus breathing room — this is what makes
 * the scene SCROLL when the strand extends past the panel (issue #12).
 */
export function vineCanvasHeight(vine: VineGeometry, sceneH: number): number {
  return Math.max(sceneH, vine.bottom + VINE.bottomPadding);
}