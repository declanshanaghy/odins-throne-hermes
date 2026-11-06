// Per-session self-contained log terminal (issue:6).
//
// SessionLogViewer renders the ported LogViewer terminal for ONE session.
// Every mounted instance owns its OWN WebSocket connection and useLogStream
// instance, so several sessions can stream independently without replacing
// each other — the desktop plugin mounts one per workspace tab, the web shell
// mounts one for the selected session. Subscribe/unsubscribe, temp-log
// replay, pod-start retry and reconnect all key off this component's
// sessionId, never off the shared store.

import { useCallback, useEffect, useRef, useState } from "react";
import { LogViewer } from "./LogViewer";
import { useThrone } from "../store";
import { useWebSocket } from "../hooks/useWebSocket";
import { useLogStream } from "../hooks/useLogStream";
import {
  isPinned as checkIsPinned,
  pinSession,
  unpinSession,
} from "../lib/localStorageLogs";
import type { CachedSessionMeta } from "../lib/localStorageLogs";
import type { DisplayJob, ServerMessage } from "../lib/types";

export interface SessionLogViewerProps {
  sessionId: string;
  /** Namespace captured at open time — this viewer's WS always dials it. */
  namespace: string;
  /** Job captured at open time — header fallback until jobs include the session. */
  jobSnapshot: DisplayJob | null;
}

/**
 * The per-session log terminal. Owns its WebSocket (dialed against the
 * namespace captured at open time — a pane namespace switch must NOT rewire
 * it), its useLogStream instance, and its subscribe lifecycle.
 */
export function SessionLogViewer({
  sessionId,
  namespace: tabNamespace,
  jobSnapshot,
}: SessionLogViewerProps) {
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

  // This viewer's socket always dials the namespace the session was opened
  // in — it must NOT follow the pane's namespace switches (a cross-world
  // click in the pane must not rewire this viewer to a world where its
  // session doesn't exist).
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
  // else the snapshot captured when the viewer was opened.
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
          // Realm captured at pin time — the tree hangs the memory card on
          // this realm's vine (the tab's realm, not the pane's active one).
          namespace: tabNamespace,
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

/**
 * The empty log terminal — the static /odins-throne landing page in the
 * plugin, and the web shell's no-session-selected state.
 */
export function SessionLogViewerEmpty() {
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
