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
