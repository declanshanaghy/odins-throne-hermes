// Upstream connection to the deployed Odin's Throne monitor
// (https://odins-throne.fenrirledger.com).
//
// The deployed instance sits behind an oauth2-proxy sidecar; a plugin cannot
// hold a Google session, so the monitor exposes a token-gated mirror surface:
//
//   REST:  /bot/api/*   — same routes as /api/*, `Authorization: Bearer <token>`
//   WS:    /bot/ws      — same protocol as /ws, `?namespace=<ns>&token=<token>`
//
// restUrl() transparently maps the SPA's original paths onto that surface, so
// every vendored call site keeps its original path string. A local dev server
// (`pnpm dev` in development/odins-throne) serves the same /bot paths without
// oauth2-proxy, so the same code works locally.

const URL_KEY = "hlidskjalf:upstream-url";
const TOKEN_KEY = "hlidskjalf:bot-token";

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
 * True when the plugin can plausibly reach an upstream: either a bot token is
 * set (deployed instance) or the URL was overridden (e.g. local dev server,
 * which needs no token).
 */
export function isConfigured(): boolean {
  return getBotToken() !== "" || getUpstreamUrl() !== DEFAULT_UPSTREAM_URL;
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
