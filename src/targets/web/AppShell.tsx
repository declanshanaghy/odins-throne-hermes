// The web target's full-page App (seam 5, web flavor). The headless engine
// (ui/App — the same StoreBridge the plugin's pane hosts) owns the pane-level
// state (jobs WebSocket, pins, Ragnarök, namespace tree) and publishes the
// snapshot; this shell renders the Sidebar and the per-session log terminal
// side by side plus the shared overlays — the original monitor-page layout.
// The log panel is the shared SessionTabPanel (seam 6, web flavor): it manages
// multiple switchable, closeable session tabs, each owning its own WebSocket
// and log stream, mirroring the desktop plugin's workspace-tab UX.

import { useMemo, useState, useCallback } from "react";
import { App } from "../../ui/App";
import { useThrone } from "../../ui/store";
import { ErrorBoundary } from "../../ui/components/ErrorBoundary";
import { Sidebar } from "../../ui/components/Sidebar";
import { SessionTabPanel } from "../../ui/components/SessionTabPanel";
import { ThroneOverlays } from "../../ui/components/Overlays";

const DEFAULT_SIDEBAR_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 200;
const LS_KEY = "sidebar-width";

function clampWidth(w: number): number {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(w, Math.round(window.innerWidth * 0.5)));
}

function loadStoredWidth(): number {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!isNaN(n)) return clampWidth(n);
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

interface SidebarSurfaceProps {
  sidebarWidth: number;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onResizeDoubleClick: () => void;
}

function SidebarSurface({ sidebarWidth, onResizeMouseDown, onResizeDoubleClick }: SidebarSurfaceProps) {
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
      sizingMode="fixed"
      externalWidth={sidebarWidth}
      onResizeMouseDown={onResizeMouseDown}
      onResizeDoubleClick={onResizeDoubleClick}
    />
  );
}

export function AppShell() {
  const snap = useThrone();
  const [sidebarWidth, setSidebarWidth] = useState<number>(loadStoredWidth);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (ev: MouseEvent) => {
        setSidebarWidth(clampWidth(startWidth + ev.clientX - startX));
      };

      const onMouseUp = (ev: MouseEvent) => {
        const finalWidth = clampWidth(startWidth + ev.clientX - startX);
        setSidebarWidth(finalWidth);
        try {
          localStorage.setItem(LS_KEY, String(finalWidth));
        } catch {
          // ignore storage errors
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth],
  );

  const handleResizeDoubleClick = useCallback(() => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    try {
      localStorage.setItem(LS_KEY, String(DEFAULT_SIDEBAR_WIDTH));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Stable element reference — same infinite-publish-loop guard as the pane:
  // every store publish re-renders AppShell, and a fresh <App/> element would
  // re-render the bridge, publishing again.
  const bridge = useMemo(() => <App />, []);
  return (
    <div
      className="odins-throne-root"
      style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* StoreBridge engine: owns the WS, jobs, pins */}
      {bridge}
      {snap ? (
        <div className="layout">
          <ErrorBoundary>
            <SidebarSurface
              sidebarWidth={sidebarWidth}
              onResizeMouseDown={handleResizeMouseDown}
              onResizeDoubleClick={handleResizeDoubleClick}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <SessionTabPanel />
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
