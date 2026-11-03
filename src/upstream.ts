// Upstream connection to the deployed Odin's Throne monitor
// (https://odins-throne.fenrirledger.com).
//
// TWO auth modes, chosen automatically:
//
//   guest-oauth (default) — exactly the web version's auth: a webview guest
//     holds a real Google/oauth2-proxy session, and every REST + WS call runs
//     inside it, same-origin on the human routes (/api/*, /ws). See guest.ts.
//
//   token — the bot surface the monitor also exposes: /bot/api/* with
//     `Authorization: Bearer <token>` and /bot/ws with `?token=`. Used when a
//     bot token is configured (curl/CI friendly, headless fallback).

import { guestFetch, guestStatus } from "./guest";

const URL_KEY = "hlidskjalf:upstream-url";
const TOKEN_KEY = "hlidskjalf:bot-token";

export type AuthMode = "guest-oauth" | "token";

/** guest-oauth unless a bot token is configured. */
export function authMode(): AuthMode {
  return getBotToken() === "" ? "guest-oauth" : "token";
}

export const DEFAULT_UPSTREAM_URL = "https://odins-throne.fenrirledger.com";

export function getUpstreamUrl(): string {
  try {
    return localStorage.getItem(URL_KEY) || DEFAULT_UPSTREAM_URL;
  } catch {
    return DEFAULT_UPSTREAM_URL;
  }
}

export function getBotToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setUpstreamConfig(url: string, token: string): void {
  try {
    localStorage.setItem(URL_KEY, url.trim() || DEFAULT_UPSTREAM_URL);
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private browsing — ignore
  }
}

/**
 * True when the plugin can plausibly reach an upstream: a guest session is
 * live, a bot token is set, or the URL was overridden (e.g. local dev).
 */
export function isConfigured(): boolean {
  if (getUpstreamUrl() !== DEFAULT_UPSTREAM_URL) return true;
  if (authMode() === "token") return true;
  return guestStatus() === "authed";
}

/**
 * Mode-aware fetch used by every vendored REST call site, on the SPA's
 * original paths. Token mode maps /api/* onto the /bot mirror; guest mode
 * runs the fetch inside the webview (same-origin, cookie-authenticated).
 */
export async function otFetch(path: string, init?: RequestInit): Promise<Response> {
  if (authMode() === "token") return fetch(restUrl(path), authInit(init));
  return guestFetch(path, init);
}

/** Maps a SPA path onto the token-gated bot surface. */
export function restUrl(path: string): string {
  const base = getUpstreamUrl().replace(/\/+$/, "");
  if (path.startsWith("/api/")) return `${base}/bot${path}`;
  return `${base}${path}`;
}

/** Fetch init with the bearer header merged in. */
export function authInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  const token = getBotToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** WebSocket URL for the multiplexed job/log stream of a namespace. */
export function wsUrl(namespace: string): string {
  const base = getUpstreamUrl().replace(/\/+$/, "");
  const proto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  const params = new URLSearchParams({ namespace });
  const token = getBotToken();
  if (token) params.set("token", token);
  return `${proto}://${host}/bot/ws?${params.toString()}`;
}
