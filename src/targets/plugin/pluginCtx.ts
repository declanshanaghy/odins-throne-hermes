// Holds the desktop plugin ctx so non-component modules (settings) can reach it.

let ctx: any = null;

export function setCtx(c: any): void {
  ctx = c;
}

export function getCtx(): any {
  return ctx;
}

/** Best-effort plugin reload after a config change; false if unavailable. */
export async function requestReload(): Promise<boolean> {
  try {
    const res = await ctx?.runAction?.("plugins.reload");
    if (res?.ok) return true;
  } catch {
    // fall through
  }
  return false;
}

/** Open a URL in the user's real browser; resolves false when unavailable. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    const ok = await ctx?.os?.openExternal?.(url);
    return ok !== false && ok !== undefined;
  } catch {
    return false;
  }
}

// ── Throne workspace tab ─────────────────────────────────────────────────────
// The tab opener is wired by entry.tsx (which has access to React + ThronePage)
// and called from the pane's job-card click handler. Using a callback avoids
// importing JSX into this plain-TS module.

let throneTabOpener: ((sessionId: string) => void) | null = null;

/** Called once from entry.tsx to wire up the workspace-tab opener. */
export function setThroneTabOpener(fn: (sessionId: string) => void): void {
  throneTabOpener = fn;
}

/**
 * Open (or focus) the Odin's Throne log terminal tab in the main workspace
 * zone, pre-selecting the given session. Falls back to host.navigate when
 * host.openWorkspace is unavailable (older desktop builds).
 *
 * This is the single call-site for job-card clicks in the pane.
 */
export function openThroneTab(sessionId: string): void {
  if (throneTabOpener) {
    throneTabOpener(sessionId);
  }
}
