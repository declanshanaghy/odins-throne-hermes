// Task pips: the small task icons beneath each painted lantern (issue #39).
//
// A namespace's task count reads as a row of tiny status icons under its
// lantern — one icon per task, in the vine hang order (running → failed →
// pending → succeeded), each carrying the task's status sigil (taskIcon).
// Large counts cap: past TASK_PIPS.cap the last slot becomes a "+N"
// overflow chip, so the row never sprawls across the painting.
//
// The row sits on the side AWAY from the open world's vine strand (the
// strand and its cards lean toward the seat's dir), so pips never paint
// over the vine or its first card; a seat near the scene edge narrows the
// row (fewer columns, more lines) so it never clips.
//
// Pure functions only — no DOM, no React — so test/tree-seats.mjs can lock
// the count/overflow and placement contracts. All layout constants live
// HERE, never in JSX (same rule as treeSeats.ts / vineGeometry.ts).

import type { LanternSeat } from "./treeSeats";

/** Task-pip row sizing. */
export const TASK_PIPS = {
  /** Most slots a row shows (pips + the overflow chip, when present). */
  cap: 8,
  /** Pips per line before the row wraps (two lines at the cap). */
  columns: 4,
  /** One pip's box, px (matches .ns-tree__icon--pip). */
  sizePx: 9,
  /** Gap between pips, px (matches .ns-tree__tasks gap). */
  gapPx: 2,
  /** Px kept between the lantern's center line and the row, away from the vine. */
  clearPx: 3,
  /** Px kept clear of the scene's edges when clamping. */
  edgePx: 3,
} as const;

/** One pip: a task's identity + the status its sigil shows. */
export interface TaskPip {
  sessionId: string;
  status: string;
}

/** The pips a lantern shows, plus how many tasks the overflow chip stands for. */
export interface TaskPipRow {
  /** The pips to render, in the order given (callers pass hang order). */
  pips: TaskPip[];
  /** Tasks folded into the "+N" chip (0 = no chip). */
  overflow: number;
  /** The full task count the row represents. */
  count: number;
}

/**
 * Fold a world's tasks (already in hang order, purged excluded) into a pip
 * row: every task gets a pip up to `cap`; beyond it, the first `cap - 1`
 * tasks keep pips and the last slot becomes "+N" for the rest — so the row
 * never exceeds `cap` slots and the visible pips + N always equal the count.
 */
export function taskPips(tasks: readonly TaskPip[], cap: number = TASK_PIPS.cap): TaskPipRow {
  const count = tasks.length;
  const slots = Math.max(1, Math.floor(cap));
  if (count <= slots) {
    return { pips: tasks.map(({ sessionId, status }) => ({ sessionId, status })), overflow: 0, count };
  }
  const shown = slots - 1;
  return {
    pips: tasks.slice(0, shown).map(({ sessionId, status }) => ({ sessionId, status })),
    overflow: count - shown,
    count,
  };
}

/** Rendered slots in a row (pips + the overflow chip). */
export function pipSlots(row: TaskPipRow): number {
  return row.pips.length + (row.overflow > 0 ? 1 : 0);
}

/** A row's width in px for a column count. */
export function pipRowWidth(columns: number): number {
  const cols = Math.max(Math.floor(columns), 0);
  if (cols === 0) return 0;
  return cols * TASK_PIPS.sizePx + (cols - 1) * TASK_PIPS.gapPx;
}

/** Where a pip row sits under its lantern. */
export interface PipRowLayout {
  /** Pips per line (the row wraps onto further lines beyond this). */
  columns: number;
  /** The row's width, px. */
  width: number;
  /** The row's left edge in px RELATIVE TO THE LANTERN'S CENTER. */
  left: number;
}

/**
 * Lay a row of `slots` out beneath a lantern, on the side AWAY from the
 * vine (dir 1 → left of center, dir -1 → right of center), so it never
 * paints over the strand or its cards. A seat near the scene edge narrows
 * the row (fewer columns, more lines) to fit the room on that side; only
 * when not even one column fits does the row clamp back inside the scene.
 * An unmeasured scene (sceneW 0) lays out at full width without clamping.
 */
export function pipRowLayout(seat: LanternSeat, sceneW: number, slots: number): PipRowLayout {
  const want = Math.min(Math.max(Math.floor(slots), 1), TASK_PIPS.columns);
  const awayLeft = (width: number): number =>
    seat.dir === 1 ? -TASK_PIPS.clearPx - width : TASK_PIPS.clearPx;
  if (!(sceneW > 0)) {
    const width = pipRowWidth(want);
    return { columns: want, width, left: awayLeft(width) };
  }
  const seatPx = (seat.x / 100) * sceneW;
  const room =
    (seat.dir === 1 ? seatPx : sceneW - seatPx) - TASK_PIPS.clearPx - TASK_PIPS.edgePx;
  const fit = Math.floor((room + TASK_PIPS.gapPx) / (TASK_PIPS.sizePx + TASK_PIPS.gapPx));
  const columns = Math.max(1, Math.min(want, fit));
  const width = pipRowWidth(columns);
  const minLeft = TASK_PIPS.edgePx - seatPx;
  const maxLeft = sceneW - TASK_PIPS.edgePx - width - seatPx;
  const left = Math.min(Math.max(awayLeft(width), minLeft), Math.max(maxLeft, minLeft));
  return { columns, width, left };
}
