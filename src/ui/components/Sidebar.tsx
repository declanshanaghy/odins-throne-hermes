import { useState, useRef, useEffect } from "react";
import type { DisplayJob } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import type { NamespaceOption } from "../hooks/useNamespace";
import type { NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { StatusBadge } from "./StatusBadge";
import { NamespaceTree } from "./NamespaceTree";
import { avatarUrl } from "../lib/constants";

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
}

// onSelectSession stays in the Props contract (both shells pass the
// snapshot's seam through) but the drilldown tree routes all selection
// through onSelectTask — the component itself no longer reads it.
export function Sidebar({ jobs, activeSessionId, quote, wsState, onAvatarClick, onOdinClick, onTogglePinSession, pinnedSessionIds, onCancelJob, terminatingSessionIds, namespace, namespaces, onNamespaceChange, namespaceSummaries, onSelectTask }: Props) {
  const { theme, setTheme } = useTheme();
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);
  const navRef = useRef<HTMLElement | null>(null);

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

  const displayMode = getDisplayMode(width);
  const isCompact = displayMode === "compact";

  return (
    <nav
      ref={navRef}
      className="sidebar"
      aria-label="Agent sessions"
      style={{ width: "100%", height: "100%" }}
    >
      <div className="sidebar-header">
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
          {!isCompact && <h1>Hlidskjalf</h1>}
          {!isCompact && (
            <span className="brand-wss-badge">
              <StatusBadge state={wsState} />
            </span>
          )}
        </div>
        {!isCompact && (
          <>
            <div className="quote" role="note">
              &ldquo;{quote}&rdquo;
            </div>
            <div className="count-row">
              <div className="count" aria-live="polite">
                {jobs.length} session{jobs.length !== 1 ? "s" : ""}
              </div>
              <ThemeSwitcher theme={theme} setTheme={setTheme} />
            </div>
          </>
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
        />
      </div>
      {/* Desktop port: the old flat job list is gone — jobs now live as job
       * cards branched beneath their namespace in the drilldown tree above,
       * rendered exactly as the old active-namespace list rendered them. */}
      {/* Desktop port: no in-pane drag handle — the host pane sash resizes us. */}
    </nav>
  );
}
