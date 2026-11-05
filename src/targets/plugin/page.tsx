// Per-session workspace surfaces (issue:6).
//
// ThronePage renders the ported LogViewer terminal for ONE session:
//   - as the content of a per-session workspace tab (sessionTabs.tsx passes
//     sessionId + the namespace/job captured at open time)
//   - as the static /odins-throne route page (no sessionId → empty state)
//
// The per-session viewer itself lives in the shared ui core
// (ui/components/SessionLogViewer.tsx) so the web target mounts the same
// self-contained stream for its selected session. Every mounted viewer owns
// its OWN WebSocket connection and useLogStream instance, so several session
// tabs can stream independently without replacing each other.

import { useRef } from "react";
import { ErrorBoundary } from "../../ui/components/ErrorBoundary";
import { SessionLogViewer, SessionLogViewerEmpty } from "../../ui/components/SessionLogViewer";
import { useThrone } from "../../ui/store";
import { useTheme } from "../../ui/hooks/useTheme";
import { useExternalLinkRouter } from "./externalLinks";
import type { DisplayJob } from "../../ui/lib/types";

export function ThronePage({
  sessionId,
  tabNamespace,
  jobSnapshot,
}: {
  /** Session this tab/page streams. Absent on the static landing page. */
  sessionId?: string;
  /** Namespace captured at open time (tab content); defaults to the pane's. */
  tabNamespace?: string;
  /** Job captured at open time (tab content header fallback). */
  jobSnapshot?: DisplayJob | null;
}) {
  const snap = useThrone();
  const { theme } = useTheme();
  const namespace = tabNamespace ?? snap?.namespace ?? "fenrir-agents";
  // Wiki/session links in the log viewer: the app denies window.open, so
  // route external link clicks to the real browser (issue #103).
  const rootRef = useRef<HTMLDivElement>(null);
  useExternalLinkRouter(rootRef);
  return (
    <div
      ref={rootRef}
      className="odins-throne-root"
      data-theme={theme === "light" ? "light" : undefined}
      style={{ width: "100%", height: "100%" }}
    >
      {sessionId ? (
        <ErrorBoundary>
          <SessionLogViewer
            sessionId={sessionId}
            namespace={namespace}
            jobSnapshot={jobSnapshot ?? null}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <SessionLogViewerEmpty />
        </ErrorBoundary>
      )}
    </div>
  );
}
