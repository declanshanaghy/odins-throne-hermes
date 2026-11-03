// Workspace route pages for Odin's Throne.
//
// Static page (/odins-throne): landing / empty state — registered at startup.
//
// Per-session pages (/odins-throne/:sessionId): registered dynamically by
// sessionTabs.tsx when the user clicks a session. Each page owns its own WS
// connection and log stream state so multiple session tabs stream independently.

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { LogViewer } from "./ui/components/LogViewer";
import { useThrone } from "./store";
import { useTheme } from "./ui/hooks/useTheme";
import { useWebSocket } from "./ui/hooks/useWebSocket";
import { useLogStream } from "./ui/hooks/useLogStream";
import { isPinned as checkIsPinned } from "./ui/lib/localStorageLogs";
import type { ServerMessage } from "./ui/lib/types";

// ─── per-session self-contained viewer ───────────────────────────────────────

function LogViewerConnected({ sessionId }: { sessionId: string }) {
  const snap = useThrone();
  const jobs = snap?.jobs ?? [];
  const namespace = snap?.namespace ?? "fenrir-agents";

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

  // Keep isPinned in sync when toggled via the sidebar or header
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

  const { state: wsState, send } = useWebSocket(onMessage, namespace);

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

  const activeJob = jobs.find((j) => j.sessionId === sessionId) ?? null;

  const handleTogglePin = useCallback(() => {
    snap?.onTogglePinSession(sessionId);
    // Optimistically flip local isPinned for immediate UI response
    setIsPinned((prev) => !prev);
  }, [snap, sessionId]);

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
      onCancelJob={snap?.onCancelJob ?? (() => {})}
      onSetSpeed={() => {}}
    />
  );
}

// ─── exported page component ──────────────────────────────────────────────────

export function ThronePage({ sessionId }: { sessionId?: string }) {
  const snap = useThrone();
  const { theme } = useTheme();
  return (
    <div
      className="odins-throne-root"
      data-theme={theme === "light" ? "light" : undefined}
      style={{ width: "100%", height: "100%" }}
    >
      {sessionId ? (
        <ErrorBoundary>
          {snap ? (
            <LogViewerConnected sessionId={sessionId} />
          ) : (
            <div className="throne-boot">
              Awakening the Allfather — open the Odin's Throne pane to start.
            </div>
          )}
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <LogViewerEmpty />
        </ErrorBoundary>
      )}
    </div>
  );
}
