// Right-docked pane: the Hlidskjalf job list (ported Sidebar) plus the hidden
// StoreBridge (ported App) that owns the WebSocket and all SPA state, plus the
// window-level overlays (modals, toasts, banners) and plugin chrome (connect
// card, settings dialog).

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  attachGuest,
  cancelReauth,
  guestStatus,
  reauth,
  subscribeGuestStatus,
} from "./guest";
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

function useGuestStatus() {
  return useSyncExternalStore(subscribeGuestStatus, guestStatus, guestStatus);
}

function ConnectCard() {
  // Overlay (not in-flow): the Sidebar fills the pane, so anything after it
  // is invisible. This centers the sign-in affordance over the whole pane.
  return (
    <div className="throne-connect-card">
      <p>
        The Throne is sealed — sign in with Google to open the Bifröst (the
        same login the web version uses).
      </p>
      <button className="throne-settings-btn primary" onClick={() => reauth()}>
        Sign in with Google
      </button>
      <button className="throne-settings-btn" onClick={() => settingsUi.open()}>
        Advanced: bot token / URL
      </button>
    </div>
  );
}

/**
 * The hidden OAuth guest — a real Chromium webview that holds the
 * Google/oauth2-proxy session. Visible only while the user signs in.
 */
function ThroneGuest() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const status = useGuestStatus();
  useEffect(() => {
    if (!containerRef.current) return;
    return attachGuest(containerRef.current);
  }, []);
  const visible = status === "signing-in";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        pointerEvents: visible ? "auto" : "none",
        visibility: visible ? "visible" : "hidden",
        background: "var(--void)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {visible && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid var(--rune-border)",
            background: "var(--forge)",
            color: "var(--text-rune)",
            fontFamily: '"Cinzel", serif',
            fontSize: "0.72rem",
          }}
        >
          <span>
            Complete the sign-in for odins-throne.fenrirledger.com in the frame
            below — exactly the website's login.
          </span>
          <button className="throne-settings-btn" onClick={() => cancelReauth()}>
            Cancel
          </button>
        </div>
      )}
      <div ref={containerRef} style={{ position: "relative", flex: 1 }} />
    </div>
  );
}

export function ThronePane() {
  const snap = useThrone();
  const settingsOpen = useSettingsOpen();
  const status = useGuestStatus();
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
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}
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
      {/* Sign-in overlay: shown whenever there is no session; hidden while the
          guest itself is showing the Google login (it sits at z-40, the
          settings dialog at z-60). */}
      {!isConfigured() && status !== "signing-in" && <ConnectCard />}
      <ThroneGuest />
      <ThroneOverlays />
      {settingsOpen && <ThroneSettings />}
    </div>
  );
}
