// The platform adapter — the single seam between the shared ui/ core and the
// targets that host it (knowledge/tech-designs/ui-sharing.md). The core never
// imports a target; every place the web SPA and the desktop plugin diverge
// goes through one of these adapter calls:
//
//   1. applyTheme — where the active theme lands: the web page sets
//      data-theme on <html>; the plugin scopes it to its .odins-throne-root
//      surfaces (rendered from React state, so the adapter is a no-op).
//   2. wsUrl — same-origin /ws vs the monitor's token-gated /bot/ws dial.
//   3. restFetch — same-origin /api/* vs the otFetch mapping onto /bot/api
//      with the pairing session's bearer header.
//   4. avatarUrl — /profiles/*.png URLs vs portraits bundled as data URLs.
//   5. shell — which app shell hosts the core: the plugin's headless
//      StoreBridge (pane + workspace page render from the published
//      snapshot) vs the web target's full-page AppShell.
//
// Targets install their adapter at entry time, before any ui/ code renders.

import type { Theme } from "./hooks/useTheme";
import type { DisplayJob } from "./lib/types";

export interface SessionLogTarget {
  /** Namespace captured at open time — the viewer's WS dials this, not the pane's. */
  namespace: string;
  /** Job snapshot captured at open time — header fallback until jobs land. */
  job: DisplayJob | null;
}

export interface PlatformAdapter {
  /** Declarative marker for which shell hosts the core (seam 5). */
  readonly shell: "plugin" | "web";

  /** Seam 1 — apply the active theme to the platform's theme root. */
  applyTheme(theme: Theme): void;

  /** Seam 2 — WebSocket URL for a namespace's multiplexed job/log stream. */
  wsUrl(namespace: string): string;

  /** Seam 3 — fetch on the SPA's original /api/* paths. */
  restFetch(path: string, init?: RequestInit): Promise<Response>;

  /**
   * Seam 4 — portrait URL for an agent (dark/light variant). Undefined for
   * an unknown agent; callers render their own fallback.
   */
  avatarUrl(agentKey: string, variant: "dark" | "light"): string | undefined;

  /**
   * Best-effort "bring the log view forward" — host.navigate in the desktop
   * shell; a no-op on the web, where the full-page shell shows both surfaces
   * at once. Implementations must not throw.
   */
  focusLogView(): void;

  /**
   * Seam 6 — open (or focus) a dedicated log view for one session (issue:6).
   * The desktop plugin stacks a closeable workspace tab per session; the web
   * shell is a no-op because its single SessionLogViewer already follows the
   * store's activeSessionId. Implementations must not throw.
   */
  openSessionLog(sessionId: string, target: SessionLogTarget): void;

  /**
   * Seam 7 — close the session's log view when its pod is gone (a confirmed
   * Ragnarök cancel tears down the K8s job, so its log tab closes with it).
   * No-op where no per-session view exists. Implementations must not throw.
   */
  closeSessionLog(sessionId: string): void;
}

let adapter: PlatformAdapter | null = null;

/** Called once by each target's entry, before any ui/ code renders. */
export function setPlatform(a: PlatformAdapter): void {
  adapter = a;
}

export function getPlatform(): PlatformAdapter {
  if (!adapter) {
    throw new Error(
      "platform adapter not installed — a target entry must call setPlatform() before the ui/ core renders",
    );
  }
  return adapter;
}
