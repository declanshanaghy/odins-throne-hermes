// Normalize the upstream monitor's REST job payload into the wire `Job` shape
// the WebSocket feed pushes.
//
// WHY THIS EXISTS: `GET /api/jobs?namespace=<id>` returns the monitor's raw
// K8s `AgentJob`s — { name, status, startTime, completionTime, labels,
// annotations } — NOT the wire `Job`s (`sessionId`, `issueNumber`, `agent`,
// `step`, `issueTitle`, ...) that the WS `jobs-snapshot` pushes. The server
// maps one to the other in its `mapAgentJobToJob` (k8s.ts); the REST endpoint
// ("kept for curl debugging") never got that mapping. Feeding raw AgentJobs
// straight into the UI made every tree job render "Issue #? · unknown ·
// Step ?" and clicked cards subscribe to session `undefined` (broken stream
// pane). This module mirrors the server's mapping client-side so the tree
// works against the deployed endpoint as-is.
//
// Mirror of fenrir-ledger/development/odins-throne/src/k8s.ts
// (parseJobMeta + mapAgentJobToJob). Keep the field names in sync.
//
// Note: the REST path can't see pod phases — an executing job reports as
// "active" until the WS watch upgrades it to "running" — so non-active
// namespaces show in-flight work as "pending", exactly like the server's
// own listAgentJobs output.

import type { Job } from "./types";

/** Raw K8s AgentJob as returned by the monitor's REST endpoints. */
export interface RestAgentJob {
  name: string;
  namespace?: string;
  status: string;
  startTime?: string | null;
  completionTime?: string | null;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/** Loose check: a payload that already carries the wire shape passes through. */
function isWireJob(raw: unknown): raw is Job {
  return (
    typeof raw === "object" &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).sessionId === "string"
  );
}

/** Map a raw AgentJob onto the wire Job shape (mirrors mapAgentJobToJob). */
export function normalizeRestJob(raw: RestAgentJob): Job {
  const labels = raw.labels ?? {};
  const annotations = raw.annotations ?? {};
  const sessionId = labels["fenrir.dev/session-id"] || raw.name.replace(/^agent-/, "");
  const m = /issue-(\d+)-step(\d+)-([a-z]+)/i.exec(sessionId);
  // Prefer fenrir/pr-title over fenrir/issue-title (PR title is more specific)
  const prTitle = annotations["fenrir/pr-title"] || null;
  const issueAnnotation =
    annotations["fenrir/issue-title"] || annotations["pack/issue-title"] || null;
  return {
    sessionId,
    name: raw.name,
    issueNumber: m ? parseInt(m[1] ?? "0", 10) : 0,
    agent: m ? (m[3] ?? "unknown").toLowerCase() : "unknown",
    step: m ? parseInt(m[2] ?? "0", 10) : 0,
    // REST can't see pod phases: the K8s job controller's "active" means the
    // pod exists but may still be pulling/scheduling — that's "pending" on
    // the wire (the WS watch upgrades it to "running" later).
    status: raw.status === "active" ? "pending" : (raw.status as Job["status"]),
    startedAt: raw.startTime ?? null,
    completedAt: raw.completionTime ?? null,
    podName: null,
    issueTitle: prTitle ?? issueAnnotation,
    branchName: annotations["fenrir/branch"] || null,
  };
}

/**
 * Normalize a REST jobs payload: wire-shaped entries pass through untouched
 * (forward-compatible if the endpoint ever adopts the mapping), raw AgentJobs
 * are mapped like the server maps them for the WS feed.
 */
export function normalizeRestJobs(raw: unknown[]): Job[] {
  return raw.map((j) => (isWireJob(j) ? j : normalizeRestJob(j as RestAgentJob)));
}
