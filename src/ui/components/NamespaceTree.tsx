// Namespace lantern tree (issues #11, #12, #39, #59, #69, #90, #95) — v3.13.2
//
// v3.13.2 (issue #95): full port of the approved prototype.
//
// Light states (v3.10): one .lshapes SVG under the buttons, one <g class="lseat">
// per SEAT_POOL index (all 11 — seated or not). Three states:
//   OFF  — no namespace seated: dark veil + halo multiply
//   MID  — seated, list closed: soft screen-blend glow
//   FULL — clicked world, vine showing: glow 1.0 + teal ring; stone → opaque
//
// Vine (v3.10.5): job list pins to its lantern's LANTERN_ANCHOR bulb. The vine
// emerges from the lantern, curls to the recorded anchor pin, then descends
// straight down at 57px pitch (standard) / 34px (compact).
//
// World title (v3.13): glass panel above the topmost lanterns showing the last-
// seated world's name, stats, garden band (opaque stone + ringfort lore), and
// kin pills. Deactivation fades to 50%; next selection repaints at 100%.
//
// Dead space (v3.10.9): click anywhere in the scene that isn't an interactive
// element deactivates the active lantern immediately.
//
// Empty-world rest (v3.10.7): a taskless world holds FULL state for 2s, then
// deactivates itself. Any click cancels the timer.

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import type { DisplayJob, Job } from "../lib/types";
import type { NamespaceOption } from "../hooks/useNamespace";
import { summaryLine, type NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { parseJob, sortJobs } from "../hooks/useJobs";
import {
  namespaceIcon,
  NAMESPACE_ICON_FALLBACK,
  taskIcon,
  taskIconFallback,
} from "../lib/namespaceIcons";
import {
  assignSeats,
  projectSeat,
  SEAT_POOL,
  LANTERN_ANCHOR,
  LANTERN_SIZE,
  LANTERN_PATH,
} from "../lib/treeSeats";
import { taskPips, pipStripLeft, pipStripWidth } from "../lib/taskPips";
import {
  vineFor,
  vineCardBox,
  vineCardWidth,
  vineCanvasHeight,
  type VineMode,
} from "../lib/vineGeometry";
import treeBackdrop from "../assets/tree-backdrop.jpg";
import { TreeIcon } from "./TreeIcon";
import { VineCard, isCancellable } from "./VineCard";
import { WorldTitle } from "./WorldTitle";
import type { DisplayMode } from "./Sidebar";

interface Props {
  namespace: string;
  namespaces: NamespaceOption[];
  summaries: NamespaceSummaries;
  onNamespaceChange: (ns: string) => void;
  /** Drilldown task click — same selection semantics as the vine cards. */
  onSelectTask: (nsId: string, sessionId: string, job?: DisplayJob) => void;
  activeSessionId: string | null;
  displayMode: DisplayMode;
  /** Job-card interactions, threaded through from the Sidebar. */
  onAvatarClick?: (agentKey: string) => void;
  onTogglePinSession?: (sessionId: string) => void;
  pinnedSessionIds?: Set<string>;
  onCancelJob?: (sessionId: string, job: DisplayJob) => void;
  terminatingSessionIds?: Set<string>;
}

/**
 * The open world's strand: the summary fetch's raw job list, parsed to
 * DisplayJobs and hung in the vine order (running → failed → pending →
 * succeeded). Purged jobs are excluded.
 */
function tasksOf(summaryJobs: Job[] | undefined) {
  if (!summaryJobs) return [];
  return summaryJobs
    .filter((job) => job.status !== "purged")
    .map(parseJob)
    .sort(sortJobs);
}

/** A lantern's hover/focus label line — "…" until the summary lands. */
function labelLineOf(summary: NamespaceSummaries[string] | undefined): string {
  if (!summary) return "…";
  if (summary.error) return "summary unavailable";
  return summaryLine(summary);
}

/** A note pill's position near the seat, in percent of scene. */
function notePos(seat: { x: number; y: number }, angleDeg: number): CSSProperties {
  const ang = (angleDeg * Math.PI) / 180;
  const r = 11;
  return {
    left: `${Math.min(88, seat.x + Math.cos(ang) * r)}%`,
    top: `${Math.max(7, seat.y + Math.sin(ang) * r)}%`,
  };
}

/** A swept card's ghost lingers for the fall animation, then is gone. */
const FALL_MS = 900;

interface FallingCard {
  job: DisplayJob;
  left: number;
  top: number;
  side: "right" | "left";
}

/** Interactive element selectors — dead-space clicks on these never deselect. */
const INTERACTIVE_SELECTORS =
  "button, .jcard, .jact, .anchor-ic, .ns-tree__counts, .ns-tree__note, .piprow, .wtitle__kin-pill";

export function NamespaceTree({
  namespace,
  namespaces,
  summaries,
  onNamespaceChange,
  onSelectTask,
  activeSessionId,
  displayMode,
  onTogglePinSession,
  pinnedSessionIds,
  onCancelJob,
  terminatingSessionIds,
}: Props) {
  const isCompact = displayMode === "compact";
  // Painting-% seats assigned at runtime; projectSeat() maps to scene % before use.
  const seats = useMemo(
    () => assignSeats(namespaces.map((ns) => ns.id)),
    [namespaces],
  );
  // Strict accordion: the one world whose vine is open (null = collapsed).
  const [openNs, setOpenNs] = useState<string | null>(namespace);
  const [hoveredNs, setHoveredNs] = useState<string | null>(null);
  // v3.13: last-seated world — survives deactivation (dims to 50%, never wiped)
  const [titleWorldId, setTitleWorldId] = useState<string | null>(null);

  // ── scene measurement: vine geometry + projectSeat need the scene box in px ──
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [sceneSize, setSceneSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSceneSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // No orphan states: a world gone from the API list closes its vine.
  useEffect(() => {
    setOpenNs((prev) => (prev && namespaces.some((ns) => ns.id === prev) ? prev : null));
  }, [namespaces]);

  // v3.13: update titleWorld whenever a world is selected (never on deselect)
  useEffect(() => {
    if (openNs) setTitleWorldId(openNs);
  }, [openNs]);

  /**
   * Clicking a stone SELECTS the world (same as the old dropdown) and toggles
   * the accordion: the open world collapses, any other world grows its vine.
   */
  const selectWorld = (nsId: string) => {
    onNamespaceChange(nsId);
    const opening = openNs !== nsId;
    setOpenNs((prev) => (prev === nsId ? null : nsId));
    if (opening) scrollerRef.current?.scrollTo?.({ top: 0 });
  };

  // v3.10.9: dead-space click deactivates the active lantern
  const handleSceneClick = (e: React.MouseEvent) => {
    if (openNs === null) return;
    const target = e.target as Element;
    if (target.closest(INTERACTIVE_SELECTORS)) return;
    setOpenNs(null);
  };

  const openWorld = namespaces.find((ns) => ns.id === openNs) ?? null;
  const openSummary = openNs ? summaries[openNs] : undefined;
  const openTasks = useMemo(() => tasksOf(openSummary?.jobs), [openSummary]);
  const openPaintSeat = openWorld ? seats.get(openWorld.id) : undefined;

  // v3.10.7: empty-world auto-rest after 2s
  useEffect(() => {
    const summaryLoaded = openSummary !== undefined;
    const summaryFailed = openSummary?.error != null;
    if (openNs && summaryLoaded && !summaryFailed && openTasks.length === 0) {
      const t = setTimeout(() => setOpenNs(null), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [openNs, openSummary, openTasks.length]);

  // Project the open world's seat for vine geometry (scene % from painting %)
  const openSeat = useMemo(() => {
    if (!openPaintSeat || sceneSize.w === 0 || sceneSize.h === 0) return openPaintSeat;
    const p = projectSeat(openPaintSeat, sceneSize.w, sceneSize.h);
    return { x: p.x, y: p.y, dir: openPaintSeat.dir, seatIdx: openPaintSeat.seatIdx };
  }, [openPaintSeat, sceneSize.w, sceneSize.h]);

  const summaryLoaded = openSummary !== undefined;
  const summaryFailed = openSummary?.error != null;

  // ── the vine: geometry from the open lantern's projected seat + LANTERN_ANCHOR ──
  const vineMode: VineMode = displayMode === "compact" ? "compact" : displayMode === "normal" ? "normal" : "extended";

  const vine = useMemo(() => {
    if (!openWorld || !openSeat || summaryFailed) return null;
    const seatIdx = openSeat.seatIdx;
    const anchorPaint = LANTERN_ANCHOR[seatIdx];
    if (!anchorPaint) return null;
    // When sceneSize is unmeasured (ResizeObserver pending), treat painting %
    // as px directly — produces valid geometry without layout (positions are
    // small but structurally correct until the first resize fires).
    const W = sceneSize.w > 0 ? sceneSize.w : 100;
    const H = sceneSize.h > 0 ? sceneSize.h : 100;
    const anchorScene = projectSeat(anchorPaint, W, H);
    const lanternPx = {
      x: (openSeat.x / 100) * W,
      y: (openSeat.y / 100) * H,
    };
    const anchorPx = {
      x: (anchorScene.x / 100) * W,
      y: (anchorScene.y / 100) * H,
    };
    return vineFor(lanternPx, anchorPx, openTasks.length, vineMode, W);
  }, [openWorld, openSeat, openTasks.length, sceneSize.w, sceneSize.h, vineMode, summaryFailed]);

  const canvasHeight = vine ? vineCanvasHeight(vine, sceneSize.h) : 0;

  // ── falling ghosts: a cancelled card's purge plays the fall ──
  const [falling, setFalling] = useState<FallingCard[]>([]);
  const prevTasksRef = useRef<DisplayJob[]>([]);
  const prevOpenNsRef = useRef<string | null>(openNs);
  useEffect(() => {
    const prev = prevTasksRef.current;
    prevTasksRef.current = openTasks;
    const worldChanged = prevOpenNsRef.current !== openNs;
    prevOpenNsRef.current = openNs;
    if (!vine || worldChanged) {
      setFalling([]);
      return;
    }
    const cardW = vineCardWidth(vineMode);
    const stillIds = new Set(openTasks.map((j) => j.sessionId));
    const newlyFalling = prev.filter(
      (j) =>
        !stillIds.has(j.sessionId) && (terminatingSessionIds?.has(j.sessionId) ?? false),
    );
    if (newlyFalling.length === 0) return;
    const ghosts: FallingCard[] = newlyFalling.map((job) => {
      const idx = Math.max(
        0,
        prev.findIndex((j) => j.sessionId === job.sessionId),
      );
      const anchor = vine.points[Math.min(idx, vine.points.length - 1)] ?? { x: 0, y: 0 };
      const box = vineCardBox(anchor, vine.dir, cardW, sceneSize.w);
      return { job, left: box.left, top: box.top, side: box.side };
    });
    setFalling((cur) => [...cur, ...ghosts]);
    const ids = new Set(ghosts.map((g) => g.job.sessionId));
    const t = setTimeout(() => {
      setFalling((cur) => cur.filter((g) => !ids.has(g.job.sessionId)));
    }, FALL_MS);
    return () => clearTimeout(t);
  }, [openNs, openTasks, vine, vineMode, sceneSize.w, terminatingSessionIds]);

  const rootClass = [
    "ns-tree",
    "ns-tree--lanterns",
    displayMode === "extended" ? "ns-tree--extended" : "",
    displayMode === "compact" ? "ns-tree--compact" : "",
  ].filter(Boolean).join(" ");

  // Determine actual canvas height for the scrolling canvas
  const effectiveCanvasHeight = Math.max(canvasHeight, sceneSize.h);

  // ── lantern-shaped light state SVG layer ──
  // One <g class="lseat"> per SEAT_POOL index; state = off/mid/full.
  const kStd = sceneSize.w > 0 && sceneSize.h > 0
    ? Math.max(sceneSize.w / 896, sceneSize.h / 1200)
    : 1;
  // Build a reverse-map: seatIdx → nsId (for state determination)
  const nsForSeat = useMemo(() => {
    const m = new Map<number, string>();
    for (const ns of namespaces) {
      const seat = seats.get(ns.id);
      if (seat != null) m.set(seat.seatIdx, ns.id);
    }
    return m;
  }, [namespaces, seats]);

  const titleWorldSeat = titleWorldId ? seats.get(titleWorldId) : undefined;

  return (
    <div
      className={rootClass}
      role="tree"
      aria-label="Namespace tree"
    >
      {/* ── the painted scene ── */}
      <div className="ns-tree__scene" ref={sceneRef} onClick={handleSceneClick}>
        <div
          className="ns-tree__scroller"
          ref={scrollerRef}
          role={openWorld ? "group" : undefined}
          aria-label={openWorld ? `${openWorld.label} tasks` : undefined}
        >
          {/* v3.9 — ONE scrolling canvas: backdrop + stones + vine + cards scroll together */}
          <div
            className="ns-tree__canvas"
            style={{ height: effectiveCanvasHeight > 0 ? `${effectiveCanvasHeight}px` : undefined }}
          >
            {/* backdrop img: pinned to scene height so it stays rooted */}
            <img
              className="ns-tree__backdrop"
              src={treeBackdrop}
              alt=""
              aria-hidden="true"
              style={sceneSize.h > 0 ? { height: `${sceneSize.h}px` } : undefined}
            />

            {/* v3.10 — lantern-shaped light states SVG (z-index: 1, under the stone buttons) */}
            {sceneSize.w > 0 && sceneSize.h > 0 && (
              <svg
                className="lshapes"
                width={sceneSize.w}
                height={sceneSize.h}
                aria-hidden="true"
              >
                <defs>
                  <path id="ldrop" d={LANTERN_PATH} />
                  <filter id="lsoft" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" />
                  </filter>
                  <filter id="lwide" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="7" />
                  </filter>
                  <radialGradient id="lglowg" cx="50%" cy="55%" r="68%">
                    <stop offset="0" stopColor="#eaf9ff" stopOpacity="0.95" />
                    <stop offset="0.5" stopColor="#a8dcec" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#a8dcec" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {SEAT_POOL.map((seat, i) => {
                  const nsId = nsForSeat.get(i);
                  const isFull = nsId != null && openNs === nsId;
                  const lseatState = nsId == null ? "off" : isFull ? "full" : "mid";
                  const isHovered = nsId != null && hoveredNs === nsId;
                  const p = projectSeat(seat, sceneSize.w, sceneSize.h);
                  const px = (p.x / 100) * sceneSize.w;
                  const py = (p.y / 100) * sceneSize.h;
                  const size = LANTERN_SIZE[i]!;
                  const mx = kStd * (size.w / 38);
                  const my = kStd * (size.h / 73);
                  return (
                    <g
                      key={i}
                      className={`lseat lseat--${lseatState}${isHovered ? " is-hover" : ""}`}
                      data-seat={i}
                      transform={`translate(${px.toFixed(1)},${py.toFixed(1)}) scale(${mx.toFixed(4)},${my.toFixed(4)})`}
                    >
                      <use href="#ldrop" className="lseat__halo" filter="url(#lwide)" transform="scale(1.7)" />
                      <use href="#ldrop" className="lseat__veil" filter="url(#lsoft)" transform="scale(1.16)" />
                      <use href="#ldrop" className="lseat__glow" transform="scale(1.22)" />
                      <use href="#ldrop" className="lseat__ring" transform="scale(1.05)" />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* stones overlay: pinned to scene height, lives inside canvas (scroll-together) */}
            <ul
              className="ns-tree__roots"
              style={sceneSize.h > 0 ? { height: `${sceneSize.h}px` } : undefined}
            >
              {namespaces.map((ns) => {
                const summary = summaries[ns.id];
                const isActive = ns.id === namespace;
                const isOpen = openNs === ns.id;
                const paintSeat = seats.get(ns.id)!;
                // Project painting % → scene % for positioning
                const projected = projectSeat(paintSeat, sceneSize.w, sceneSize.h);
                const line = labelLineOf(summary);
                const failed = summary?.counts.failed ?? 0;
                const total = summary?.total ?? 0;
                // v3.10: FULL = clicked world with vine open; stone → opaque while full
                const isFull = isActive && isOpen;
                const lanternClass = [
                  "ns-tree__select",
                  "ns-tree__lantern",
                  isFull ? "ns-tree__lantern--full" : isActive ? "ns-tree__lantern--active" : "ns-tree__lantern--inactive",
                  summary?.error ? "ns-tree__lantern--dim" : "",
                  failed > 0 ? "ns-tree__lantern--failed" : total > 0 ? "ns-tree__lantern--ok" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const glabelClass = [
                  "ns-tree__glabel",
                  !summary ? "ns-tree__glabel--load" : "",
                  summary?.error ? "ns-tree__glabel--err" : "",
                  hoveredNs === ns.id ? "ns-tree__glabel--on" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                // pip strip: single-row progress-bar for COLLAPSED worlds only
                const pipRow =
                  !isOpen && summary && !summary.error
                    ? taskPips(tasksOf(summary.jobs))
                    : null;
                const stripWidth = pipRow && pipRow.count > 0 ? pipStripWidth(pipRow) : 0;
                const stripLeft = pipRow && pipRow.count > 0
                  ? pipStripLeft(
                      { x: projected.x, dir: paintSeat.dir },
                      sceneSize.w,
                      stripWidth,
                    )
                  : 0;
                return (
                  <li
                    key={ns.id}
                    data-namespace={ns.id}
                    data-seat-x={projected.x}
                    data-seat-y={projected.y}
                    data-seat-dir={paintSeat.dir}
                    className={isActive ? "ns-tree__item ns-tree__item--active" : "ns-tree__item"}
                    style={{ left: `${projected.x}%`, top: `${projected.y}%` }}
                  >
                    {/* lantern button: transparent hit target — the painted lantern holds the spirit */}
                    <button
                      type="button"
                      className={lanternClass}
                      role="treeitem"
                      aria-expanded={isOpen}
                      aria-selected={isActive}
                      aria-label={`${ns.label} — ${line}`}
                      title={`${ns.label} — ${line}`}
                      onClick={(e) => { e.stopPropagation(); selectWorld(ns.id); }}
                      onMouseEnter={() => setHoveredNs(ns.id)}
                      onMouseLeave={() => setHoveredNs((prev) => (prev === ns.id ? null : prev))}
                      onFocus={() => setHoveredNs(ns.id)}
                      onBlur={() => setHoveredNs((prev) => (prev === ns.id ? null : prev))}
                    >
                      {/* stone answers the light: transparent overlay (mid) or opaque profile-card (full) */}
                      <TreeIcon
                        src={namespaceIcon(ns.id, isFull)}
                        fallback={NAMESPACE_ICON_FALLBACK}
                        size="lantern"
                      />
                    </button>
                    {/* status-counts row: orbs beneath COLLAPSED lanterns */}
                    {!isOpen && summary && !summary.error && summary.total > 0 && (
                      <div className="ns-tree__counts" aria-hidden="true">
                        <span
                          className={`ns-tree__counts__orb ns-tree__counts__orb--succeeded${summary.counts.succeeded > 0 ? "" : " ns-tree__counts__orb--dim"}`}
                        />
                        <span
                          className={`ns-tree__counts__orb ns-tree__counts__orb--running${summary.counts.running > 0 ? "" : " ns-tree__counts__orb--dim"}`}
                        />
                        <span
                          className={`ns-tree__counts__orb ns-tree__counts__orb--failed${summary.counts.failed > 0 ? "" : " ns-tree__counts__orb--dim"}`}
                        />
                        <span className="ns-tree__counts__nums">
                          {summary.counts.succeeded > 0 && (
                            <i style={{ color: "#79b356" }}>{summary.counts.succeeded}</i>
                          )}
                          {summary.counts.running > 0 && (
                            <i style={{ color: "#6fb7d8" }}>{summary.counts.running}</i>
                          )}
                          {summary.counts.failed > 0 && (
                            <i style={{ color: "#e07a3f" }}>{summary.counts.failed}</i>
                          )}
                        </span>
                      </div>
                    )}
                    {/* single-row pip strip: COLLAPSED worlds only */}
                    {pipRow && pipRow.count > 0 && (
                      <div
                        className="piprow"
                        aria-hidden="true"
                        data-count={pipRow.count}
                        style={{ left: `${stripLeft}px` } as CSSProperties}
                      >
                        {pipRow.pips.map((pip) => (
                          <span
                            key={pip.sessionId}
                            className={`pip-slot pip-slot--${pip.status}`}
                            data-status={pip.status}
                          >
                            <TreeIcon src={taskIcon(pip.status)} fallback={taskIconFallback(pip.status)} size="pip" />
                          </span>
                        ))}
                        {pipRow.overflow > 0 && (
                          <span className="piprow__more">+{pipRow.overflow}</span>
                        )}
                      </div>
                    )}
                    {/* hover/focus label */}
                    <div className={glabelClass} aria-hidden="true">
                      <b className="ns-tree__glabel-name">{ns.label}</b>
                      <span className="ns-tree__glabel-line">{line}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* v3.13 — world title section: glass panel above the topmost lanterns */}
            <WorldTitle
              titleWorldId={titleWorldId}
              activeWorldId={openNs}
              namespaces={namespaces}
              summaries={summaries}
              titleWorldSeatIdx={titleWorldSeat?.seatIdx}
              onSelectWorld={selectWorld}
              compact={isCompact}
            />

            {/* vine SVG */}
            {vine && (
              <svg
                className="ns-tree__shoots"
                width={Math.max(1, sceneSize.w)}
                height={Math.max(1, effectiveCanvasHeight)}
                aria-hidden="true"
              >
                <path
                  className={`ns-tree__vine${openTasks.length === 0 ? " ns-tree__vine--bare" : ""}`}
                  d={vine.d}
                />
              </svg>
            )}
            {/* strand notes before work lands */}
            {openWorld && openSeat && !summaryLoaded && (
              <div
                className="ns-tree__note"
                style={notePos(openSeat, -70)}
                aria-live="polite"
              >
                fetching the world's work…
              </div>
            )}
            {openWorld && openSeat && summaryLoaded && !summaryFailed && openTasks.length === 0 && (
              <div className="ns-tree__note" style={notePos(openSeat, -90)}>
                no tasks in this world — its lantern rests
              </div>
            )}
            {openWorld && openSeat && summaryFailed && (
              <div className="ns-tree__note ns-tree__note--err" style={notePos(openSeat, -90)}>
                summary unavailable
              </div>
            )}
            {/* vine's cards + anchor icons */}
            {vine &&
              openTasks.map((job, i) => {
                const isTaskActive = job.sessionId === activeSessionId;
                const anchor = vine.points[i];
                if (!anchor) return null;
                const box = vineCardBox(anchor, vine.dir, vineCardWidth(vineMode), sceneSize.w);
                const isTerminating = terminatingSessionIds?.has(job.sessionId) ?? false;
                const anchorCls = [
                  "anchor-ic",
                  `anchor-ic--${isTerminating ? "terminating" : job.status}`,
                  "pop-in",
                ].join(" ");
                return [
                  <div
                    key={`anc-${job.sessionId}`}
                    className={anchorCls}
                    style={{
                      left: `${anchor.x}px`,
                      top: `${anchor.y}px`,
                      animationDelay: `${60 + i * 50}ms`,
                    }}
                    aria-hidden="true"
                  >
                    <TreeIcon src={taskIcon(job.status)} fallback={taskIconFallback(job.status)} size="task" />
                  </div>,
                  <VineCard
                    key={job.sessionId}
                    job={job}
                    isActive={isTaskActive}
                    isPinned={pinnedSessionIds?.has(job.sessionId) ?? false}
                    isTerminating={isTerminating}
                    compact={isCompact}
                    side={box.side}
                    style={{
                      left: `${box.left}px`,
                      top: `${box.top}px`,
                      animationDelay: `${140 + i * 50}ms`,
                    }}
                    onOpen={() => onSelectTask(openWorld!.id, job.sessionId, job)}
                    onTogglePin={
                      onTogglePinSession ? () => onTogglePinSession(job.sessionId) : () => {}
                    }
                    onCancel={
                      onCancelJob && isCancellable(job.status)
                        ? () => onCancelJob(job.sessionId, job)
                        : () => {}
                    }
                  />,
                ];
              })}
            {/* falling ghosts: cancelled cards play the fall, then sweep */}
            {falling.map((g) => (
              <VineCard
                key={`fall-${g.job.sessionId}`}
                job={g.job}
                isActive={false}
                isPinned={false}
                isTerminating
                compact={isCompact}
                side={g.side}
                ghost
                style={{ left: `${g.left}px`, top: `${g.top}px` }}
                onOpen={() => {}}
                onTogglePin={() => {}}
                onCancel={() => {}}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
