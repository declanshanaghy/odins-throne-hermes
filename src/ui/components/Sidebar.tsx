import { useState, useRef, useEffect, useMemo } from "react";
import type { DisplayJob } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import type { NamespaceOption } from "../hooks/useNamespace";
import type { NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { StatusBadge } from "./StatusBadge";
import { NamespaceTree } from "./NamespaceTree";
import { avatarUrl } from "../lib/constants";
import { matchesQuery } from "../lib/matchesQuery";
import { parseJob } from "../hooks/useJobs";

// ── findSessionUi seam (issue #117) ──────────────────────────────────────────
// Module-scope registration so the ⌘K palette command can focus the filter
// input from outside the React tree (mirrors the settingsUi seam pattern).
let _focusFn: (() => void) | null = null;
export const findSessionUi = {
  register(fn: () => void): void {
    _focusFn = fn;
  },
  unregister(): void {
    _focusFn = null;
  },
  focus(): void {
    _focusFn?.();
  },
};

// Desktop port: the host pane sash resizes this sidebar; the browser's in-app
// drag handle is gone. Width is measured via ResizeObserver so the
// compact/normal/extended display modes react exactly as they did before.
const DEFAULT_WIDTH = 300;

export type DisplayMode = "compact" | "normal" | "extended";

function getDisplayMode(width: number): DisplayMode {
  if (width < 240) return "compact";
  if (width <= 400) return "normal";
  return "extended";
}

const LS_DISPLAY_MODE_KEY = "hlidskjalf:display-mode";

function readCompactPref(): "auto" | "compact" {
  try {
    return localStorage.getItem(LS_DISPLAY_MODE_KEY) === "compact" ? "compact" : "auto";
  } catch {
    return "auto";
  }
}

interface Props {
  jobs: DisplayJob[];
  activeSessionId: string | null;
  quote: string;
  wsState: "connecting" | "open" | "closed" | "error";
  onSelectSession: (sessionId: string) => void;
  onAvatarClick?: (agentKey: string) => void;
  onOdinClick?: () => void;
  onTogglePinSession?: (sessionId: string) => void;
  pinnedSessionIds?: Set<string>;
  onCancelJob?: (sessionId: string, job: DisplayJob) => void;
  terminatingSessionIds?: Set<string>;
  namespace: string;
  namespaces: NamespaceOption[];
  onNamespaceChange: (ns: string) => void;
  namespaceSummaries: NamespaceSummaries;
  /** Drilldown tree task click — same selection semantics as the job cards. */
  onSelectTask: (nsId: string, sessionId: string) => void;
  /**
   * "host-pane" (default): the host pane sash owns the width — use width:100%
   * so the pane's sash constrains us correctly (desktop plugin).
   * "fixed": the shell provides no host sash — use DEFAULT_WIDTH so the flex
   * row leaves room for the log panel (web AppShell).
   */
  sizingMode?: "host-pane" | "fixed";
  /** Width override for sizingMode="fixed" — set by AppShell's drag handler. */
  externalWidth?: number;
  /** mousedown handler wired to the drag handle (web AppShell only). */
  onResizeMouseDown?: (e: React.MouseEvent) => void;
  /** double-click on the handle resets to DEFAULT_WIDTH (web AppShell only). */
  onResizeDoubleClick?: () => void;
}

// onSelectSession stays in the Props contract (both shells pass the
// snapshot's seam through) but the drilldown tree routes all selection
// through onSelectTask — the component itself no longer reads it.
export function Sidebar({ jobs, activeSessionId, quote, wsState, onAvatarClick, onOdinClick, onTogglePinSession, pinnedSessionIds, onCancelJob, terminatingSessionIds, namespace, namespaces, onNamespaceChange, namespaceSummaries, onSelectTask, sizingMode = "host-pane", externalWidth, onResizeMouseDown, onResizeDoubleClick }: Props) {
  const { theme, setTheme } = useTheme();
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const [compactOverride, setCompactOverride] = useState<"auto" | "compact">(() => readCompactPref());
  const [query, setQuery] = useState<string>("");
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Register this instance's focus fn with the module-scope seam so the
  // ⌘K "Find session" command can focus the input imperatively.
  useEffect(() => {
    findSessionUi.register(() => filterInputRef.current?.focus());
    return () => findSessionUi.unregister();
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  const widthMode = getDisplayMode(width);
  // Manual compact overrides the width-derived mode until toggled off.
  // Pane resizes never defeat the choice; only the toggle exits compact.
  const displayMode: DisplayMode = compactOverride === "compact" ? "compact" : widthMode;
  // h1/count/quote hide only when the pane is physically narrow (not on manual compact).
  const isWidthCompact = widthMode === "compact";

  // Session count: total and matching across all worlds (issue #117).
  const { totalSessions, matchingSessions } = useMemo(() => {
    const q = query.trim();
    if (!q) return { totalSessions: jobs.length, matchingSessions: jobs.length };
    let total = 0;
    let matching = 0;
    for (const ns of namespaces) {
      const summary = namespaceSummaries[ns.id];
      if (!summary || summary.error) continue;
      const tasks = summary.jobs
        .filter((j) => j.status !== "purged")
        .map(parseJob);
      total += tasks.length;
      matching += tasks.filter((j) => matchesQuery(j, q)).length;
    }
    return { totalSessions: total, matchingSessions: matching };
  }, [query, namespaces, namespaceSummaries, jobs.length]);

  const toggleCompact = () => {
    const next: "auto" | "compact" = compactOverride === "compact" ? "auto" : "compact";
    setCompactOverride(next);
    try { localStorage.setItem(LS_DISPLAY_MODE_KEY, next); } catch { /* storage unavailable */ }
  };

  return (
    <nav
      ref={navRef}
      className="sidebar"
      aria-label="Agent sessions"
      style={{ width: sizingMode === "fixed" ? (externalWidth ?? DEFAULT_WIDTH) : "100%", height: "100%" }}
    >
      <div className="sidebar-header">
        {/* Header row: brand on the left; right-aligned cluster in order
         * count → compact-toggle → theme toggle → status badge (far right).
         * Width-compact degradation (<240px): the title and session count hide
         * first — the compact toggle and status badge always stay visible. */}
        <div className="brand">
          <button
            className="odin-avatar-btn"
            onClick={onOdinClick}
            aria-label="View Odin profile"
            title="View Odin profile"
          >
            <img
              src={avatarUrl("odin", theme === "light" ? "light" : "dark") ?? ""}
              alt="Odin"
            />
          </button>
          {!isWidthCompact && <h1>Hlidskjalf</h1>}
          {!isWidthCompact && (
            <div className="count" aria-live="polite">
              {query.trim()
                ? `${matchingSessions} of ${totalSessions} session${totalSessions !== 1 ? "s" : ""}`
                : `${jobs.length} session${jobs.length !== 1 ? "s" : ""}`}
            </div>
          )}
          <button
            type="button"
            className="compact-toggle-btn"
            onClick={toggleCompact}
            aria-pressed={compactOverride === "compact"}
            title={compactOverride === "compact" ? "standard view — the full-size tree" : "compact view — the denser tree"}
            aria-label={compactOverride === "compact" ? "Switch to standard view" : "Switch to compact view"}
          >
            {compactOverride === "compact" ? "»" : "«"}
          </button>
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
          <span className="brand-wss-badge">
            <StatusBadge state={wsState} />
          </span>
        </div>
        {!isWidthCompact && (
          <div className="quote" role="note">
            &ldquo;{quote}&rdquo;
          </div>
        )}
        {/* Session filter (issue #117): visible when pane is not width-compact */}
        {!isWidthCompact && (
          <div className="sidebar-filter">
            <input
              ref={filterInputRef}
              className="sidebar-filter__input"
              type="search"
              placeholder="filter sessions…"
              aria-label="Filter sessions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                className="sidebar-filter__clear"
                aria-label="Clear filter"
                title="Clear filter"
                onClick={() => { setQuery(""); filterInputRef.current?.focus(); }}
              >
                ×
              </button>
            )}
          </div>
        )}
        <NamespaceTree
          namespace={namespace}
          namespaces={namespaces}
          summaries={namespaceSummaries}
          onNamespaceChange={onNamespaceChange}
          onSelectTask={onSelectTask}
          activeSessionId={activeSessionId}
          displayMode={displayMode}
          onAvatarClick={onAvatarClick}
          onTogglePinSession={onTogglePinSession}
          pinnedSessionIds={pinnedSessionIds}
          onCancelJob={onCancelJob}
          terminatingSessionIds={terminatingSessionIds}
          query={query}
          onClearQuery={() => setQuery("")}
        />
      </div>
      {/* Desktop port: the old flat job list is gone — jobs now live as job
       * cards branched beneath their namespace in the drilldown tree above,
       * rendered exactly as the old active-namespace list rendered them. */}
      {/* Desktop port: no in-pane drag handle — the host pane sash resizes us. */}
      {sizingMode === "fixed" && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResizeDoubleClick}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          title="Drag to resize · Double-click to reset"
        />
      )}
    </nav>
  );
}
