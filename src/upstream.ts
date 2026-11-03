// Upstream connection to the deployed Odin's Throne monitor
// (https://odins-throne.fenrirledger.com).
//
// ONE auth path: the website's Google OAuth, completed in the user's real
// browser, delivered to the plugin as a short-lived pairing session.
//
// Google's embedded-browser policy blocks credential entry inside webviews
// ("This browser or app may not be secure" fires at the credential step,
// after the email page renders — verified live against the deployed
// monitor), so the Google login can never happen inside Hermes. The flow:
//
//   1. "Sign in with Google" opens the system browser at
//      {base}/api/handoff?client=<id> — a page behind the website's own
//      oauth2-proxy (Google) auth. No Google login ⇒ no pairing code.
//   2. The page shows a one-time 8-char code (5-minute TTL, single use).
//   3. The user types it into the pane; redeem mints a signed, user-scoped
//      session token (7-day TTL) used as Bearer on /bot/api/* and ?token=
//      on /bot/ws. When it expires, the pairing card simply returns.
//
// The URL override exists only for local dev (`pnpm dev` in
// development/odins-throne serves the same routes without oauth2-proxy).

const URL_KEY = "hlidskjalf:upstream-url";
const SESSION_KEY = "hlidskjalf:session";
const CLIENT_KEY = "hlidskjalf:client-id";

export const DEFAULT_UPSTREAM_URL = "https://odins-throne.fenrirledger.com";

function base(): string {
  return getUpstreamUrl().replace(/\/+$/, "");
}

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

// ── device identity ─────────────────────────────────────────────────────────

/** Stable per-install id; pairing codes bind to it server-side. */
export function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_KEY);
    if (existing) return existing;
    const fresh = Array.from({ length: 2 }, () =>
      Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0"),
    ).join("");
    localStorage.setItem(CLIENT_KEY, fresh);
    return fresh;
  } catch {
    return "ephemeral";
  }
}

// ── session state (reactive for the pane) ────────────────────────────────────

let sessionVersion = 0;
const sessionListeners = new Set<() => void>();

export function subscribeSession(cb: () => void): () => void {
  sessionListeners.add(cb);
  return () => {
    sessionListeners.delete(cb);
  };
}

export function sessionSnapshot(): number {
  return sessionVersion;
}

function emitSession(): void {
  sessionVersion += 1;
  for (const l of sessionListeners) l();
}

export function getSession(): string {
  try {
    return localStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  emitSession();
}

/**
 * True when the plugin can reach an upstream: a paired session, or a URL
 * override (local dev servers have no auth to satisfy).
 */
export function isConfigured(): boolean {
  if (getUpstreamUrl() !== DEFAULT_UPSTREAM_URL) return true;
  return getSession() !== "";
}

// ── pairing ─────────────────────────────────────────────────────────────────

/** The system-browser page that mints the pairing code (Google-gated). */
export function pairingUrl(): string {
  return `${base()}/api/handoff?client=${encodeURIComponent(getClientId())}`;
}

export interface RedeemResult {
  ok: boolean;
  user?: string;
  error?: string;
}

/** Trade the browser-minted pairing code for a session token. */
export async function redeemPairing(rawCode: string): Promise<RedeemResult> {
  const code = rawCode.trim().toLowerCase();
  if (!code) return { ok: false, error: "Enter the code from the pairing page" };
  try {
    const res = await fetch(`${base()}/bot/handoff/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client: getClientId(), code }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      token?: string;
      user?: string;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.token) {
      return { ok: false, error: data.error ?? `Redeem failed (HTTP ${res.status})` };
    }
    try {
      localStorage.setItem(SESSION_KEY, data.token);
    } catch {
      // ignore
    }
    emitSession();
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── authenticated transport to the bot surface ──────────────────────────────

/** Maps a SPA path onto the token-gated bot surface. */
export function restUrl(path: string): string {
  if (path.startsWith("/api/")) return `${base()}/bot${path}`;
  return `${base()}${path}`;
}

/** Fetch init with the session bearer header merged in. */
export function authInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  const token = getSession();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** WebSocket URL for the multiplexed job/log stream of a namespace. */
export function wsUrl(namespace: string): string {
  const b = base();
  const proto = b.startsWith("https") ? "wss" : "ws";
  const host = b.replace(/^https?:\/\//, "");
  const params = new URLSearchParams({ namespace });
  const token = getSession();
  if (token) params.set("token", token);
  return `${proto}://${host}/bot/ws?${params.toString()}`;
}

/**
 * The fetch every vendored REST call site uses, on the SPA's original
 * paths — mapped onto the bot surface with the pairing session attached.
 */
export async function otFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(restUrl(path), authInit(init));
}
