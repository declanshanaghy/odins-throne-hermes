// The web target's full-page App (seam 5, web flavor). The headless engine
// (ui/App — the same StoreBridge the plugin's pane hosts) owns the WebSocket
// and all SPA state and publishes the snapshot; this shell renders the
// Sidebar and the LogViewer side by side plus the shared overlays — the
// original monitor-page layout.

import { useMemo } from "react";
import { App } from "../../ui/App";
import { useThrone } from "../../ui/store";
import { ErrorBoundary } from "../../ui/components/ErrorBoundary";
import { Sidebar } from "../../ui/components/Sidebar";
import { LogViewer } from "../../ui/components/LogViewer";
import { ThroneOverlays } from "../../ui/components/Overlays";

function SidebarSurface() {
  const snap = useThrone()!;
  return (
    <Sidebar
      jobs={snap.jobs}
      activeSessionId={snap.activeSessionId}
      quote={snap.quote}
      wsState={snap.wsState}
      onSelectSession={snap.onSelectSession}
      onAvatarClick={snap.onAvatarClick}
      onOdinClick={snap.onOdinClick}
      onTogglePinSession={snap.onTogglePinSession}
      pinnedSessionIds={snap.pinnedSessionIds}
      onCancelJob={snap.onCancelJob}
      terminatingSessionIds={snap.terminatingSessionIds}
      namespace={snap.namespace}
      namespaces={snap.namespaces}
      onNamespaceChange={snap.setNamespace}
      namespaceSummaries={snap.namespaceSummaries}
      onSelectTask={snap.onSelectTask}
    />
  );
}

function LogViewerSurface() {
  const snap = useThrone()!;
  return (
    <LogViewer
      entries={snap.entries}
      activeJob={snap.activeJob}
      isFixture={snap.isFixture}
      isTtlExpired={snap.isTtlExpired}
      isNodeUnreachable={snap.isNodeUnreachable}
      streamError={snap.streamError}
      isPinned={snap.isPinned}
      onTogglePin={snap.onTogglePin}
      onAvatarClick={snap.onAvatarClick}
      replayedFromCache={snap.replayedFromCache}
      isConnecting={snap.isConnecting}
      isPodStarting={snap.isPodStarting}
      onCancelJob={snap.onCancelJob}
      onSetSpeed={snap.onSetSpeed}
    />
  );
}

export function AppShell() {
  const snap = useThrone();
  // Stable element reference — same infinite-publish-loop guard as the pane:
  // every store publish re-renders AppShell, and a fresh <App/> element would
  // re-render the bridge, publishing again.
  const bridge = useMemo(() => <App />, []);
  return (
    <div
      className="odins-throne-root"
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* StoreBridge engine: owns the WS, jobs, log stream, pins */}
      {bridge}
      {snap ? (
        <div className="layout">
          <ErrorBoundary>
            <SidebarSurface />
          </ErrorBoundary>
          <ErrorBoundary>
            <LogViewerSurface />
          </ErrorBoundary>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-rune)",
            fontStyle: "italic",
            fontSize: "0.8rem",
            padding: "1rem",
          }}
        >
          Awakening the Allfather…
        </div>
      )}
      <ThroneOverlays />
    </div>
  );
}
