// Namespace tree browser (issue:2) — replaces the flat NamespaceSelector
// dropdown. A browseable tree of ALL namespaces with per-namespace task
// summaries and job-status stats:
//
//   ▾ All namespaces (5 worlds · 42 tasks)
//       ▸ Fenrir Ledger Agents      12 tasks · 2 running · 1 failed
//       ▾ SaySo Agents              8 tasks · all succeeded
//           · 8 succeeded
//       ▸ ...
//
// Clicking a namespace row selects it (same behavior as the old dropdown:
// sets the active namespace, which reconnects the live WS feed and filters
// the job list). The chevron expands status-breakdown children instead.
//
// Display modes mirror the sidebar: extended shows full labels and the whole
// summary, normal ellipsizes, compact collapses to an initials chip that
// expands a minimal initials-only tree on click.

import { useState } from "react";
import type { NamespaceOption } from "../hooks/useNamespace";
import {
  JOB_STATUSES,
  summaryLine,
  type NamespaceSummaries,
} from "../hooks/useNamespaceSummaries";
import type { DisplayMode } from "./Sidebar";

interface Props {
  namespace: string;
  namespaces: NamespaceOption[];
  summaries: NamespaceSummaries;
  onNamespaceChange: (ns: string) => void;
  displayMode: DisplayMode;
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

export function NamespaceTree({ namespace, namespaces, summaries, onNamespaceChange, displayMode }: Props) {
  const isCompact = displayMode === "compact";
  const [expanded, setExpanded] = useState(!isCompact);
  const [expandedNs, setExpandedNs] = useState<string | null>(null);
  // In compact mode the tree starts hidden behind the initials chip.
  const [compactOpen, setCompactOpen] = useState(false);

  const grandTotal = namespaces.reduce(
    (sum, ns) => sum + (summaries[ns.id]?.total ?? 0),
    0,
  );
  const loadedCount = namespaces.filter((ns) => summaries[ns.id] && !summaries[ns.id].error).length;

  if (isCompact) {
    const active = namespaces.find((n) => n.id === namespace);
    const activeSummary = summaries[namespace];
    return (
      <div className="ns-tree ns-tree--compact">
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

  const rootClass = isCompact
    ? "ns-tree ns-tree--compact"
    : displayMode === "extended"
      ? "ns-tree ns-tree--extended"
      : "ns-tree";

  return (
    <div className={rootClass} role="tree" aria-label="Namespace tree">
      <button
        type="button"
        className="ns-tree__root"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={expanded ? "ns-tree__chevron ns-tree__chevron--open" : "ns-tree__chevron"} aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="ns-tree__root-label">All namespaces</span>
        <span className="ns-tree__root-stats">
          {loadedCount > 0
            ? `${namespaces.length} worlds · ${grandTotal} tasks`
            : `${namespaces.length} worlds · …`}
        </span>
      </button>
      {expanded && (
        <ul className="ns-tree__list">
          {namespaces.map((ns) => {
            const summary = summaries[ns.id];
            const isActive = ns.id === namespace;
            const nsExpanded = expandedNs === ns.id;
            const line = summary
              ? summary.error
                ? "summary unavailable"
                : summaryLine(summary)
              : "…";
            return (
              <li
                key={ns.id}
                role="treeitem"
                aria-expanded={nsExpanded}
                aria-selected={isActive}
                data-namespace={ns.id}
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
                    aria-label={nsExpanded ? `Collapse ${ns.label} stats` : `Expand ${ns.label} stats`}
                    onClick={() => setExpandedNs(nsExpanded ? null : ns.id)}
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
                    onClick={() => onNamespaceChange(ns.id)}
                  >
                    <span className="ns-tree__label">{ns.label}</span>
                    <span className={summary?.error ? "ns-tree__summary ns-tree__summary--error" : "ns-tree__summary"}>
                      {line}
                    </span>
                  </button>
                </div>
                {nsExpanded && (
                  <ul className="ns-tree__statuses" role="group" aria-label={`${ns.label} status breakdown`}>
                    {summary && !summary.error ? (
                      JOB_STATUSES.map((status) => (
                        <li key={status} className="ns-tree__status">
                          <span className={`ns-tree__status-name ns-tree__status-name--${status}`}>{status}</span>
                          <span className="ns-tree__status-count">{summary.counts[status]}</span>
                        </li>
                      ))
                    ) : (
                      <li className="ns-tree__status ns-tree__status--empty">
                        {summary ? "summary unavailable" : "loading…"}
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
