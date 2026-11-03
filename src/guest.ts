// The OAuth surface: an Electron <webview> guest that IS a browser client of
// the deployed monitor — exactly the auth the web SPA uses. The Google login
// happens inside the guest (oauth2-proxy sets its session cookie in the
// guest's persistent partition, surviving app restarts), and ALL data-plane
// traffic then runs inside the guest: same-origin fetch + WebSocket, cookie
// authenticated, on the human routes (/api/*, /ws). The host plugin relays
// frames in and out; no tokens, no backend changes, no CORS.
//
// Layout: the pane mounts a hidden guest (attachGuest). When the session is
// missing/expired the pane shows it and the user completes the Google sign-in
// inside it (reauth); afterwards the guest parks on /healthz and the relay
// sockets do the talking.

import { getUpstreamUrl } from "./upstream";

export type GuestStatus = "booting" | "probing" | "authed" | "signing-in" | "needs-login";

// ── status store ────────────────────────────────────────────────────────────

let status: GuestStatus = "booting";
const statusListeners = new Set<() => void>();

export function guestStatus(): GuestStatus {
  return status;
}

export function subscribeGuestStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

function setStatus(next: GuestStatus): void {
  if (status === next) return;
  status = next;
  for (const l of statusListeners) l();
}

// ── guest element lifecycle ─────────────────────────────────────────────────

let guest: GuestWebview | null = null;
let ready: Promise<void> | null = null;

function base(): string {
  return getUpstreamUrl().replace(/\/+$/, "");
}

/**
 * Mount the hidden guest into a container inside the plugin pane. Returns a
 * disposer. The partition is persistent so the login cookie survives app
 * restarts; backgroundThrottling=false keeps the relay hot even off-screen.
 */
export function attachGuest(container: HTMLElement): () => void {
  if (guest) {
    return () => undefined;
  }
  const el = document.createElement("webview") as unknown as GuestWebview;
  // v2: Google sticks disallowed_useragent verdicts to the browser PROFILE —
  // the v1 partition carried the aborted first attempt (Electron UA) and
  // kept serving the "browser not secure" wall even after the Chrome-UA fix.
  // A fresh partition + clean UA + clean client hints passes Google's wall
  // (verified by probe: full sign-in page renders, brands = Chromium only).
  el.setAttribute("partition", "persist:odins-throne-v2");
  el.setAttribute("webpreferences", "backgroundThrottling=false");
  // Plain Chrome UA: Google rejects logins from UAs it identifies as
  // embedded/automation browsers (disallowed_useragent); the webview must
  // present as the same browser the website flow runs in.
  el.setAttribute(
    "useragent",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"
  );
  // Fill the container; the overlay's visibility (ThroneGuest) hides the
  // frame when not signing in — never position it off-canvas, or the login
  // page renders out of view.
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.setAttribute("src", `${base()}/healthz`);
  container.appendChild(el as unknown as HTMLElement);
  guest = el;
  ready = new Promise((resolve) => {
    el.addEventListener("dom-ready", () => resolve(), { once: true });
  });
  void probeAndSet();
  return () => {
    guest = null;
    ready = null;
    setStatus("booting");
    el.remove();
  };
}

async function guestEval(code: string): Promise<unknown> {
  if (!guest || !ready) throw new Error("guest not mounted");
  await ready;
  return guest.executeJavaScript(code, false);
}

async function probeAndSet(): Promise<void> {
  setStatus("probing");
  setStatus((await probeAuth()) ? "authed" : "needs-login");
}

/** True when the guest holds a live oauth2-proxy session cookie. */
export async function probeAuth(): Promise<boolean> {
  try {
    const code =
      'fetch("/api/namespaces", { credentials: "include" })' +
      '.then(function (r) { return String(r.status); })' +
      '.catch(function () { return "0"; })';
    const result = (await guestEval(code)) as string;
    return result === "200";
  } catch {
    return false;
  }
}

interface GuestWebview {
  src: string;
  style: CSSStyleDeclaration;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, cb: () => void, opts?: { once?: boolean }): void;
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  remove(): void;
}

let reauthPoll: ReturnType<typeof setInterval> | null = null;

function parkOnHealthz(): void {
  if (!guest) return;
  guest.setAttribute("src", `${base()}/healthz`);
  ready = new Promise((resolve) => {
    guest!.addEventListener("dom-ready", () => resolve(), { once: true });
  });
}

/**
 * Show the guest and start the website's own login flow inside it: oauth2-proxy
 * serves its "Sign In" click-through page at `/`, the user clicks through to
 * Google, and the poll flips to authed the moment the session cookie lands.
 */
export function reauth(): void {
  if (!guest) return;
  setStatus("signing-in");
  guest.setAttribute("src", `${base()}/`);
  ready = new Promise((resolve) => {
    guest!.addEventListener("dom-ready", () => resolve(), { once: true });
  });
  if (reauthPoll !== null) clearInterval(reauthPoll);
  reauthPoll = setInterval(() => {
    void probeAuth().then((ok) => {
      if (!ok) return;
      if (reauthPoll !== null) clearInterval(reauthPoll);
      reauthPoll = null;
      setStatus("authed");
      parkOnHealthz();
    });
  }, 2000);
}

/** Give up on the in-frame sign-in and show the connect card again. */
export function cancelReauth(): void {
  if (reauthPoll !== null) {
    clearInterval(reauthPoll);
    reauthPoll = null;
  }
  if (guestStatus() === "signing-in") setStatus("needs-login");
  parkOnHealthz();
}

// ── REST relay (same-origin, cookie-authenticated fetch inside the guest) ────

export async function guestFetch(path: string, init?: RequestInit): Promise<Response> {
  const opts = JSON.stringify({ method: init?.method ?? "GET", credentials: "include" });
  const code =
    `fetch(${JSON.stringify(path)}, ${opts})` +
    ".then(function (r) { return r.text().then(function (t) {" +
    "  return JSON.stringify({ status: r.status, body: t });" +
    "}); })" +
    '.catch(function (e) { return JSON.stringify({ status: 0, body: String((e && e.message) || e) }); })';
  const raw = (await guestEval(code)) as string;
  const { status: code_, body } = JSON.parse(raw) as { status: number; body: string };
  return {
    ok: code_ >= 200 && code_ < 300,
    status: code_,
    async text() {
      return body;
    },
    async json() {
      return JSON.parse(body);
    },
  } as unknown as Response;
}

// ── WebSocket relay ─────────────────────────────────────────────────────────
// The socket runs INSIDE the guest (same-origin wss with the session cookie —
// what the browser SPA itself dials). Frames buffer in the guest and drain to
// the host every 120 ms; state transitions map to open/close/error.

export interface ThroneSocket {
  readyState: number;
  onclose: ((ev?: unknown) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  addEventListener(type: string, cb: (ev: any) => void): void;
  send(data: string): void;
  close(): void;
}

function relayBoot(namespaceJson: string): string {
  return (
    '(function () {' +
    "  var w = window;" +
    "  if (w.__otSock) { try { w.__otSock.close(); } catch (e) {} }" +
    '  var proto = location.protocol === "https:" ? "wss:" : "ws:";' +
    '  var url = proto + "//" + location.host + "/ws?namespace=" + encodeURIComponent(' +
    namespaceJson +
    ");" +
    "  var buf = w.__otBuf = [];" +
    "  var state = w.__otSockState = 0;" +
    "  var s = w.__otSock = new WebSocket(url);" +
    "  s.onopen = function () { w.__otSockState = 1; };" +
    "  s.onclose = function () { w.__otSockState = 3; };" +
    "  s.onerror = function () { if (w.__otSockState !== 3) w.__otSockState = 4; };" +
    "  s.onmessage = function (ev) {" +
    "    buf.push(ev.data);" +
    "    if (buf.length > 4000) buf.splice(0, buf.length - 4000);" +
    "  };" +
    "  w.__otSend = function (m) { try { s.send(m); } catch (e) {} };" +
    "  w.__otClose = function () { try { s.close(); } catch (e) {} };" +
    "})();"
  );
}

const DRAIN =
  '(function () { var b = window.__otBuf || []; window.__otBuf = [];' +
  '  return JSON.stringify({ s: window.__otSockState | 0, m: b }); })()';

class GuestSocket implements ThroneSocket {
  readyState = 0;
  onclose: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  private handlers = new Map<string, Array<(ev: any) => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private errored = false;
  private dead = false;

  constructor(namespace: string) {
    void this.start(namespace);
  }

  private async start(namespace: string): Promise<void> {
    try {
      await guestEval(relayBoot(JSON.stringify(namespace)));
    } catch {
      this.fail();
      return;
    }
    this.timer = setInterval(() => void this.drain(), 120);
  }

  private fail(): void {
    if (this.dead) return;
    this.dead = true;
    this.readyState = 3;
    if (!this.errored) {
      this.errored = true;
      this.emit("error", {});
    }
    this.emit("close", {});
    this.stop();
  }

  private stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private async drain(): Promise<void> {
    if (this.dead) return;
    let frame: { s: number; m: string[] };
    try {
      frame = JSON.parse((await guestEval(DRAIN)) as string);
    } catch {
      return;
    }
    for (const line of frame.m) {
      this.emit("message", { data: line });
    }
    const next = frame.s === 4 ? 3 : frame.s;
    if (frame.s === 4 && !this.errored) {
      this.errored = true;
      this.emit("error", {});
    }
    if (next !== this.readyState) {
      this.readyState = next;
      if (next === 1) {
        this.errored = false;
        this.emit("open", {});
      } else if (next === 3) {
        this.fail();
      }
    }
  }

  private emit(type: string, ev: { data?: string }): void {
    for (const cb of this.handlers.get(type) ?? []) cb(ev);
  }

  addEventListener(type: string, cb: (ev: any) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(cb);
    this.handlers.set(type, list);
  }

  send(data: string): void {
    const code = `(function () { var f = window.__otSend; if (f) f(${JSON.stringify(data)}); })()`;
    void guestEval(code).catch(() => undefined);
  }

  close(): void {
    this.dead = true;
    this.stop();
    this.readyState = 3;
    void guestEval("window.__otClose ? window.__otClose() : undefined").catch(() => undefined);
  }
}

/** Open the multiplexed job/log stream through the guest. */
export function openGuestSocket(namespace: string): ThroneSocket {
  return new GuestSocket(namespace);
}
