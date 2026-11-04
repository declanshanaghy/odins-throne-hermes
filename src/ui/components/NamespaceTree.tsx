// Namespace stone tree (issues #11, #12, #39, #59, #69) — v3.9
//
// v3.9 (issue #69): the tree becomes a vertical painted tree where each
// namespace is a visible dark-slate STONE overlaying a painted leaf-lantern.
// The active (selected) world's stone OPENS (teal ring, translucent, z7);
// every other stone FADES into the background (ghost-transparent, opacity .5,
// z4). The whole scene — backdrop + stones + vine + cards — scrolls TOGETHER
// in one canvas so the task list is ALWAYS attached to its stone.
//
// Key changes from v3.8:
//   - `<img class="ns-tree__backdrop">` replaces the CSS background-image
//     (height pinned to scene by JS so it roots above the extended canvas)
//   - `ns-tree__roots` lives INSIDE the scrolling canvas (scroll-together)
//   - Stones carry `--inactive` / `--active` classes (not just `--active`)
//   - Seats are in PAINTING %; `projectSeat()` maps to scene % before use
//   - All summaries preload at boot (useNamespaceSummaries already does this)
//   - Vine curls to branch rail at 44% sceneW, then descends (vineGeometry v3.9)
//
//    o   Fenrir Ledger Agents        ← stone overlaying painted lantern (role=treeitem)
//  ⚒⚒✖⏳ 12 tasks · 2 running · …    ← task pips (+N) + hover label
//   ╰─────────╮                       ← vine to branch rail at 44%
//              [jcard s-run-1 RUNNING] ← full cards on the strand
//              [jcard s-fail-1 FAILED] ← each: sigil · title · meta · actions
//
// STRICT ACCORDION: one world's vine is open at a time.

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
import { assignSeats, projectSeat } from "../lib/treeSeats";
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

  const openWorld = namespaces.find((ns) => ns.id === openNs) ?? null;
  const openSummary = openNs ? summaries[openNs] : undefined;
  const openTasks = useMemo(() => tasksOf(openSummary?.jobs), [openSummary]);
  const openPaintSeat = openWorld ? seats.get(openWorld.id) : undefined;
  // Project the open world's seat for vine geometry (scene % from painting %)
  const openSeat = useMemo(() => {
    if (!openPaintSeat || sceneSize.w === 0 || sceneSize.h === 0) return openPaintSeat;
    const mode = isCompact ? "compact" : "standard";
    const p = projectSeat(openPaintSeat, mode, sceneSize.w, sceneSize.h);
    return { x: p.x, y: p.y, dir: openPaintSeat.dir };
  }, [openPaintSeat, isCompact, sceneSize.w, sceneSize.h]);
  const summaryLoaded = openSummary !== undefined;
  const summaryFailed = openSummary?.error != null;

  // ── the vine: geometry from the open lantern's projected seat ──
  const vineMode: VineMode = displayMode === "compact" ? "compact" : displayMode === "normal" ? "normal" : "extended";
  const vine = useMemo(() => {
    if (!openWorld || !openSeat || summaryFailed) return null;
    return vineFor(openSeat, openTasks.length, sceneSize.w, sceneSize.h, vineMode);
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
  // The backdrop and roots overlay are pinned to the scene height; the canvas
  // grows below for long vines so the vine + cards extend beyond the scene.
  const effectiveCanvasHeight = Math.max(canvasHeight, sceneSize.h);

  return (
    <div
      className={rootClass}
      role="tree"
      aria-label="Namespace tree"
    >
      {/* ── the painted scene ── */}
      <div className="ns-tree__scene" ref={sceneRef}>
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
                const mode = isCompact ? "compact" : "standard";
                const projected = projectSeat(paintSeat, mode, sceneSize.w, sceneSize.h);
                const line = labelLineOf(summary);
                const failed = summary?.counts.failed ?? 0;
                const total = summary?.total ?? 0;
                const lanternClass = [
                  "ns-tree__select",
                  "ns-tree__lantern",
                  isActive ? "ns-tree__lantern--active" : "ns-tree__lantern--inactive",
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
                      { x: projected.x, y: projected.y, dir: paintSeat.dir },
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
                    {/* stone: visible dark-slate disc overlaying the painted lantern */}
                    <button
                      type="button"
                      className={lanternClass}
                      role="treeitem"
                      aria-expanded={isOpen}
                      aria-selected={isActive}
                      aria-label={`${ns.label} — ${line}`}
                      title={`${ns.label} — ${line}`}
                      onClick={() => selectWorld(ns.id)}
                      onMouseEnter={() => setHoveredNs(ns.id)}
                      onMouseLeave={() => setHoveredNs((prev) => (prev === ns.id ? null : prev))}
                      onFocus={() => setHoveredNs(ns.id)}
                      onBlur={() => setHoveredNs((prev) => (prev === ns.id ? null : prev))}
                    >
                      <TreeIcon src={namespaceIcon(ns.id)} fallback={NAMESPACE_ICON_FALLBACK} size="lantern" />
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
                no tasks in this world
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
