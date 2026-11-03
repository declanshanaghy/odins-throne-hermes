// Window-level overlays driven by the shared ThroneSnapshot — modals, toasts
// and banners. Both shells render these: the plugin's pane and the web
// target's full-page AppShell.

import { useThrone } from "../store";
import { AgentProfileModal } from "./AgentProfileModal";
import { RagnarokDialog } from "./RagnarokDialog";
import { Toast } from "./Toast";
import { ErrorBanner } from "./ErrorBanner";

export function ThroneOverlays() {
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
