// Module-scope store shared by the plugin surfaces:
//   - the right-docked job list pane (renders the StoreBridge = ported App)
//   - the per-session workspace tabs and the /odins-throne route page
//     (render LogViewer for a single session — issue:6)
//
// The App bridge publishes a snapshot after every render; every surface reads
// it reactively through useThrone(). Durable state (pins, theme, namespace)
// stays in localStorage exactly as the browser SPA kept it.
//
// Per-session log-stream state (entries, subscribe bookkeeping, pod-start
// retry) deliberately does NOT live here: each session tab owns its own
// stream (see src/page.tsx), so several sessions can stream at once.

import { useSyncExternalStore } from "react";
import type { DisplayJob } from "./ui/lib/types";
import type { NamespaceOption } from "./ui/hooks/useNamespace";
import type { NamespaceSummaries } from "./ui/hooks/useNamespaceSummaries";

export interface CancelTarget {
  sessionId: string;
  jobTitle: string;
}

export interface ThroneSnapshot {
  jobs: DisplayJob[];
  // Most recently opened session — used to highlight the card in the sidebar.
  // Log streaming lives in each session tab, not here.
  activeSessionId: string | null;
  quote: string;
  theme: "light" | "dark";
  wsState: "connecting" | "open" | "closed" | "error";
  wsError: string | null;
  namespace: string;
  namespaces: NamespaceOption[];
  setNamespace: (ns: string) => void;
  // per-namespace task summaries + status stats for the namespace tree (issue:2)
  namespaceSummaries: NamespaceSummaries;
  // drilldown tree task click — opens a dedicated tab for the session,
  // switching namespace first if the task lives in another world (issue:4)
  onSelectTask: (nsId: string, sessionId: string) => void;

  // actions
  onSelectSession: (sessionId: string) => void;
  onAvatarClick: (agentKey: string) => void;
  onOdinClick: () => void;
  // Per-session pin toggle — used by both the sidebar and the session tabs
  onTogglePinSession: (sessionId: string) => void;
  onCancelJob: (sessionId: string) => void;
  pinnedSessionIds: Set<string>;
  terminatingSessionIds: Set<string>;

  // overlays (rendered window-level by the pane)
  profileAgent: string | null;
  setProfileAgent: (a: string | null) => void;
  cancelTarget: CancelTarget | null;
  setCancelTarget: (t: CancelTarget | null) => void;
  confirmCancel: () => Promise<void>;
  toast: { message: string; id: number } | null;
  dismissToast: () => void;
  storageWarning: string | null;
}

let snapshot: ThroneSnapshot | null = null;
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

export const throneStore = {
  publish(next: ThroneSnapshot): void {
    snapshot = next;
    emit();
  },
  get(): ThroneSnapshot | null {
    return snapshot;
  },
};

export function useThrone(): ThroneSnapshot | null {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => version,
    () => version,
  );
  return snapshot;
}
