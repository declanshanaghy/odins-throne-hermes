// Per-session workspace tabs (issue:6).
//
// host.openWorkspace(id, { render, title, onClose }) is the desktop's own
// session-tile door: it opens a CLOSEABLE workspace tab docked beside the
// main conversation, and re-opening the same id FRONTS and refreshes the
// existing tab instead of stacking a duplicate — exactly the
// one-log-terminal-tab-per-session contract. Each tab renders ThronePage with
// its sessionId baked in, so every tab owns its own WS subscription and log
// stream (src/page.tsx) and several sessions can stream side by side.
//
// Older hosts without openWorkspace (feature-detected) fall back to a
// per-session route page: a dedicated /odins-throne/:sessionId contribution
// plus host.navigate — still one page per session, but the host only shows
// one workspace page at a time (limitation documented on issue:6).

import { host, ROUTES_AREA } from "@hermes/plugin-sdk";
import { ThronePage } from "./page";
import type { DisplayJob } from "../../ui/lib/types";

export interface SessionTab {
  sessionId: string;
  /** Namespace captured at open time — the tab's WS dials this, not the pane's. */
  namespace: string;
  /** Tab strip title. */
  title: string;
  /** Job snapshot captured at open time — header fallback until jobs land. */
  job: DisplayJob | null;
  /** Disposer from host.openWorkspace; closes the tab (absent in fallback mode). */
  close?: () => void;
}

let pluginCtx: any = null;

// sessionId → open tab. Keyed by sessionId: a second click on the same
// session must focus the existing tab, never stack a duplicate.
const openTabs = new Map<string, SessionTab>();
// Fallback-mode registered routes (host without openWorkspace).
const fallbackRoutes = new Set<string>();

export function initSessionTabs(ctx: any): void {
  pluginCtx = ctx;
}

/** Tab strip title: "#<issue> – <pr title>", falling back to name/agent/step. */
function tabTitleFor(job: DisplayJob | null): string {
  if (!job) return "Session";
  if (job.issueTitle) return `#${job.issue} – ${job.issueTitle}`;
  if (job.issue && job.issue !== "?") {
    return `#${job.issue} – ${job.agentName} Step ${job.step}`;
  }
  return job.name;
}

/** The host's openWorkspace, when present (feature-detected per the SDK docs). */
function openWorkspaceFn(): ((id: string, options: Record<string, unknown>) => unknown) | null {
  const fn = (host as unknown as Record<string, unknown>).openWorkspace;
  return typeof fn === "function" ? (fn as (id: string, options: Record<string, unknown>) => unknown) : null;
}

/**
 * Open (or focus) a dedicated workspace tab for this session.
 *
 * - New session → host.openWorkspace stacks a fresh closeable tab; the
 *   current tab (e.g. the Hermes conversation) is never navigated away.
 * - Already-open session → re-opens the same id, which the SDK contract turns
 *   into front + refresh of the existing tab (no duplicate).
 * - Host without openWorkspace → registers a per-session route page and
 *   navigates to it (single-page fallback, documented limitation).
 */
export function openSessionTab(
  sessionId: string,
  opts: { namespace: string; job?: DisplayJob | null },
): void {
  const { namespace, job = null } = opts;
  const title = tabTitleFor(job);
  const openWorkspace = openWorkspaceFn();

  if (openWorkspace) {
    const id = `odins-throne-session-${sessionId}`;
    try {
      const disposer = openWorkspace(id, {
        title,
        dock: { pane: "workspace", pos: "center" },
        onClose: () => {
          openTabs.delete(sessionId);
        },
        render: () => <ThronePage sessionId={sessionId} tabNamespace={namespace} jobSnapshot={job} />,
      });
      const existing = openTabs.get(sessionId);
      const close = typeof disposer === "function" ? (disposer as () => void) : undefined;
      openTabs.set(sessionId, {
        sessionId,
        namespace,
        title,
        job,
        close: close ?? existing?.close,
      });
      return;
    } catch {
      // openWorkspace present but failed (e.g. no workspace surface) —
      // fall through to the route-page fallback below.
    }
  }

  // Fallback: per-session route contribution + navigate. Still one page per
  // session; the host just can only display one at a time.
  if (pluginCtx && !fallbackRoutes.has(sessionId)) {
    try {
      pluginCtx.register({
        id: `odins-throne-session-${sessionId}`,
        area: ROUTES_AREA,
        title,
        data: { path: `/odins-throne/${sessionId}` },
        render: () => (
          <ThronePage sessionId={sessionId} tabNamespace={namespace} jobSnapshot={job} />
        ),
      });
      fallbackRoutes.add(sessionId);
    } catch {
      // registration unavailable in test environments — navigation below
      // still lands on the static page
    }
  }
  openTabs.set(sessionId, { sessionId, namespace, title, job });

  try {
    host.navigate(`/odins-throne/${sessionId}`);
  } catch {
    // navigation unavailable — selection still works via the store
  }
}

/**
 * Close the session's tab programmatically (if open). Used when the pod is
 * gone — a confirmed Ragnarök cancel tears down the K8s job, so its log tab
 * closes with it (reference design: "cancel closes its tab"). Idempotent.
 */
export function closeSessionTab(sessionId: string): void {
  const tab = openTabs.get(sessionId);
  if (!tab) return;
  openTabs.delete(sessionId);
  try {
    tab.close?.();
  } catch {
    // already closed on the host side — nothing to do
  }
}

export function getOpenSessionTabs(): ReadonlyMap<string, SessionTab> {
  return openTabs;
}

export function isSessionTabOpen(sessionId: string): boolean {
  return openTabs.has(sessionId);
}
