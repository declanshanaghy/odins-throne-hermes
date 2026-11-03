// Namespace drilldown tree (issue:4) — restructures the issue:2 tree so each
// namespace is a TOP-LEVEL root node (no "All namespaces" wrapper) with its
// tasks branched directly beneath it:
//
//   ▾ ⚖ Fenrir Ledger Agents      12 tasks · 2 running · 1 failed
//     │ ┌────────────────────────── drawn connector rails + elbows
//     ├─ [job card: s-run-1  RUNNING]  ← the SAME JobCard component the
//     ├─ [job card: s-pend-1 PENDING]   old flat active-namespace list
//     └─ [job card: s-fail-1  FAILED]   rendered, slotted in as children
//   ▸ ⌛ SaySo Agents               8 tasks · all succeeded
//
// Clicking a namespace row sets the active namespace (same as the old
// dropdown: reconnects the live WS feed). Clicking a task's job card
// selects that session — including a cross-world click, which first
// switches the namespace and re-subscribes once the new socket opens.
// The old flat job list below the tree is gone: the cards live IN the
// tree now, with identical rendering and interactions.
//
// Namespace rows carry an icon from https://www.shanaghy.com/assets/icons/
// (curated per known namespace, deterministic hash for unknown ones) with an
// inline emoji fallback when offline; task rows are job cards and bring
// their own agent avatars and status icons.
//
// Display modes mirror the sidebar: extended shows full labels + summaries,
// normal ellipsizes, compact collapses to an initials chip that opens a
// minimal icon + initials list (task drilldown needs the wider modes).

import { useState } from "react";
import type { CSSProperties } from "react";
import type { DisplayJob, Job } from "../lib/types";
import type { NamespaceOption } from "../hooks/useNamespace";
import { summaryLine, type NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { parseJob, sortJobs } from "../hooks/useJobs";
import { namespaceIcon, NAMESPACE_ICON_FALLBACK } from "../lib/namespaceIcons";
import { namespaceSeat } from "../lib/treeSeats";
import treeBackdrop from "../assets/tree-backdrop.jpg";
import { TreeIcon } from "./TreeIcon";
import { JobCard } from "./JobCard";
import type { DisplayMode } from "./Sidebar";

/**
 * The painted tree-scene backdrop (issue:10) is exposed as a CSS custom
 * property on the tree root rather than an <img>: the garden-pattern waves of
 * epic #7 position the scene and its lantern overlays over it, and a
 * background-image URL keeps the current list-tree layout untouched until
 * then. The lantern SEATS meanwhile land as data attributes on each namespace
 * node (namespaceSeat — typed data, no layout constants in JSX) so the
 * overlay waves can pin lanterns to the painting without re-mapping.
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
 * Task children for a namespace node: the summary fetch's raw job list,
 * parsed to DisplayJobs and ordered like the sidebar cards. Purged jobs are
 * excluded — their pod is gone, so there is nothing to drill into.
 */
function tasksOf(summaryJobs: Job[] | undefined) {
  if (!summaryJobs) return [];
  return summaryJobs
    .filter((job) => job.status !== "purged")
    .map(parseJob)
    .sort(sortJobs);
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
  // Drilldown: any number of namespaces can be expanded; the active one
  // starts pre-drilled.
  const [expandedNs, setExpandedNs] = useState<Set<string>>(() => new Set([namespace]));
  // In compact mode the tree hides behind the initials chip.
  const [compactOpen, setCompactOpen] = useState(false);

  const toggleExpanded = (nsId: string) => {
    setExpandedNs((prev) => {
      const next = new Set(prev);
      if (next.has(nsId)) next.delete(nsId);
      else next.add(nsId);
      return next;
    });
  };

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
              return (
                <li
                  key={ns.id}
                  role="treeitem"
                  aria-selected={ns.id === namespace}
                  data-namespace={ns.id}
                  data-seat-x={namespaceSeat(ns.id).x}
                  data-seat-y={namespaceSeat(ns.id).y}
                  data-seat-dir={namespaceSeat(ns.id).dir}
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
      ? "ns-tree ns-tree--extended"
      : "ns-tree";

  return (
    <div
      className={rootClass}
      role="tree"
      aria-label="Namespace tree"
      style={treeBackdropStyle()}
    >
      <ul className="ns-tree__roots">
        {namespaces.map((ns) => {
          const summary = summaries[ns.id];
          const isActive = ns.id === namespace;
          const nsExpanded = expandedNs.has(ns.id);
          const seat = namespaceSeat(ns.id);
          const line = summary
            ? summary.error
              ? "summary unavailable"
              : summaryLine(summary)
            : "…";
          const tasks = nsExpanded ? tasksOf(summary?.jobs) : [];
          return (
            <li
              key={ns.id}
              role="treeitem"
              aria-expanded={nsExpanded}
              aria-selected={isActive}
              data-namespace={ns.id}
              data-seat-x={seat.x}
              data-seat-y={seat.y}
              data-seat-dir={seat.dir}
              className={
                isActive
                  ? "ns-tree__item ns-tree__item--active"
                  : "ns-tree__item"
              }
            >
              <div className="ns-tree__row">
                <button
                  type="button"
                  className="ns-tree__chevron-btn"
                  aria-label={nsExpanded ? `Collapse ${ns.label} tasks` : `Expand ${ns.label} tasks`}
                  onClick={() => toggleExpanded(ns.id)}
                  tabIndex={-1}
                >
                  <span
                    className={nsExpanded ? "ns-tree__chevron ns-tree__chevron--open" : "ns-tree__chevron"}
                    aria-hidden="true"
                  >
                    {nsExpanded ? "▾" : "▸"}
                  </span>
                </button>
                <button
                  type="button"
                  className="ns-tree__select"
                  title={`${ns.label} — ${line}`}
                  onClick={() => {
                    onNamespaceChange(ns.id);
                    // Selecting a world drills into it.
                    setExpandedNs((prev) => new Set(prev).add(ns.id));
                  }}
                >
                  <TreeIcon src={namespaceIcon(ns.id)} fallback={NAMESPACE_ICON_FALLBACK} />
                  <span className="ns-tree__labels">
                    <span className="ns-tree__label">{ns.label}</span>
                    <span className={summary?.error ? "ns-tree__summary ns-tree__summary--error" : "ns-tree__summary"}>
                      {line}
                    </span>
                  </span>
                </button>
              </div>
              {nsExpanded && (
                <ul className="ns-tree__tasks" role="group" aria-label={`${ns.label} tasks`}>
                  {summary && !summary.error ? (
                    tasks.length > 0 ? (
                      tasks.map((job) => {
                        const isTaskActive = job.sessionId === activeSessionId;
                        // The task child IS the job card, rendered exactly as
                        // the old flat (active-namespace) list rendered it —
                        // same component, same props, same interactions.
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
                              onClick={() => onSelectTask(ns.id, job.sessionId, job)}
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
                    ) : (
                      <li className="ns-tree__task ns-tree__task--empty">no tasks in this world</li>
                    )
                  ) : (
                    <li className="ns-tree__task ns-tree__task--empty">
                      {summary ? "summary unavailable" : "loading…"}
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
