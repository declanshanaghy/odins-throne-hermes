// Namespace lantern tree (issue:11) — the garden pattern's tree display:
// each namespace (a "world") renders as a LANTERN seated on the painted
// backdrop at its runtime-assigned seat (lib/treeSeats.ts — curated painted
// lanterns first, djb2-hash fallback, terrace stack beyond the pool), with
// its curated shanaghy.com icon inside (inline glyph fallback offline via
// TreeIcon), a hover/focus label showing the world name + full summary line,
// and stats berries beside the seat.
//
//   ◖o◗  Fenrir Ledger Agents        ← lantern button (role=treeitem)
//   ●●●  12 tasks · 2 running · …    ← berries + hover label
//   ╎
//   ├─ [job card: s-run-1 RUNNING]   ← the open world's branch (drill)
//   └─ [job card: s-fail-1 FAILED]
//
// STRICT ACCORDION: one world's branch is open at a time. Clicking a lantern
// selects that world (reconnects the live WS feed, same as the old dropdown)
// and opens its branch, retracting the previous one; clicking the open
// lantern collapses it; reopening regrows it. No orphan states — if the open
// world disappears from the API list the branch closes.
//
// The branch renders the SAME JobCard components the old flat list rendered,
// branched beneath the open lantern with drawn connector rails + elbows.
// Before a world's summary lands its label shows "…" and the drill shows
// "fetching the world's work…"; empty worlds show "no tasks in this world";
// a failed summary dims the seat and shows "summary unavailable".
//
// Display modes mirror the sidebar: extended seats bigger lanterns + berry
// counts, normal shrinks them, compact collapses the scene to an initials
// chip that opens a minimal icon + initials list.

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { DisplayJob, Job } from "../lib/types";
import type { NamespaceOption } from "../hooks/useNamespace";
import { summaryLine, type NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { parseJob, sortJobs } from "../hooks/useJobs";
import { namespaceIcon, NAMESPACE_ICON_FALLBACK } from "../lib/namespaceIcons";
import { assignSeats } from "../lib/treeSeats";
import treeBackdrop from "../assets/tree-backdrop.jpg";
import { TreeIcon } from "./TreeIcon";
import { JobCard } from "./JobCard";
import type { DisplayMode } from "./Sidebar";

/**
 * The painted tree-scene backdrop (issue:10) is exposed as a CSS custom
 * property on the tree root: the scene renders it as a cover background and
 * the lantern overlay (issue:11) seats namespaces onto the painting.
 */
function treeBackdropStyle(): CSSProperties {
  return { "--tree-backdrop": `url(${JSON.stringify(treeBackdrop)})` } as CSSProperties;
}

interface Props {
  namespace: string;
  namespaces: NamespaceOption[];
  summaries: NamespaceSummaries;
  onNamespaceChange: (ns: string) => void;
  /** Drilldown task click — same selection semantics as the job cards. */
  onSelectTask: (nsId: string, sessionId: string, job?: DisplayJob) => void;
  activeSessionId: string | null;
  displayMode: DisplayMode;
  /** Job-card interactions, threaded through from the Sidebar exactly as the
   * old flat job list received them. */
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
 * The open world's branch: the summary fetch's raw job list, parsed to
 * DisplayJobs and ordered like the sidebar cards. Purged jobs are excluded —
 * their pod is gone, so there is nothing to drill into.
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

export function NamespaceTree({
  namespace,
  namespaces,
  summaries,
  onNamespaceChange,
  onSelectTask,
  activeSessionId,
  displayMode,
  onAvatarClick,
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
  // Strict accordion: the one world whose branch is open (null = collapsed).
  // The active world starts pre-drilled, like the old tree.
  const [openNs, setOpenNs] = useState<string | null>(namespace);
  // Hover/focus reveals the garden label (name + full summary line).
  const [hoveredNs, setHoveredNs] = useState<string | null>(null);
  // In compact mode the scene hides behind the initials chip.
  const [compactOpen, setCompactOpen] = useState(false);

  // No orphan states: a world gone from the API list closes its branch, and
  // a branch opened for a since-renamed world tracks the active one.
  useEffect(() => {
    setOpenNs((prev) => (prev && namespaces.some((ns) => ns.id === prev) ? prev : null));
  }, [namespaces]);

  /**
   * Clicking a lantern SELECTS the world (same as the old dropdown) and
   * toggles the accordion: the open world collapses, any other world opens
   * and the previous branch retracts.
   */
  const selectWorld = (nsId: string) => {
    onNamespaceChange(nsId);
    setOpenNs((prev) => (prev === nsId ? null : nsId));
  };

  const openWorld = namespaces.find((ns) => ns.id === openNs) ?? null;
  const openSummary = openNs ? summaries[openNs] : undefined;
  const openTasks = useMemo(() => tasksOf(openSummary?.jobs), [openSummary]);

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
      {/* ── the painted scene: every world's lantern at its seat ── */}
      <div className="ns-tree__scene">
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
      {/* ── the open world's branch (strict accordion: exactly one) ── */}
      {openWorld && (
        <ul
          className="ns-tree__tasks ns-tree__drill"
          role="group"
          aria-label={`${openWorld.label} tasks`}
        >
          {!openSummary ? (
            <li className="ns-tree__task ns-tree__task--empty">fetching the world's work…</li>
          ) : openSummary.error ? (
            <li className="ns-tree__task ns-tree__task--empty">summary unavailable</li>
          ) : openTasks.length === 0 ? (
            <li className="ns-tree__task ns-tree__task--empty">no tasks in this world</li>
          ) : (
            openTasks.map((job) => {
              const isTaskActive = job.sessionId === activeSessionId;
              // The task child IS the job card, rendered exactly as the old
              // flat (active-namespace) list rendered it — same component,
              // same props, same interactions.
              return (
                <li
                  key={job.sessionId}
                  role="treeitem"
                  aria-selected={isTaskActive}
                  data-session={job.sessionId}
                  className={
                    isTaskActive
                      ? "ns-tree__task ns-tree__task--active"
                      : "ns-tree__task"
                  }
                >
                  <JobCard
                    job={job}
                    isActive={isTaskActive}
                    onClick={() => onSelectTask(openWorld.id, job.sessionId, job)}
                    onAvatarClick={onAvatarClick}
                    isPinned={pinnedSessionIds?.has(job.sessionId) ?? false}
                    onTogglePin={onTogglePinSession ? () => onTogglePinSession(job.sessionId) : undefined}
                    onCancelJob={onCancelJob}
                    displayMode={displayMode}
                    isTerminating={terminatingSessionIds?.has(job.sessionId) ?? false}
                  />
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
