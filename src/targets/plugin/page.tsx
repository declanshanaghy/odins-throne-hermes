// Workspace route page (/odins-throne): the ported LogViewer terminal for the
// session selected in the right-pane job list. State arrives via the module
// store published by the pane's StoreBridge; if the pane is closed the page
// shows a hint instead.

import { ErrorBoundary } from "../../ui/components/ErrorBoundary";
import { LogViewer } from "../../ui/components/LogViewer";
import { useThrone } from "../../ui/store";
import { useTheme } from "../../ui/hooks/useTheme";

function LogViewerConnected() {
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

export function ThronePage() {
  const snap = useThrone();
  const { theme } = useTheme();
  return (
    <div
      className="odins-throne-root"
      data-theme={theme === "light" ? "light" : undefined}
      style={{ width: "100%", height: "100%" }}
    >
      {snap ? (
        <ErrorBoundary>
          <LogViewerConnected />
        </ErrorBoundary>
      ) : (
        <div className="throne-boot">
          The Allfather is not seated — open the Odin's Throne pane (right edge)
          to wake him. ⌘K → “Odin's Throne: Open Hlidskjalf” also works.
        </div>
      )}
    </div>
  );
}
