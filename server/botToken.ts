import { timingSafeEqual } from "node:crypto";
import { verifySession } from "./handoff.js";

/**
 * Auth for the bot surface (/bot/api/* REST + /bot/ws stream) — the path used
 * by the Hermes desktop plugin (odins-throne-hermes).
 *
 * Two credentials are accepted when the surface is token-gated:
 *   1. the static bot token (ODINS_THRONE_BOT_TOKEN) — curl/CI
 *   2. a handoff session token — minted only after the user completed the
 *      website's Google OAuth in their real browser and paired the plugin
 *      (see handoff.ts). Short-lived, user-scoped, nothing standing.
 *
 * Unset (empty) ⇒ the bot surface is OPEN. That is the local-dev posture:
 * `pnpm dev` runs without oauth2-proxy, so no token is configured or
 * required. Production always sets it (deploy.yml fails closed if the
 * secret is missing).
 */
export const BOT_TOKEN: string = process.env.ODINS_THRONE_BOT_TOKEN ?? "";

/** Timing-safe static bearer-token comparison. */
export function botTokenMatches(presented: string): boolean {
  if (!BOT_TOKEN) return true;
  const a = Buffer.from(presented);
  const b = Buffer.from(BOT_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Does this bearer credential open the bot surface? Static token or a live
 * handoff session. An open surface (local dev) accepts anything, as before.
 */
export function botCredentialOk(presented: string): boolean {
  if (!BOT_TOKEN) return true;
  if (!presented) return false;
  return botTokenMatches(presented) || verifySession(presented) !== null;
}
