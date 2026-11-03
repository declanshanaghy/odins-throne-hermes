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
  };
}

declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.css" {
  const text: string;
  export default text;
}
