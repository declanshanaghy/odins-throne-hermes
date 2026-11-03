// Minimal stand-in for @hermes/plugin-sdk — only what the plugin imports.
export const PANES_AREA = "panes";
export const PALETTE_AREA = "palette";
export const ROUTES_AREA = "routes";
export const SIDEBAR_NAV_AREA = "sidebarNav";
export const STATUSBAR_AREAS = { left: "statusBar.left", right: "statusBar.right" };
export const host = {
  navigate(path) {
    globalThis.__stubNavigations.push(path);
  },
  notify(n) {
    globalThis.__stubNotifications.push(n);
  },
  request() {
    return Promise.resolve({});
  },
  // host.openWorkspace: docks a plugin-rendered tab; re-calling the same id
  // re-fronts the existing tab. The stub records calls so the smoke test can
  // assert that a job-card click triggers the correct workspace open.
  openWorkspace(id, opts) {
    globalThis.__stubWorkspaceTabs.push({ id, title: opts?.title });
    // Return a no-op disposer (matches the real API contract).
    return () => {};
  },
};
