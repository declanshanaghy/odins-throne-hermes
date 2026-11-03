// Web-flavor session tab panel (seam 6, web target).
//
// Provides an in-page tab strip so the web hall mirrors the desktop plugin's
// workspace-tab UX: tree sidebar LEFT, session log tabs RIGHT. The plugin's
// tab contract lives in host.openWorkspace; this module provides the same
// contract for the web shell without forking any shared ui/ core.
//
// Module-level tab state (same pattern as throneStore) lets the web platform
// adapter (src/targets/web/platform.ts) call openWebSessionLog /
// closeWebSessionLog without touching React, while the React component
// subscribes via useSyncExternalStore.

import { useSyncExternalStore } from "react";
import type { DisplayJob } from "../lib/types";
import { SessionLogViewer, SessionLogViewerEmpty } from "./SessionLogViewer";

export type WebTab = {
  sessionId: string;
  namespace: string;
  title: string;
  job: DisplayJob | null;
};

// ── Module-level tab registry ───────────────────────────────────────────────

const webTabMap = new Map<string, WebTab>();
let activeTabId: string | null = null;
let tabVersion = 0;
const tabListeners = new Set<() => void>();

function emitTabChange(): void {
  tabVersion += 1;
  for (const l of tabListeners) l();
}

function tabTitleFor(job: DisplayJob | null): string {
  if (!job) return "Session";
  if (job.issueTitle) return `#${job.issue} – ${job.issueTitle}`;
  if (job.issue && job.issue !== "?") {
    return `#${job.issue} – ${job.agentName} Step ${job.step}`;
  }
  return job.name;
}

/**
 * Open (or focus) an in-page session tab. Called by the web platform adapter
 * via platform.openSessionLog.
 * - New session → adds a tab and makes it active.
 * - Already-open session → focuses the existing tab (never duplicates).
 */
export function openWebSessionLog(
  sessionId: string,
  namespace: string,
  job: DisplayJob | null,
): void {
  if (!webTabMap.has(sessionId)) {
    webTabMap.set(sessionId, {
      sessionId,
      namespace,
      title: tabTitleFor(job),
      job,
    });
  }
  activeTabId = sessionId;
  emitTabChange();
}

/**
 * Close the in-page tab for a session. Called by the web platform adapter via
 * platform.closeSessionLog (triggered on confirmed Ragnarök cancel). Idempotent.
 */
export function closeWebSessionLog(sessionId: string): void {
  if (!webTabMap.has(sessionId)) return;
  webTabMap.delete(sessionId);
  if (activeTabId === sessionId) {
    const remaining = [...webTabMap.keys()];
    activeTabId = remaining.length > 0 ? remaining[remaining.length - 1]! : null;
  }
  emitTabChange();
}

/** Read the current open tabs (for tests). */
export function getWebTabs(): readonly WebTab[] {
  return [...webTabMap.values()];
}

/** Read the current active tab id (for tests). */
export function getActiveWebTabId(): string | null {
  return activeTabId;
}

// ── React component ─────────────────────────────────────────────────────────

function subscribe(cb: () => void): () => void {
  tabListeners.add(cb);
  return () => {
    tabListeners.delete(cb);
  };
}

function getTabVersion(): number {
  return tabVersion;
}

/**
 * SessionTabPanel — the right panel of the web AppShell.
 *
 * Renders a horizontal tab bar + the active tab's SessionLogViewer. Each tab
 * has its own WebSocket connection (one per SessionLogViewer instance), so
 * multiple sessions stream independently — same contract as the plugin's
 * workspace tabs.
 */
export function SessionTabPanel() {
  useSyncExternalStore(subscribe, getTabVersion, getTabVersion);

  const tabs = [...webTabMap.values()];
  const activeId = activeTabId;

  if (tabs.length === 0) {
    return (
      <div className="content">
        <SessionLogViewerEmpty />
      </div>
    );
  }

  const activeTab = (activeId ? webTabMap.get(activeId) : null) ?? tabs[0]!;

  return (
    <div className="content session-tab-panel">
      <div className="session-tab-bar" role="tablist" aria-label="Session logs">
        {tabs.map((tab) => (
          <div
            key={tab.sessionId}
            className={`session-tab${tab.sessionId === activeTab.sessionId ? " session-tab--active" : ""}`}
          >
            <button
              role="tab"
              className="session-tab-label"
              aria-selected={tab.sessionId === activeTab.sessionId}
              onClick={() => {
                activeTabId = tab.sessionId;
                emitTabChange();
              }}
              title={tab.title}
            >
              <span className="session-tab-title">{tab.title}</span>
            </button>
            <button
              className="session-tab-close"
              aria-label={`Close ${tab.title}`}
              title={`Close ${tab.title}`}
              onClick={() => closeWebSessionLog(tab.sessionId)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="session-tab-content" role="tabpanel">
        <SessionLogViewer
          key={activeTab.sessionId}
          sessionId={activeTab.sessionId}
          namespace={activeTab.namespace}
          jobSnapshot={activeTab.job}
        />
      </div>
    </div>
  );
}
