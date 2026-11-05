import { useCallback, useEffect, useMemo, useState } from "react";
import type { ServerMessage, DisplayJob } from "./lib/types";
import { randomQuote } from "./lib/constants";
import { useWebSocket } from "./hooks/useWebSocket";
import { useNamespace } from "./hooks/useNamespace";
import { useNamespaceCycleKey } from "./hooks/useNamespaceCycleKey";
import { useNamespaceSummaries } from "./hooks/useNamespaceSummaries";
import { useJobs } from "./hooks/useJobs";
import { useTheme } from "./hooks/useTheme";
import { getPlatform } from "./platform";
import { throneStore, type ThroneSnapshot } from "./store";
import {
  isPinned as checkIsPinned,
  pinSession,
  unpinSession,
  isCacheNearCap,
  migrateRemoveDuplicateLogs,
  evictExpiredLogs,
} from "./lib/localStorageLogs";
import type { CachedSessionMeta } from "./lib/localStorageLogs";

/**
 * StoreBridge — the ported App. In the browser SPA this component rendered the
 * whole page; in the desktop plugin it owns the pane-level logic (the jobs
 * WebSocket, job list state machine, pin registry, Ragnarök, namespace tree)
 * and publishes a snapshot to the module store instead of rendering JSX. The
 * right-docked pane renders the Sidebar from this snapshot; per-session
 * workspace tabs render the LogViewer from it (issue:6) — each tab owns its
 * own log stream (ui/components/SessionLogViewer.tsx), so this bridge no
 * longer manages per-session entries or subscriptions.
 */
export function App() {
  const quote = useMemo(() => randomQuote(), []);
  const { theme } = useTheme();
  const { namespace, namespaces, setNamespace } = useNamespace();
  useNamespaceCycleKey(namespaces, namespace, setNamespace);
  const [profileAgent, setProfileAgent] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ sessionId: string; jobTitle: string } | null>(null);
  const { jobs, handleMessage: handleJobsMessage, refreshCached } = useJobs();

  // Namespace tree (issue:2): per-namespace summaries. The live jobs list is
  // scoped to the active namespace, so a signature of it doubles as the
  // "activity" signal that refetches that namespace's summary.
  const jobsActivityKey = useMemo(
    () => jobs.map((j) => `${j.sessionId}:${j.status}`).join("|"),
    [jobs],
  );
  const namespaceSummaries = useNamespaceSummaries(namespaces, namespace, jobsActivityKey);

  // Migrate existing duplicate log: entries for pinned sessions on mount
  // and evict non-pinned temp logs older than the 1-hour TTL
  useEffect(() => {
    migrateRemoveDuplicateLogs();
    evictExpiredLogs();
  }, []);

  // Most recently opened session — used for sidebar highlighting only.
  // Per-session log streaming lives in each workspace tab (issue:6).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);
  const [terminatingSessionIds, setTerminatingSessionIds] = useState<Set<string>>(new Set());

  // The pane's socket carries the job list feed; every log stream dials its
  // own per-session WebSocket inside its tab.
  const onMessage = useCallback(
    (msg: ServerMessage) => {
      handleJobsMessage(msg);
    },
    [handleJobsMessage],
  );

  const { state: wsState, error: wsError } = useWebSocket(onMessage, namespace);

  /**
   * Session click: open (or focus) a dedicated workspace tab for this session.
   * Each tab manages its own WS connection and log stream (issue:6); the
   * current tab is never navigated away. The platform adapter decides what
   * "open the session's log view" means — a stacked workspace tab in the
   * desktop plugin, a no-op on the web shell where the LogViewer follows the
   * store's activeSessionId.
   */
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      getPlatform().openSessionLog(sessionId, {
        namespace,
        job: jobs.find((j) => j.sessionId === sessionId) ?? null,
      });
    },
    [namespace, jobs],
  );

  /**
   * Drilldown tree task click (issue:4) — same as handleSelectSession but the
   * task may live in another namespace: switch the pane's world first, and
   * hand the task's own namespace to the tab so its socket always dials the
   * world its session lives in. The clicked card's own job is the tab's
   * header snapshot when the active-namespace list doesn't carry it.
   */
  const handleSelectTask = useCallback(
    (ns: string, sessionId: string, job?: DisplayJob) => {
      setActiveSessionId(sessionId);
      if (ns !== namespace) {
        setNamespace(ns);
      }
      getPlatform().openSessionLog(sessionId, {
        namespace: ns,
        job: job ?? jobs.find((j) => j.sessionId === sessionId) ?? null,
      });
    },
    [namespace, jobs, setNamespace],
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
        // Unpin: remove from cache
        unpinSession(sessionId);
        refreshCached();
      } else {
        // Pin: save log buffer to cache
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
            setStorageWarning("Odin\u2019s memory is nearly full \u2014 oldest pins will be evicted.");
            setTimeout(() => setStorageWarning(null), 5000);
          }
        }
      }
    },
    [jobs, refreshCached],
  );

  /** Open Ragnarök confirmation dialog for a cancellable job (its pod still
   * lives: running or pending). The card's own job object is preferred — the
   * active-namespace list may not carry it. */
  const handleOpenCancelDialog = useCallback(
    (sessionId: string, jobFromCard?: DisplayJob) => {
      const job = jobFromCard ?? jobs.find((j) => j.sessionId === sessionId);
      if (!job || (job.status !== "running" && job.status !== "pending")) return;
      const jobTitle = job.issueTitle
        ? `#${job.issue} \u2013 ${job.issueTitle}`
        : `#${job.issue} \u2013 ${job.agentName} Step ${job.step}`;
      setCancelTarget({ sessionId, jobTitle });
    },
    [jobs],
  );

  /** Confirmed: call DELETE /api/jobs/:sessionId to kill the K8s job. The
   *  pod is gone, so the session's workspace tab closes with it (issue:6). */
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    const res = await getPlatform().restFetch(`/api/jobs/${encodeURIComponent(cancelTarget.sessionId)}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const { sessionId } = cancelTarget;
    setCancelTarget(null);
    // The pod is gone; its log tab closes with it (reference design).
    getPlatform().closeSessionLog(sessionId);
    // Flash the card as terminating, then clear after 3s
    setTerminatingSessionIds((prev) => new Set(prev).add(sessionId));
    setTimeout(() => {
      setTerminatingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }, 3000);
    // Show toast confirmation
    setToast({ message: `Ragnarok unleashed — ${sessionId} terminated`, id: Date.now() });
  }, [cancelTarget]);

  // Publish the snapshot both surfaces render from. Runs after commit so
  // consumer updates never collide with this component's own render.
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

  return null;
}
