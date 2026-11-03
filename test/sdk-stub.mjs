// Minimal stand-in for @hermes/plugin-sdk — only what the plugin imports.
//
// host.openWorkspace mirrors the desktop contract (see the SDK's
// session-tile door): the FIRST open with an id stacks a new closeable tab;
// re-opening the same id FRONTS the existing tab (recorded as a focus, no new
// tab); the returned disposer closes the tab and fires onClose. The smoke
// test asserts the one-tab-per-session contract through these records.
export const PANES_AREA = "panes";
export const PALETTE_AREA = "palette";
export const ROUTES_AREA = "routes";
export const SIDEBAR_NAV_AREA = "sidebarNav";
export const STATUSBAR_AREAS = { left: "statusBar.left", right: "statusBar.right" };

globalThis.__stubNavigations = [];
globalThis.__stubNotifications = [];
globalThis.__stubWorkspaceTabs = new Map(); // id → { title, onClose }
globalThis.__stubWorkspaceOpens = []; // ids of newly stacked tabs, in order
globalThis.__stubWorkspaceFocuses = []; // ids of fronted (already-open) tabs

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
  openWorkspace(id, options) {
    const existing = globalThis.__stubWorkspaceTabs.get(id);
    if (existing) {
      // Re-open fronts + refreshes the existing tab — never a duplicate.
      globalThis.__stubWorkspaceFocuses.push(id);
      return () => {
        globalThis.__stubWorkspaceTabs.delete(id);
        existing.onClose?.();
      };
    }
    globalThis.__stubWorkspaceTabs.set(id, {
      title: options?.title,
      onClose: options?.onClose,
    });
    globalThis.__stubWorkspaceOpens.push(id);
    return () => {
      const tab = globalThis.__stubWorkspaceTabs.get(id);
      if (tab) {
        globalThis.__stubWorkspaceTabs.delete(id);
        tab.onClose?.();
      }
    };
  },
};
