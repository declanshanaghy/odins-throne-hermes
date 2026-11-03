// Namespace lantern tree (issues #11 + #12) — the garden pattern's tree
// display: each namespace (a "world") renders as a LANTERN seated on the
// painted backdrop at its runtime-assigned seat (lib/treeSeats.ts — curated
// painted lanterns first, djb2-hash fallback, terrace stack beyond the
// pool), with its curated shanaghy.com icon inside (inline glyph fallback
// offline via TreeIcon), a hover/focus label showing the world name + full
// summary line, and stats berries beside the seat.
//
// The OPEN world's work hangs from its lantern as a VINE STRAND (issue #12,
// per the approved prototype): a curved bezier cascade that extends from
// the lantern's seat — growing one pitch per job — with the world's job
// cards hung along it, evenly spaced and never overlapping, ordered
// running → failed → pending → succeeded (useJobs.sortJobs). The painting
// and the lanterns stay ROOTED (static overlay above); only the vine and
// its cards scroll (the .ns-tree__scroller/.ns-tree__canvas structure) —
// so a strand that outgrows the panel scrolls beneath the scene.
//
//   ◖o◗  Fenrir Ledger Agents        ← lantern button (role=treeitem)
//   ●●●  12 tasks · 2 running · …    ← berries + hover label
//   ╰─⌒─⌒─⌒─⌒─╮                      ← the vine (SVG bezier, from the seat)
//      [jcard s-run-1 RUNNING]       ← full cards on the strand
//      [jcard s-fail-1 FAILED]       ← each: sigil · title · meta · actions
//
// STRICT ACCORDION: one world's vine is open at a time. Clicking a lantern
// selects that world (reconnects the live WS feed, same as the old dropdown)
// and grows its vine, retracting the previous one; clicking the open
// lantern collapses it; reopening regrows it. No orphan states — if the open
// world disappears from the API list the vine closes.
//
// Before a world's summary lands its label shows "…" and the vine seat
// shows "fetching the world's work…"; empty worlds show "no tasks in this
// world"; a failed summary dims the seat and shows "summary unavailable".
// Cancelled work: the card trembles while terminating, then falls (the
// tree renders a falling ghost) and is purged from the strand; its tab
// closed with the pod.
//
// Display modes mirror the sidebar: extended seats bigger lanterns + berry
// counts + wider card pitch, normal shrinks both, compact collapses the
// scene to an initials chip that opens a minimal icon + initials list.

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import type { DisplayJob, Job } from "../lib/types";
import type { NamespaceOption } from "../hooks/useNamespace";
import { summaryLine, type NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { parseJob, sortJobs } from "../hooks/useJobs";
import { namespaceIcon, NAMESPACE_ICON_FALLBACK } from "../lib/namespaceIcons";
import { assignSeats } from "../lib/treeSeats";
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

/**
 * The painted tree-scene backdrop (issue #10) is exposed as a CSS custom
 * property on the tree root: the scene renders it as a cover background and
 * the lantern overlay (issue #11) seats namespaces onto the painting.
 */
function treeBackdropStyle(): CSSProperties {
  return { "--tree-backdrop": `url(${JSON.stringify(treeBackdrop)})` } as CSSProperties;
}

interface Props {
  namespace: string;
  namespaces: NamespaceOption[];
  summaries: NamespaceSummaries;
  onNamespaceChange: (ns: string) => void;
  /** Drilldown task click — same selection semantics as the vine cards. */
  onSelectTask: (nsId: string, sessionId: string, job?: DisplayJob) => void;
  activeSessionId: string | null;
  displayMode: DisplayMode;
  /** Job-card interactions, threaded through from the Sidebar exactly as the
   * old flat job list received them. (The vine cards carry no avatar — the
   * sigil is the taskIcon — so this is accepted for interface stability.) */
  onAvatarClick?: (agentKey: string) => void;
  onTogglePinSession?: (sessionId: string) => void;
  pinnedSessionIds?: Set<string>;
  onCancelJob?: (sessionId: string, job: DisplayJob) => void;
  terminatingSessionIds?: Set<string>;
}

/** Two-letter initials for compact mode ("Fenrir Ledger Agents" → "FA"). */
function initialsOf(label: string): string {
  return label
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The open world's strand: the summary fetch's raw job list, parsed to
 * DisplayJobs and hung in the vine order (running → failed → pending →
 * succeeded). Purged jobs are excluded — their pod is gone, so there is
 * nothing to hang.
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

/** A note pill's position near the lantern seat, in percent of scene. */
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
  // Lantern seats are ASSIGNED at runtime over whatever the API returned —
  // curated painted lanterns first, never stealable (lib/treeSeats.ts).
  const seats = useMemo(
    () => assignSeats(namespaces.map((ns) => ns.id)),
    [namespaces],
  );
  // Strict accordion: the one world whose vine is open (null = collapsed).
  // The active world starts pre-drilled, like the old tree.
  const [openNs, setOpenNs] = useState<string | null>(namespace);
  // Hover/focus reveals the garden label (name + full summary line).
  const [hoveredNs, setHoveredNs] = useState<string | null>(null);
  // In compact mode the scene hides behind the initials chip.
  const [compactOpen, setCompactOpen] = useState(false);

  // ── scene measurement: the vine geometry needs the painted box in px ──
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

  // No orphan states: a world gone from the API list closes its vine, and
  // a vine opened for a since-renamed world tracks the active one.
  useEffect(() => {
    setOpenNs((prev) => (prev && namespaces.some((ns) => ns.id === prev) ? prev : null));
  }, [namespaces]);

  /**
   * Clicking a lantern SELECTS the world (same as the old dropdown) and
   * toggles the accordion: the open world collapses, any other world grows
   * its vine and the previous strand retracts. A fresh vine reads from the
   * lantern (scroll reset).
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
  const openSeat = openWorld ? seats.get(openWorld.id) : undefined;
  const summaryLoaded = openSummary !== undefined;
  const summaryFailed = openSummary?.error != null;

  // ── the vine: geometry from the open lantern's seat, in scene px ──
  const vineMode: VineMode = displayMode === "normal" ? "normal" : "extended";
  const vine = useMemo(() => {
    if (!openWorld || !openSeat || summaryFailed) return null;
    return vineFor(openSeat, openTasks.length, sceneSize.w, sceneSize.h, vineMode);
  }, [openWorld, openSeat, openTasks.length, sceneSize.w, sceneSize.h, vineMode, summaryFailed]);
  const canvasHeight = vine ? vineCanvasHeight(vine, sceneSize.h) : 0;

  // ── falling ghosts: a cancelled card's purge plays the fall ──
  // When a task that was terminating (Ragnarök confirmed) vanishes from
  // the summary — its pod purged — its card keeps hanging just long enough
  // to fall (FALL_MS), then is swept. Live WS updates alone (status changes
  // on surviving tasks) never enter this path, so re-renders never replay
  // the sprout NOR ghost a living card.
  const [falling, setFalling] = useState<FallingCard[]>([]);
  const prevTasksRef = useRef<DisplayJob[]>([]);
  const prevOpenNsRef = useRef<string | null>(openNs);
  useEffect(() => {
    const prev = prevTasksRef.current;
    prevTasksRef.current = openTasks;
    const worldChanged = prevOpenNsRef.current !== openNs;
    prevOpenNsRef.current = openNs;
    if (!vine || worldChanged) {
      // a retracted vine unmounts its cards at once — no fall choreography
      // across a world switch, and nothing hangs on a closed world
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
      // Re-create the card's last box from the CURRENT vine (count minus the
      // purged card shifted the anchors; close enough for a 0.9s farewell).
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

  if (isCompact) {
    const active = namespaces.find((n) => n.id === namespace);
    const activeSummary = summaries[namespace];
    return (
      <div className="ns-tree ns-tree--compact" style={treeBackdropStyle()}>
        <button
          type="button"
          className="ns-tree__chip"
          onClick={() => setCompactOpen((v) => !v)}
          aria-expanded={compactOpen}
          title={
            active
              ? `${active.label}${activeSummary ? ` — ${summaryLine(activeSummary)}` : ""}`
              : namespace
          }
        >
          {active ? initialsOf(active.label) : "NS"}
          {activeSummary ? <span className="ns-tree__chip-count">{activeSummary.total}</span> : null}
        </button>
        {compactOpen && (
          <ul className="ns-tree__list" role="tree" aria-label="All namespaces">
            {namespaces.map((ns) => {
              const summary = summaries[ns.id];
              const seat = seats.get(ns.id);
              return (
                <li
                  key={ns.id}
                  role="treeitem"
                  aria-selected={ns.id === namespace}
                  data-namespace={ns.id}
                  data-seat-x={seat?.x}
                  data-seat-y={seat?.y}
                  data-seat-dir={seat?.dir}
                  className={ns.id === namespace ? "ns-tree__item ns-tree__item--active" : "ns-tree__item"}
                >
                  <button
                    type="button"
                    className="ns-tree__row"
                    title={ns.label}
                    onClick={() => {
                      onNamespaceChange(ns.id);
                      setCompactOpen(false);
                    }}
                  >
                    <TreeIcon
                      src={namespaceIcon(ns.id)}
                      fallback={NAMESPACE_ICON_FALLBACK}
                      size="task"
                    />
                    <span className="ns-tree__compact-initials">{initialsOf(ns.label)}</span>
                    <span className="ns-tree__compact-count">{summary?.total ?? "…"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  const rootClass =
    displayMode === "extended"
      ? "ns-tree ns-tree--lanterns ns-tree--extended"
      : "ns-tree ns-tree--lanterns";

  return (
    <div
      className={rootClass}
      role="tree"
      aria-label="Namespace tree"
      style={treeBackdropStyle()}
    >
      {/* ── the painted scene: lanterns rooted, the vine scrolls beneath ── */}
      <div className="ns-tree__scene" ref={sceneRef}>
        {/* the scroller: only the vine + its cards move — the painting and
            the lanterns above stay rooted (prototype's .scroller/.canvas) */}
        <div
          className="ns-tree__scroller"
          ref={scrollerRef}
          role={openWorld ? "group" : undefined}
          aria-label={openWorld ? `${openWorld.label} tasks` : undefined}
        >
          <div className="ns-tree__canvas" style={{ height: `${canvasHeight}px` }}>
            {vine && (
              <svg
                className="ns-tree__shoots"
                width={Math.max(1, sceneSize.w)}
                height={Math.max(1, canvasHeight)}
                aria-hidden="true"
              >
                <path
                  className={`ns-tree__vine${openTasks.length === 0 ? " ns-tree__vine--bare" : ""}`}
                  d={vine.d}
                />
              </svg>
            )}
            {/* strand states before the work lands (or when it never does) */}
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
            {/* the vine's cards — full job cards, hung along the strand in
                the running → failed → pending → succeeded order */}
            {vine &&
              openTasks.map((job, i) => {
                const isTaskActive = job.sessionId === activeSessionId;
                const anchor = vine.points[i];
                if (!anchor) return null;
                const box = vineCardBox(anchor, vine.dir, vineCardWidth(vineMode), sceneSize.w);
                return (
                  <VineCard
                    key={job.sessionId}
                    job={job}
                    isActive={isTaskActive}
                    isOpen={job.sessionId === activeSessionId}
                    isPinned={pinnedSessionIds?.has(job.sessionId) ?? false}
                    isTerminating={terminatingSessionIds?.has(job.sessionId) ?? false}
                    side={box.side}
                    style={{ left: `${box.left}px`, top: `${box.top}px` }}
                    onOpen={() => onSelectTask(openWorld!.id, job.sessionId, job)}
                    onTogglePin={
                      onTogglePinSession ? () => onTogglePinSession(job.sessionId) : () => {}
                    }
                    onCancel={
                      onCancelJob && isCancellable(job.status)
                        ? () => onCancelJob(job.sessionId, job)
                        : () => {}
                    }
                  />
                );
              })}
            {/* falling ghosts: cancelled cards play the fall, then sweep */}
            {falling.map((g) => (
              <VineCard
                key={`fall-${g.job.sessionId}`}
                job={g.job}
                isActive={false}
                isOpen={false}
                isPinned={false}
                isTerminating
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
        {/* ── every world's lantern at its seat (rooted above the scroller) ── */}
        <ul className="ns-tree__roots">
          {namespaces.map((ns) => {
            const summary = summaries[ns.id];
            const isActive = ns.id === namespace;
            const isOpen = openNs === ns.id;
            const seat = seats.get(ns.id)!;
            const line = labelLineOf(summary);
            const failed = summary?.counts.failed ?? 0;
            const total = summary?.total ?? 0;
            const lanternClass = [
              "ns-tree__select",
              "ns-tree__lantern",
              isActive ? "ns-tree__lantern--active" : "",
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
            return (
              <li
                key={ns.id}
                data-namespace={ns.id}
                data-seat-x={seat.x}
                data-seat-y={seat.y}
                data-seat-dir={seat.dir}
                className="ns-tree__item"
                style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
              >
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
                {/* stats berries — the summary counts beside each seat */}
                <div className="ns-tree__fruit" aria-hidden="true">
                  <b className="ns-tree__berry ns-tree__berry--succeeded" data-on={summary ? (summary.counts.succeeded > 0 ? "1" : "0") : "0"} />
                  <b className="ns-tree__berry ns-tree__berry--running" data-on={summary ? (summary.counts.running > 0 ? "1" : "0") : "0"} />
                  <b className="ns-tree__berry ns-tree__berry--failed" data-on={failed > 0 ? "1" : "0"} />
                  <span className="ns-tree__fruit-counts">
                    {summary && summary.counts.succeeded > 0 && (
                      <i className="ns-tree__fruit-count ns-tree__fruit-count--succeeded">{summary.counts.succeeded}</i>
                    )}
                    {summary && summary.counts.running > 0 && (
                      <i className="ns-tree__fruit-count ns-tree__fruit-count--running">{summary.counts.running}</i>
                    )}
                    {summary && failed > 0 && (
                      <i className="ns-tree__fruit-count ns-tree__fruit-count--failed">{failed}</i>
                    )}
                  </span>
                </div>
                {/* hover/focus label — garden's .g-label pattern */}
                <div className={glabelClass} aria-hidden="true">
                  <b className="ns-tree__glabel-name">{ns.label}</b>
                  <span className="ns-tree__glabel-line">{line}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}