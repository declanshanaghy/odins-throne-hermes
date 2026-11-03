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
