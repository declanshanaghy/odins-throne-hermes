// Per-session workspace tab manager.
// Each session click registers a dedicated route and calls host.navigate so
// Hermes opens (or focuses) a tab for that session. Tracks open sessions so a
// second click on the same session focuses the existing tab instead of
// registering a duplicate route.

import { host, ROUTES_AREA } from "@hermes/plugin-sdk";
import { ThronePage } from "./page";

let pluginCtx: any = null;

// sessionId → registered path; keyed to detect already-open tabs
const openTabs = new Map<string, string>();

export function initSessionTabs(ctx: any): void {
  pluginCtx = ctx;
}

export function openSessionTab(sessionId: string): void {
  if (!pluginCtx) return;

  const path = `/odins-throne/${sessionId}`;

  if (!openTabs.has(sessionId)) {
    pluginCtx.register({
      id: `session-${sessionId}`,
      area: ROUTES_AREA,
      data: { path },
      render: () => <ThronePage sessionId={sessionId} />,
    });
    openTabs.set(sessionId, path);
  }

  try {
    host.navigate(path);
  } catch {
    // navigation unavailable in test environments — tab still registered
  }
}

export function getOpenSessionIds(): ReadonlySet<string> {
  return new Set(openTabs.keys());
}
