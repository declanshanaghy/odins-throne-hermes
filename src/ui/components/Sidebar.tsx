import { useState, useRef, useEffect } from "react";
import type { DisplayJob } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import type { NamespaceOption } from "../hooks/useNamespace";
import type { NamespaceSummaries } from "../hooks/useNamespaceSummaries";
import { JobCard } from "./JobCard";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { StatusBadge } from "./StatusBadge";
import { NamespaceTree } from "./NamespaceTree";
import odinLight from "../../assets/profiles/odin-light.png";
import odinDark from "../../assets/profiles/odin-dark.png";

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
  onCancelJob?: (sessionId: string) => void;
  terminatingSessionIds?: Set<string>;
  namespace: string;
  namespaces: NamespaceOption[];
  onNamespaceChange: (ns: string) => void;
  namespaceSummaries: NamespaceSummaries;
}

export function Sidebar({ jobs, activeSessionId, quote, wsState, onSelectSession, onAvatarClick, onOdinClick, onTogglePinSession, pinnedSessionIds, onCancelJob, terminatingSessionIds, namespace, namespaces, onNamespaceChange, namespaceSummaries }: Props) {
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
              src={theme === "light" ? odinLight : odinDark}
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
          displayMode={displayMode}
        />
      </div>
      <div className="card-list" role="list" aria-label="Job sessions">
        {jobs.length === 0 ? (
          !isCompact && (
            <div
              style={{
                padding: "1rem",
                fontSize: "0.8rem",
                color: "var(--text-void)",
                fontStyle: "italic",
              }}
            >
              No agent jobs found
            </div>
          )
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.sessionId}
              job={job}
              isActive={job.sessionId === activeSessionId}
              onClick={() => onSelectSession(job.sessionId)}
              onAvatarClick={onAvatarClick}
              isPinned={pinnedSessionIds?.has(job.sessionId) ?? false}
              onTogglePin={onTogglePinSession ? () => onTogglePinSession(job.sessionId) : undefined}
              onCancelJob={onCancelJob}
              displayMode={displayMode}
              isTerminating={terminatingSessionIds?.has(job.sessionId) ?? false}
            />
          ))
        )}
      </div>
      {/* Desktop port: no in-pane drag handle — the host pane sash resizes us. */}
    </nav>
  );
}
