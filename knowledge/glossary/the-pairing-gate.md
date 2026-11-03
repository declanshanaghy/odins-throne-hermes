# The pairing gate

Google OAuth via oauth2-proxy is the only door — no Google login, no data, no standing
credential. The pairing page (handoff.ts) mints a signed, user-scoped pairing key (HMAC over a
shared secret, stateless, multi-replica safe, 7-day TTL) which the plugin redeems for a bot
session. The same shared HMAC secret value on both halls keeps paired sessions alive across a
cutover. Bot surface additionally takes the static ODINS_THRONE_BOT_TOKEN bearer.
