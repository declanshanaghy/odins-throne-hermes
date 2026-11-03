import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServerMessage } from "./lib/types";
import { randomQuote } from "./lib/constants";
import { useWebSocket } from "./hooks/useWebSocket";
import { useNamespace } from "./hooks/useNamespace";
import { useNamespaceSummaries } from "./hooks/useNamespaceSummaries";
import { useJobs } from "./hooks/useJobs";
import { useTheme } from "./hooks/useTheme";
import { otFetch } from "../upstream";
import { throneStore, type ThroneSnapshot } from "../store";
import {
  isPinned as checkIsPinned,
  pinSession,
  unpinSession,
  isCacheNearCap,
} from "./lib/localStorageLogs";
import type { CachedSessionMeta } from "./lib/localStorageLogs";
import { openSessionTab } from "../sessionTabs";

/**
 * StoreBridge — owns the WebSocket, job list, namespace, pins, and Ragnarök.
 * Log streaming has moved to each per-session ThronePage tab (issue:6), so
 * this bridge no longer manages per-session entries or subscriptions.
 */
export function App() {
  const quote = useMemo(() => randomQuote(), []);
  const { theme } = useTheme();
  const { namespace, namespaces, setNamespace } = useNamespace();
  const [profileAgent, setProfileAgent] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ sessionId: string; jobTitle: string } | null>(null);
  const { jobs, handleMessage: handleJobsMessage, refreshCached } = useJobs();

  const jobsActivityKey = useMemo(
    () => jobs.map((j) => `${j.sessionId}:${j.status}`).join("|"),
    [jobs],
  );
  const namespaceSummaries = useNamespaceSummaries(namespaces, namespace, jobsActivityKey);

  // Most recently opened session — used for sidebar highlighting only.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [terminatingSessionIds, setTerminatingSessionIds] = useState<Set<string>>(new Set());

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      handleJobsMessage(msg);
    },
    [handleJobsMessage],
  );

  const { state: wsState, error: wsError, send } = useWebSocket(onMessage, namespace);

  /**
   * Session click: open (or focus) a dedicated workspace tab for this session.
   * Each tab manages its own WS connection and log stream (issue:6).
   */
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      openSessionTab(sessionId);
    },
    [],
  );

  /**
   * Drilldown tree task click (issue:4) — same as handleSelectSession but may
   * switch namespace first when the task lives in a different world.
   */
  const handleSelectTask = useCallback(
    (ns: string, sessionId: string) => {
      setActiveSessionId(sessionId);
      if (ns !== namespace) {
        setNamespace(ns);
      }
      openSessionTab(sessionId);
    },
    [namespace, setNamespace],
  );

  // Set of all pinned sessionIds (for sidebar display across all jobs)
  const pinnedSessionIds = useMemo(
    () => new Set(jobs.filter((j) => checkIsPinned(j.sessionId)).map((j) => j.sessionId)),
    [jobs],
  );

  /** Toggle pin for any session by sessionId. Used by both header and sidebar. */
  const handleTogglePinForSession = useCallback(
    (sessionId: string) => {
      const job = jobs.find((j) => j.sessionId === sessionId);
      if (!job) return;

      if (checkIsPinned(sessionId)) {
        unpinSession(sessionId);
        refreshCached();
      } else {
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
        const ok = pinSession(sessionId, meta);
        if (ok) {
          refreshCached();
          if (isCacheNearCap()) {
            setStorageWarning("Odin’s memory is nearly full — oldest pins will be evicted.");
            setTimeout(() => setStorageWarning(null), 5000);
          }
        }
      }
    },
    [jobs, refreshCached],
  );

  /** Open Ragnarök confirmation dialog for a running job. */
  const handleOpenCancelDialog = useCallback(
    (sessionId: string) => {
      const job = jobs.find((j) => j.sessionId === sessionId);
      if (!job || job.status !== "running") return;
      const jobTitle = job.issueTitle
        ? `#${job.issue} – ${job.issueTitle}`
        : `#${job.issue} – ${job.agentName} Step ${job.step}`;
      setCancelTarget({ sessionId, jobTitle });
    },
    [jobs],
  );

  /** Confirmed: call DELETE /api/jobs/:sessionId to kill the K8s job. */
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    const res = await otFetch(`/api/jobs/${encodeURIComponent(cancelTarget.sessionId)}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const { sessionId } = cancelTarget;
    setCancelTarget(null);
    setTerminatingSessionIds((prev) => new Set(prev).add(sessionId));
    setTimeout(() => {
      setTerminatingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }, 3000);
    setToast({ message: `Ragnarok unleashed — ${sessionId} terminated`, id: Date.now() });
  }, [cancelTarget]);

  // Publish the snapshot both surfaces render from.
  const snapshot: ThroneSnapshot = {
    jobs,
    activeSessionId,
    quote,
    theme,
    wsState,
    wsError,
    namespace,
    namespaces,
    setNamespace,
    namespaceSummaries,
    onSelectSession: handleSelectSession,
    onSelectTask: handleSelectTask,
    onAvatarClick: setProfileAgent,
    onOdinClick: () => setProfileAgent("odin"),
    onTogglePinSession: handleTogglePinForSession,
    onCancelJob: handleOpenCancelDialog,
    pinnedSessionIds,
    terminatingSessionIds,
    profileAgent,
    setProfileAgent,
    cancelTarget,
    setCancelTarget,
    confirmCancel: handleConfirmCancel,
    toast,
    dismissToast: () => setToast(null),
    storageWarning,
  };
  useEffect(() => {
    throneStore.publish(snapshot);
  });

  // Suppress unused-variable warning: send is held for future use (speed control
  // is now per-tab, but the WS is still used for job-list updates).
  void send;

  return null;
}
