// Per-namespace job summaries for the namespace tree (issue:2).
//
// The WebSocket feed is scoped to the ACTIVE namespace only, and the upstream
// monitor has no cross-namespace summary endpoint — but it does expose
// `GET /api/jobs?namespace=<id>`, which returns that namespace's raw K8s
// AgentJobs (purged included). Those get normalized into the wire Job shape
// (lib/restJobs.ts — the endpoint does NOT apply the mapping the WS feed
// uses) and are exactly the per-namespace data the tree needs. So the tree
// aggregates client-side: one lightweight REST call per namespace, refreshed
// on an interval and whenever the live feed signals activity.

import { useCallback, useEffect, useRef, useState } from "react";
import { getPlatform } from "../platform";
import { normalizeRestJobs } from "../lib/restJobs";
import type { Job } from "../lib/types";
import type { NamespaceOption } from "./useNamespace";

export type JobStatus = Job["status"];

/** Display order for status stats — actionable states first. */
export const JOB_STATUSES: readonly JobStatus[] = [
  "running",
  "pending",
  "failed",
  "succeeded",
  "cached",
  "purged",
] as const;

export interface NamespaceSummary {
  total: number;
  counts: Record<JobStatus, number>;
  /**
   * The raw fetched job list (purged included) — the drilldown tree branches
   * these under their namespace node. Empty when the fetch failed.
   */
  jobs: Job[];
  /** Non-null when the summary fetch for this namespace failed. */
  error: string | null;
}

export type NamespaceSummaries = Record<string, NamespaceSummary>;

const REFRESH_MS = 30_000;
/** Debounce for refetching the active namespace when the live feed updates. */
const ACTIVITY_DEBOUNCE_MS = 1_000;

function emptyCounts(): Record<JobStatus, number> {
  return { pending: 0, running: 0, succeeded: 0, failed: 0, purged: 0, cached: 0 };
}

export function summarizeJobs(jobs: Job[]): NamespaceSummary {
  const counts = emptyCounts();
  for (const job of jobs) {
    if (job.status in counts) counts[job.status] += 1;
  }
  return { total: jobs.length, counts, jobs, error: null };
}

/** "12 tasks · 2 running · 1 failed" — non-zero statuses only, actionable first. */
export function summaryLine(summary: NamespaceSummary): string {
  const parts: string[] = [`${summary.total} task${summary.total !== 1 ? "s" : ""}`];
  for (const status of JOB_STATUSES) {
    const n = summary.counts[status];
    if (n > 0) parts.push(`${n} ${status}`);
  }
  return parts.join(" · ");
}

/**
 * Fetch job-status summaries for every namespace.
 *
 * @param namespaces    the full namespace list (drives which ids are fetched)
 * @param activeNamespace the live WS feed's namespace — refetched (debounced)
 *                       whenever `activityKey` changes so its node stays fresh
 * @param activityKey   a signature of the live jobs list; any change triggers a
 *                       refetch of the active namespace's summary
 */
export function useNamespaceSummaries(
  namespaces: NamespaceOption[],
  activeNamespace: string,
  activityKey: string,
): NamespaceSummaries {
  const [summaries, setSummaries] = useState<NamespaceSummaries>({});
  const mountedRef = useRef(true);
  const inflightRef = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchOne = useCallback(async (nsId: string) => {
    if (inflightRef.current.has(nsId)) return;
    inflightRef.current.add(nsId);
    try {
      const res = await getPlatform().restFetch(`/api/jobs?namespace=${encodeURIComponent(nsId)}`);
      if (!mountedRef.current) return;
      if (!res.ok) {
        setSummaries((prev) => ({
          ...prev,
          [nsId]: { total: 0, counts: emptyCounts(), jobs: [], error: `HTTP ${res.status}` },
        }));
        return;
      }
      const data = (await res.json()) as { jobs?: unknown[] };
      if (!mountedRef.current) return;
      // The REST endpoint returns raw K8s AgentJobs, not the wire Jobs the WS
      // feed pushes — normalize first (see lib/restJobs.ts) or every job in
      // the tree renders "Issue #? · unknown · Step ?" and clicks subscribe
      // to session `undefined`.
      const jobs = normalizeRestJobs(Array.isArray(data.jobs) ? data.jobs : []);
      const summary = summarizeJobs(jobs);
      setSummaries((prev) => ({ ...prev, [nsId]: summary }));
    } catch {
      if (!mountedRef.current) return;
      setSummaries((prev) => ({
        ...prev,
        [nsId]: { total: 0, counts: emptyCounts(), jobs: [], error: "unreachable" },
      }));
    } finally {
      inflightRef.current.delete(nsId);
    }
  }, []);

  const fetchAll = useCallback(() => {
    for (const ns of namespaces) void fetchOne(ns.id);
  }, [namespaces, fetchOne]);

  // Initial fetch + periodic refresh + refetch when the namespace list changes.
  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // The live feed saw activity in the active namespace — refresh just that
  // node's summary (debounced; WS bursts would otherwise spam the endpoint).
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    const timer = setTimeout(() => void fetchOne(activeNamespace), ACTIVITY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [activityKey, activeNamespace, fetchOne]);

  return summaries;
}
