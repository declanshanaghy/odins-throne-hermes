// Module-scope store shared by the two plugin surfaces:
//   - the right-docked job list pane (renders the StoreBridge = ported App)
//   - the /odins-throne route page in the workspace (renders LogViewer)
//
// The App bridge publishes a snapshot after every render; both surfaces read
// it reactively through useThrone(). Durable state (pins, theme, namespace)
// stays in localStorage exactly as the browser SPA kept it.

import { useSyncExternalStore } from "react";
import type { DisplayJob } from "./lib/types";
import type { NamespaceOption } from "./hooks/useNamespace";
import type { NamespaceSummaries } from "./hooks/useNamespaceSummaries";
import type { LogEntry } from "./hooks/useLogStream";

export interface CancelTarget {
  sessionId: string;
  jobTitle: string;
}

export interface ThroneSnapshot {
  jobs: DisplayJob[];
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
  // drilldown tree task click — selects a session, switching worlds if the
  // task lives in another namespace (issue:4)
  onSelectTask: (nsId: string, sessionId: string) => void;

  // log stream (useLogStream)
  entries: LogEntry[];
  activeJob: DisplayJob | null;
  isFixture: boolean;
  isTtlExpired: boolean;
  isNodeUnreachable: boolean;
  streamError: string | null;
  isPinned: boolean;
  replayedFromCache: boolean;
  isConnecting: boolean;
  isPodStarting: boolean;

  // actions
  onSelectSession: (sessionId: string) => void;
  onAvatarClick: (agentKey: string) => void;
  onOdinClick: () => void;
  onTogglePin: () => void;
  onTogglePinSession: (sessionId: string) => void;
  onCancelJob: (sessionId: string) => void;
  onSetSpeed: (speed: number) => void;
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
