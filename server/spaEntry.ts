// SPA entry serving — the web hall's index.html.
//
// Issue #55: the entry is served with `Cache-Control: no-store`. A
// heuristically-cached pre-deploy entry kept serving a stale bundle in a
// webview/browser after a deploy — the exact failure class Odin reported (a
// pre-#45 bundle still showing the removed "focus" button on popup job
// cards; the old hall hit the same stale-page class, fenrir-ledger #2380).
// The entry references content-hashed asset URLs, so a fresh entry always
// pulls a fresh bundle; hashed /assets/* stay long-cached (see index.ts).
//
// A dedicated module (not an inline handler) so the route is unit-testable
// straight from source without booting the listener.

import type { Context } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Cache policy for the SPA entry — never persist, always revalidate. */
export const SPA_ENTRY_CACHE_CONTROL = "no-store";

/**
 * Build a route handler serving `<distDir>/index.html` with
 * `Cache-Control: no-store`. Mounted for the hall root, explicit
 * /index.html requests, and the SPA fallback for unmatched routes — every
 * path that can hand a browser the entry document.
 */
export function spaEntryHandler(distDir: string): (c: Context) => Promise<Response> {
  return async (c: Context): Promise<Response> => {
    try {
      const html = await readFile(join(distDir, "index.html"), "utf8");
      return c.body(html, 200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": SPA_ENTRY_CACHE_CONTROL,
      });
    } catch {
      // No built entry (web bundle not built / not mounted). A plain 404
      // beats a crash: the API + WS surfaces keep serving.
      return c.text("Not found", 404);
    }
  };
}