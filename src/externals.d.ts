// Runtime-resolved externals (the desktop app provides react and
// @hermes/plugin-sdk when it loads the bundled plugin.js).

declare module "@hermes/plugin-sdk" {
  export const PANES_AREA: "panes";
  export const PALETTE_AREA: "palette";
  export const ROUTES_AREA: "routes";
  export const SIDEBAR_NAV_AREA: "sidebarNav";
  export const STATUSBAR_AREAS: { readonly left: "statusBar.left"; readonly right: "statusBar.right" };
  export const host: {
    navigate(path: string): void;
    notify(n: { kind: string; message: string }): void;
    request(method: string, params?: unknown): Promise<unknown>;
    /** Open a plugin-rendered tab in the main workspace zone and reveal it.
     *  Re-calling with the same id re-fronts the existing tab instead of
     *  opening a duplicate. Returns a disposer that closes the tab.
     *  Feature-detect before calling (typeof host.openWorkspace === 'function').
     */
    openWorkspace?: (id: string, opts: { render: () => unknown; title?: string; minWidth?: number; onClose?: () => void }) => () => void;
  };
}

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.jpg" {
  const url: string;
  export default url;
}

declare module "*.css" {
  const text: string;
  export default text;
}
