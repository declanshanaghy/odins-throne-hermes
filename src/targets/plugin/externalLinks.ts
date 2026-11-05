// External anchor router (title-pane links fix).
//
// The desktop app DENIES window.open: its window-level setWindowOpenHandler
// blocks every popup ("Opening link blocked as opener could not be cleared"),
// so a raw `<a target="_blank">` in a plugin surface renders fine but a plain
// click does nothing — the browser never opens. The web target never sees
// this because a real browser handles target="_blank" natively.
//
// The app's own links avoid the dead end by calling openLink() in an onClick;
// plugin content can't import that helper, but it has the same power via
// ctx.os.openExternal (the pairing button's path — opens the user's real
// browser). This module installs a delegated listener on a plugin surface's
// root: any click (or middle-click) on an `a[href]` with an absolute http(s)
// URL is cancelled and routed through openExternal instead of window.open.
//
// Scope: ONE listener per plugin root (.odins-throne-root) — the pane
// (ThronePane, which contains the title box, lore links, kin pills, decree
// PR links) and the per-session pages/tabs (ThronePage, whose LogViewer
// carries wiki + session links). Body-portal popups (StatusBadge's WSS
// tooltip, issue #101) carry no anchors and are out of scope.
//
// `event.defaultPrevented` is honored first: any component that handles its
// own anchor clicks (React synthetic listeners run before this native
// listener on the way out) keeps control. Non-http hrefs (hash links, SVG
// `<use href="#...">` — not anchors anyway) are left to the default.

import { useEffect, type RefObject } from "react";
import { openExternal } from "./pluginCtx";

const EXTERNAL_HREF = /^https?:/i;

/** Route one href: external browser via ctx.os.openExternal, window.open as a
 *  last resort (older hosts without ctx.os — still denied in-app, but no
 *  worse than the raw anchor we just cancelled). */
function route(href: string): void {
  void openExternal(href).then((ok) => {
    if (ok) return;
    try {
      window.open(href, "_blank", "noopener");
    } catch {
      // last resort exhausted — the link is still right-clickable through
      // the app's anchor context menu ("open external")
    }
  });
}

/**
 * Route external anchor clicks under `rootRef`'s element through the real
 * browser. Mount once per plugin root; the listener follows the element.
 */
export function useExternalLinkRouter(rootRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handler = (event: Event): void => {
      if (event.defaultPrevented) return;
      // auxclick is the middle-click half of the open-elsewhere convention;
      // only its button (1) means "open in a new tab".
      if (event.type === "auxclick" && (event as MouseEvent).button !== 1) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!EXTERNAL_HREF.test(href)) return;
      event.preventDefault();
      route(href);
    };

    root.addEventListener("click", handler);
    root.addEventListener("auxclick", handler);
    return () => {
      root.removeEventListener("click", handler);
      root.removeEventListener("auxclick", handler);
    };
  }, [rootRef]);
}
