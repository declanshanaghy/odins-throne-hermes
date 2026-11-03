// Upstream connection to the deployed Odin's Throne monitor
// (https://odins-throne.fenrirledger.com).
//
// ONE auth path: Google OAuth — exactly the web version's. A webview (the
// "guest" is Electron's name for an embedded browser frame, not anonymous
// access) completes the real oauth2-proxy login and holds the session cookie;
// every REST + WS call then runs inside it, same-origin on the human routes
// (/api/*, /ws). No session → the monitor 403s everything: if you don't
// OAuth, you don't get in. There is no token and no alternate mode.
//
// The URL override exists only for local dev (`pnpm dev` in
// development/odins-throne serves the same routes without oauth2-proxy).

import { guestFetch, guestStatus } from "./guest";

const URL_KEY = "hlidskjalf:upstream-url";

export const DEFAULT_UPSTREAM_URL = "https://odins-throne.fenrirledger.com";

export function getUpstreamUrl(): string {
  try {
    return localStorage.getItem(URL_KEY) || DEFAULT_UPSTREAM_URL;
  } catch {
    return DEFAULT_UPSTREAM_URL;
  }
}

export function setUpstreamConfig(url: string): void {
  try {
    localStorage.setItem(URL_KEY, url.trim() || DEFAULT_UPSTREAM_URL);
  } catch {
    // private browsing — ignore
  }
}

/**
 * True when the plugin can reach an upstream: a live OAuth session, or a
 * URL override (local dev servers have no oauth2-proxy to satisfy).
 */
export function isConfigured(): boolean {
  if (getUpstreamUrl() !== DEFAULT_UPSTREAM_URL) return true;
  return guestStatus() === "authed";
}

/**
 * The fetch every vendored REST call site uses, on the SPA's original
 * paths — always relayed through the signed-in webview (same-origin,
 * cookie-authenticated).
 */
export async function otFetch(path: string, init?: RequestInit): Promise<Response> {
  return guestFetch(path, init);
}
