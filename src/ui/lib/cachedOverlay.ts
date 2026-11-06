// Pinned sessions on the tree — Odin's memory made visible.
//
// The header's session count has always included Odin's memory: pinned
// sessions kept in localStorage after their pod was reaped surface as
// status "cached" jobs (useJobs.buildCachedJobs). But the drilldown tree
// rendered ONLY the per-namespace REST summaries, so a cached session was
// counted in the header yet invisible under every lantern — "5 sessions"
// with only 2 cards on the tree.
//
// This lib overlays the pin cache onto the summaries the tree renders, so a
// pinned session hangs on its realm's vine as a gold memory card (styled via
// the existing "cached" status lane: gold dot/border, moon icon, "pinned"
// label). Everything downstream (vine cards, pip strips, task counts, the
// MID lantern tier, the filter's totals) sees the merged list, so the count
// and the tree agree.
//
// Realm attribution:
//   • CachedSessionMeta.namespace — captured at pin time: the active realm
//     for sidebar pins (the session lives in its job list), the tab's realm
//     for cross-world pins (SessionLogViewer). New pins never move.
//   • Legacy pins (pinned before the field existed) carry no realm and
//     follow the ACTIVE namespace — the same semantics the old flat job
//     list had, where cached sessions appeared in the active world's list
//     whatever their origin.

import type { Job } from "./types";
import {
  getCachedSessionIds,
  getCachedSessionMeta,
  type CachedSessionMeta,
} from "./localStorageLogs";
import type {
  NamespaceSummaries,
} from "../hooks/useNamespaceSummaries";

/** A cached Job built from pin metadata — the same shape the REST
 * normalizer emits, so parseJob/tasksOf consume it exactly like a live
 * job (buildCachedJobs performs the equivalent DisplayJob conversion). */
export function cachedJobFromMeta(meta: CachedSessionMeta): Job {
  return {
    sessionId: meta.sessionId,
    name: meta.name,
    issueNumber: meta.issueNumber,
    agent: meta.agent,
    step: meta.step,
    status: "cached",
    startedAt: meta.startedAt,
    completedAt: meta.completedAt,
    podName: null,
    issueTitle: meta.issueTitle,
    branchName: meta.branchName,
    fixture: false,
  };
}

export interface CachedOverlayEntry {
  /** The realm the pin hangs under. */
  ns: string;
  job: Job;
}

/**
 * Overlay entries for every pinned session NOT already rendered live.
 *
 * @param liveIds    sessionIds currently in the live WS list — a pinned
 *                   session whose pod still lives already hangs on the vine
 *                   with its 📌 clasp; the overlay must not duplicate it.
 * @param fallbackNs the ACTIVE namespace — realm for legacy pins whose
 *                   metadata predates the namespace field.
 */
export function cachedOverlayEntries(
  liveIds: Set<string>,
  fallbackNs: string,
): CachedOverlayEntry[] {
  const out: CachedOverlayEntry[] = [];
  for (const id of getCachedSessionIds()) {
    if (liveIds.has(id)) continue;
    const meta = getCachedSessionMeta(id);
    if (!meta) continue; // cache entry without metadata cannot render
    out.push({ ns: meta.namespace ?? fallbackNs, job: cachedJobFromMeta(meta) });
  }
  return out;
}

/**
 * Merge overlay entries into the per-namespace summaries the tree renders.
 * Pure: returns the input object untouched when there is nothing to add.
 * Realms with a missing or errored summary keep their state untouched (the
 * overlay only lands where a healthy summary exists); a session already in
 * the realm's live list is never duplicated.
 */
export function mergeCachedIntoSummaries(
  summaries: NamespaceSummaries,
  entries: CachedOverlayEntry[],
): NamespaceSummaries {
  if (entries.length === 0) return summaries;
  const next: NamespaceSummaries = { ...summaries };
  for (const { ns, job } of entries) {
    const cur = next[ns];
    if (!cur || cur.error) continue;
    if (cur.jobs.some((j) => j.sessionId === job.sessionId)) continue;
    next[ns] = {
      total: cur.total + 1,
      counts: { ...cur.counts, cached: cur.counts.cached + 1 },
      jobs: [...cur.jobs, job],
      error: null,
    };
  }
  return next;
}
