import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Hermes handoff — OAuth-derived pairing sessions for the desktop plugin.
 *
 * Google's embedded-browser policy blocks credential entry inside any
 * webview, so the plugin can never complete the Google login in-app. The
 * flow instead runs the website's own OAuth in the user's real browser:
 *
 *   1. The plugin opens `${base}/api/handoff?client=<id>` in the system
 *      browser. That page sits behind oauth2-proxy — the website's Google
 *      auth — so reaching it at all proves a completed human login.
 *   2. The page shows a one-time 8-char pairing code (5-minute TTL, single
 *      use, bound to the requesting user and the plugin's client id).
 *   3. The user types the code into the plugin pane; the plugin redeems it
 *      for a signed session token (7-day TTL, user-scoped).
 *
 * Nothing here replaces OAuth: without a Google-authenticated browser there
 * is no code, and therefore no session. There is no standing credential —
 * sessions expire and the flow simply repeats.
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

const HANDOFF_SECRET = process.env.ODINS_THRONE_HANDOFF_SECRET ?? "";

// Local dev (pnpm dev, no oauth2-proxy, no secrets): an ephemeral in-process
// secret keeps the flow testable. Production always sets the env.
let ephemeralSecret: string | null = null;

function secret(): string {
  if (HANDOFF_SECRET) return HANDOFF_SECRET;
  if (ephemeralSecret === null) ephemeralSecret = randomBytes(32).toString("hex");
  return ephemeralSecret;
}

export interface HandoffSession {
  user: string;
  client: string;
  exp: number;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function mintSession(client: string, user: string): string {
  const body = Buffer.from(
    JSON.stringify({ u: user, c: client, exp: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string): HandoffSession | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const raw = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      u?: unknown;
      c?: unknown;
      exp?: unknown;
    };
    if (typeof raw.u !== "string" || typeof raw.c !== "string" || typeof raw.exp !== "number") {
      return null;
    }
    if (raw.exp < Date.now()) return null;
    return { user: raw.u, client: raw.c, exp: raw.exp };
  } catch {
    return null;
  }
}

// Pairing codes were replaced by direct token minting: the monitor runs
// multiple replicas, and an in-memory code map lives on one pod while the
// redeem request lands on another. mintSession/verifySession are stateless —
// every replica can verify what any replica signed.
