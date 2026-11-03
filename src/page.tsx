// Per-session workspace surfaces (issue:6).
//
// ThronePage renders the ported LogViewer terminal for ONE session:
//   - as the content of a per-session workspace tab (sessionTabs.tsx passes
//     sessionId + the namespace/job captured at open time)
//   - as the static /odins-throne route page (no sessionId → empty state)
//
// Every mounted per-session viewer owns its OWN WebSocket connection and
// useLogStream instance, so several session tabs can stream independently
// without replacing each other. Subscribe/unsubscribe, temp-log replay,
// pod-start retry and reconnect all key off this component's sessionId.

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { LogViewer } from "./ui/components/LogViewer";
import { useThrone } from "./store";
import { useTheme } from "./ui/hooks/useTheme";
import { useWebSocket } from "./ui/hooks/useWebSocket";
import { useLogStream } from "./ui/hooks/useLogStream";
import {
  isPinned as checkIsPinned,
  pinSession,
  unpinSession,
  isCacheNearCap,
} from "./ui/lib/localStorageLogs";
import type { CachedSessionMeta } from "./ui/lib/localStorageLogs";
import type { DisplayJob } from "./ui/lib/types";
import type { ServerMessage } from "./ui/lib/types";

// ─── per-session self-contained viewer ───────────────────────────────────────

function LogViewerConnected({
  sessionId,
  tabNamespace,
  jobSnapshot,
}: {
  sessionId: string;
  /** Namespace captured at open time — this tab's WS always dials it. */
  tabNamespace: string;
  /** Job captured at open time — header fallback until jobs include the session. */
  jobSnapshot: DisplayJob | null;
}) {
  const snap = useThrone();
  const jobs = snap?.jobs ?? [];

  const {
    entries,
    clearEntries,
    handleMessage: handleLogMessage,
    replayFromCache,
    replayFromTempLog,
    setLiveSkipCount,
    isTtlExpired,
    isNodeUnreachable,
    streamError,
    replayedFromCache,
    isConnecting,
    isPodStarting,
    showPodStartTimeout,
  } = useLogStream();

  const subscribedRef = useRef<string | null>(null);
  const [isFixture, setIsFixture] = useState(false);
  const [isPinned, setIsPinned] = useState(() => checkIsPinned(sessionId));

  // Keep isPinned in sync when toggled via the sidebar or another tab
  useEffect(() => {
    setIsPinned(checkIsPinned(sessionId));
  }, [sessionId, snap?.pinnedSessionIds]);

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      if (msg.type === "fixture-start" && "sessionId" in msg && msg.sessionId === sessionId) {
        setIsFixture(true);
      }
      if (msg.type === "stream-end" && "sessionId" in msg && msg.sessionId === sessionId) {
        setIsFixture(false);
      }
      if (
        (msg.type === "log-line" ||
          msg.type === "stream-error" ||
          msg.type === "stream-end" ||
          msg.type === "verdict") &&
        "sessionId" in msg &&
        msg.sessionId === sessionId
      ) {
        handleLogMessage(msg);
      }
    },
    [handleLogMessage, sessionId],
  );

  // This tab's socket always dials the namespace the session was opened in —
  // it must NOT follow the pane's namespace switches (a cross-world click in
  // the pane must not rewire this tab to a world where its session doesn't exist).
  const { state: wsState, send } = useWebSocket(onMessage, tabNamespace);

  // Unsubscribe when unmounting (tab closed)
  useEffect(() => {
    return () => {
      if (subscribedRef.current) {
        send({ type: "unsubscribe", sessionId: subscribedRef.current });
        subscribedRef.current = null;
      }
    };
  }, [send]);

  // Initial subscribe / cache replay when WS first opens
  const initializedRef = useRef(false);
  useEffect(() => {
    if (wsState !== "open" || initializedRef.current) return;
    initializedRef.current = true;

    const selectedJob = jobs.find((j) => j.sessionId === sessionId);
    if (selectedJob?.status === "cached") {
      // Cached-only session (pinned, no live pod): replay from the pin cache,
      // never subscribe to the server.
      subscribedRef.current = null;
      clearEntries();
      setTimeout(() => replayFromCache(sessionId), 0);
    } else {
      clearEntries();
      const cachedLineCount = replayFromTempLog(sessionId);
      subscribedRef.current = sessionId;
      if (cachedLineCount > 0) setLiveSkipCount(cachedLineCount);
      send({ type: "subscribe", sessionId });
    }
  // jobs intentionally omitted: only run once on first open, not on every job update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsState]);

  // Reconnect: re-subscribe on WS reconnect (skip if TTL expired/node gone/cached)
  const isTtlExpiredRef = useRef(isTtlExpired);
  isTtlExpiredRef.current = isTtlExpired;
  const isNodeUnreachableRef = useRef(isNodeUnreachable);
  isNodeUnreachableRef.current = isNodeUnreachable;
  const prevWsState = useRef(wsState);
  useEffect(() => {
    const wasDisconnected = prevWsState.current !== "open";
    prevWsState.current = wsState;
    if (
      wsState === "open" &&
      wasDisconnected &&
      initializedRef.current &&
      !isTtlExpiredRef.current &&
      !isNodeUnreachableRef.current
    ) {
      const activeJob = jobs.find((j) => j.sessionId === sessionId);
      if (activeJob?.status === "cached") return;

      clearEntries();
      const cachedLineCount = replayFromTempLog(sessionId);
      if (cachedLineCount > 0) setLiveSkipCount(cachedLineCount);
      subscribedRef.current = sessionId;
      send({ type: "subscribe", sessionId });
    }
  }, [wsState, sessionId, send, clearEntries, replayFromTempLog, setLiveSkipCount, jobs]);

  // Pod-start auto-retry: retry subscribe every 4 s, timeout after 2 minutes
  const podStartBeginRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPodStarting) {
      podStartBeginRef.current = null;
      return;
    }
    if (podStartBeginRef.current === null) podStartBeginRef.current = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - (podStartBeginRef.current ?? Date.now());
      if (elapsed >= 120_000) {
        clearInterval(intervalId);
        showPodStartTimeout();
        return;
      }
      send({ type: "subscribe", sessionId });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [isPodStarting, sessionId, send, showPodStartTimeout]);

  // Header: the live job when this session is in the active namespace's list,
  // else the snapshot captured when the tab was opened.
  const activeJob = jobs.find((j) => j.sessionId === sessionId) ?? jobSnapshot ?? null;

  // Pin toggle: the pane's store action when the session lives in the active
  // namespace (keeps the sidebar in sync); a local cache write otherwise
  // (cross-world session the pane's job list can't see).
  const handleTogglePin = useCallback(() => {
    if (jobs.some((j) => j.sessionId === sessionId) && snap) {
      snap.onTogglePinSession(sessionId);
    } else {
      const job = jobSnapshot;
      if (checkIsPinned(sessionId)) {
        unpinSession(sessionId);
      } else if (job) {
        const meta: CachedSessionMeta = {
          sessionId,
          name: job.name,
          issueNumber: Number(job.issue) || 0,
          agent: job.agentKey ?? "unknown",
          step: Number(job.step) || 1,
          startedAt: job.startTime ? new Date(job.startTime).toISOString() : null,
          completedAt: job.completionTime ? new Date(job.completionTime).toISOString() : null,
          issueTitle: job.issueTitle,
          branchName: job.branchName,
          pinnedAt: Date.now(),
        };
        pinSession(sessionId, meta);
      }
    }
    // Optimistic flip; the sync effect reconciles with the cache on the next publish
    setIsPinned((prev) => !prev);
  }, [jobs, snap, sessionId, jobSnapshot]);

  return (
    <LogViewer
      entries={entries}
      activeJob={activeJob}
      isFixture={isFixture}
      isTtlExpired={isTtlExpired}
      isNodeUnreachable={isNodeUnreachable}
      streamError={streamError}
      isPinned={isPinned}
      onTogglePin={handleTogglePin}
      onAvatarClick={snap?.onAvatarClick ?? (() => {})}
      replayedFromCache={replayedFromCache}
      isConnecting={isConnecting}
      isPodStarting={isPodStarting}
      onCancelJob={snap?.onCancelJob ?? (() => {})}
      onSetSpeed={(speed) => send({ type: "set-speed", sessionId, speed })}
    />
  );
}

// ─── static landing page at /odins-throne ────────────────────────────────────

function LogViewerEmpty() {
  const snap = useThrone();
  return (
    <LogViewer
      entries={[]}
      activeJob={null}
      isFixture={false}
      isTtlExpired={false}
      isNodeUnreachable={false}
      streamError={null}
      isPinned={false}
      onTogglePin={() => {}}
      onAvatarClick={snap?.onAvatarClick ?? (() => {})}
      replayedFromCache={false}
      isConnecting={false}
      isPodStarting={false}
      onCancelJob={() => {}}
      onSetSpeed={() => {}}
    />
  );
}

// ─── exported page component ──────────────────────────────────────────────────

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
  return (
    <div
      className="odins-throne-root"
      data-theme={theme === "light" ? "light" : undefined}
      style={{ width: "100%", height: "100%" }}
    >
      {sessionId ? (
        <ErrorBoundary>
          <LogViewerConnected
            sessionId={sessionId}
            tabNamespace={namespace}
            jobSnapshot={jobSnapshot ?? null}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <LogViewerEmpty />
        </ErrorBoundary>
      )}
    </div>
  );
}
