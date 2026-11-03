// Right-docked pane: the Hlidskjalf job list (ported Sidebar) plus the hidden
// StoreBridge (ported App) that owns the WebSocket and all SPA state, plus the
// window-level overlays (modals, toasts, banners) and plugin chrome (pairing
// card, settings dialog).

import { useMemo, useState, useSyncExternalStore } from "react";
import { ErrorBoundary } from "./ui/components/ErrorBoundary";
import { Sidebar } from "./ui/components/Sidebar";
import { AgentProfileModal } from "./ui/components/AgentProfileModal";
import { RagnarokDialog } from "./ui/components/RagnarokDialog";
import { Toast } from "./ui/components/Toast";
import { ErrorBanner } from "./ui/components/ErrorBanner";
import { App } from "./ui/App";
import { useThrone } from "./store";
import { useTheme } from "./ui/hooks/useTheme";
import {
  acceptPairingKey,
  clearSession,
  isConfigured,
  pairingUrl,
  sessionSnapshot,
  subscribeSession,
} from "./upstream";
import { openExternal } from "./pluginCtx";
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

/**
 * Pairing card — Google's embedded-browser policy blocks credential entry
 * inside any webview, so the Google login happens in the user's real
 * browser (the website's own flow) and the plugin receives a one-time code.
 * No Google login in the browser ⇒ no code ⇒ no data.
 */
function PairingCard() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  async function openBrowser(): Promise<void> {
    setError(null);
    const ok = await openExternal(pairingUrl());
    if (!ok) setError("Could not open the browser — open this URL manually: " + pairingUrl());
    else setOpened(true);
  }

  async function pair(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await acceptPairingKey(code);
    if (!result.ok) setError(result.error ?? "Pairing failed");
    setBusy(false);
  }

  return (
    <div className="throne-connect-card">
      <p>
        The Throne is sealed — sign in with Google to open the Bifröst (the
        same login the web version uses).
      </p>
      <button className="throne-settings-btn primary" onClick={() => void openBrowser()}>
        Sign in with Google
      </button>
      {opened && (
        <>
          <p>The pairing page is open in your browser — click the key to copy it, then paste it here:</p>
          <input
            className="throne-code-input"
            value={code}
            placeholder="paste the pairing key"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void pair();
            }}
            style={{
              width: "min(90%, 34ch)",
              padding: "0.5rem 0.65rem",
              borderRadius: 6,
              border: "1px solid var(--gold-dim-border)",
              background: "var(--void)",
              color: "var(--gold-bright)",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.72rem",
            }}
          />
          <button className="throne-settings-btn" disabled={busy} onClick={() => void pair()}>
            {busy ? "Binding…" : "Pair"}
          </button>
        </>
      )}
      {error && <p style={{ color: "var(--error-text)" }}>{error}</p>}
      <button
        className="throne-settings-btn"
        style={{ opacity: 0.6 }}
        onClick={() => {
          clearSession();
          settingsUi.open();
        }}
      >
        Advanced: upstream URL
      </button>
    </div>
  );
}

export function ThronePane() {
  const snap = useThrone();
  const settingsOpen = useSettingsOpen();
  // Re-render when the session changes (pair/unpair) so the card toggles.
  useSyncExternalStore(subscribeSession, sessionSnapshot, sessionSnapshot);
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
      {!isConfigured() && <PairingCard />}
      <ThroneOverlays />
      {settingsOpen && <ThroneSettings />}
    </div>
  );
}
