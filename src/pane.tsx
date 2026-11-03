// Right-docked pane: the Hlidskjalf job list (ported Sidebar) plus the hidden
// StoreBridge (ported App) that owns the WebSocket and all SPA state, plus the
// window-level overlays (modals, toasts, banners) and plugin chrome (connect
// card, settings dialog).

import { useMemo } from "react";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { Sidebar } from "./ui/components/Sidebar";
import { AgentProfileModal } from "./ui/components/AgentProfileModal";
import { RagnarokDialog } from "./ui/components/RagnarokDialog";
import { Toast } from "./ui/components/Toast";
import { ErrorBanner } from "./ui/components/ErrorBanner";
import { App } from "./ui/App";
import { useThrone } from "./store";
import { useTheme } from "./ui/hooks/useTheme";
import { isConfigured } from "./upstream";
import { ThroneSettings, settingsUi, useSettingsOpen } from "./settings";

function SidebarConnected() {
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
    />
  );
}

function ThroneOverlays() {
  const snap = useThrone();
  if (!snap) return null;
  return (
    <>
      <ErrorBanner message={snap.wsError} />
      {snap.storageWarning && <ErrorBanner message={snap.storageWarning} />}
      {snap.profileAgent && (
        <AgentProfileModal
          agentKey={snap.profileAgent}
          theme={snap.theme}
          onClose={() => snap.setProfileAgent(null)}
        />
      )}
      {snap.cancelTarget && (
        <RagnarokDialog
          sessionId={snap.cancelTarget.sessionId}
          jobTitle={snap.cancelTarget.jobTitle}
          onConfirm={snap.confirmCancel}
          onCancel={() => snap.setCancelTarget(null)}
        />
      )}
      {snap.toast && (
        <Toast
          key={snap.toast.id}
          message={snap.toast.message}
          onDismiss={snap.dismissToast}
        />
      )}
    </>
  );
}

function ConnectCard() {
  return (
    <div className="throne-connect-card">
      <p>
        The Throne is sealed — Hlidskjalf needs a path to the monitor before the
        ravens can fly.
      </p>
      <button className="throne-settings-btn primary" onClick={() => settingsUi.open()}>
        Configure upstream
      </button>
    </div>
  );
}

export function ThronePane() {
  const snap = useThrone();
  const settingsOpen = useSettingsOpen();
  const { theme } = useTheme();
  // The bridge must NOT re-render when this pane re-renders: every store
  // publish re-renders ThronePane, a fresh <App/> element would re-render the
  // bridge, and its publish-effect would publish again — an infinite loop.
  // A stable element reference lets React bail out on referential equality.
  const bridge = useMemo(() => <App />, []);
  return (
    <div
      className="odins-throne-root"
      data-theme={theme === "light" ? "light" : undefined}
      style={{ width: "100%", height: "100%" }}
    >
      {/* StoreBridge: the ported App — owns the WS, jobs, log stream, pins */}
      {bridge}
      {snap ? (
        <ErrorBoundary>
          <SidebarConnected />
        </ErrorBoundary>
      ) : (
        <div className="throne-boot">Awakening the Allfather…</div>
      )}
      {!isConfigured() && <ConnectCard />}
      <ThroneOverlays />
      {settingsOpen && <ThroneSettings />}
    </div>
  );
}
