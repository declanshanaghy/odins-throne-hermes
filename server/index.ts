import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context, Next } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { listAgentJobs, deleteAgentJob, findPodForSession, streamPodLogs } from "./k8s.js";
import { attachWebSocketServer } from "./ws.js";
import { BOT_TOKEN, botCredentialOk } from "./botToken.js";
import { mintSession } from "./handoff.js";

const app = new Hono();

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const DEFAULT_NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-agents";
const JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app.kubernetes.io/component=agent-sandbox";
// Static web bundle directory (Vite output from issue #18, or the interim
// esbuild bundle). Overridable so local dev / deployments can point elsewhere.
const WEB_DIST = process.env.WEB_DIST ?? "dist-ui";

// ── Namespace configuration ──────────────────────────────────────────────────

export interface NamespaceConfig {
  id: string;
  label: string;
}

const DEFAULT_NAMESPACES: NamespaceConfig[] = [
  { id: "fenrir-agents", label: "Fenrir Ledger Agents" },
  { id: "say-so-agents", label: "SaySo Agents" },
  { id: "mytruthfinder-agents", label: "MyTruthFinder Agents" },
  { id: "shanaghy-com-agents", label: "Shanaghy.com Agents" },
  { id: "re-goatmower-agents", label: "Re-Goatmower Agents" },
];

function loadNamespaces(): NamespaceConfig[] {
  // Prefer NAMESPACES_JSON env var (injected from ConfigMap)
  const raw = process.env.NAMESPACES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as NamespaceConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (raw_error) {
      console.warn("[config] Failed to parse NAMESPACES_JSON, using defaults");
    }
  }
  return DEFAULT_NAMESPACES;
}

const NAMESPACES = loadNamespaces();

/** Validate that a namespace param is in the allowed list. */
function resolveNamespace(param: string | undefined): string {
  if (!param) return DEFAULT_NAMESPACE;
  const allowed = NAMESPACES.map((n) => n.id);
  return allowed.includes(param) ? param : DEFAULT_NAMESPACE;
}

// ── Health check (public) ────────────────────────────────────────────────────
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});

// ── Route handlers (shared by human /api/* and bot /bot/api/* surfaces) ──────

const listNamespaces = (_c: Context) => {
  return _c.json({ namespaces: NAMESPACES });
};

// List agent jobs — kept for curl debugging; UI uses WebSocket push
const listJobs = async (c: Context) => {
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    const jobs = await listAgentJobs(namespace, JOB_LABEL);
    return c.json({ jobs, count: jobs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[k8s] Could not list jobs:", message);
    return c.json({ jobs: [], count: 0, error: message });
  }
};

// Download full agent session log from K8s pod
const downloadLogs = async (c: Context) => {
  const sessionId = c.req.param("sessionId") ?? "";
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    const podName = await findPodForSession(sessionId, namespace);
    if (!podName) {
      return c.json({ error: "Pod not found for session" }, 404);
    }
    const lines: string[] = [];
    await new Promise<void>((resolve, reject) => {
      streamPodLogs(
        podName,
        namespace,
        (line) => lines.push(line),
        () => resolve(),
        (err) => reject(err),
        { follow: false }
      );
    });
    const content = lines.join("\n");
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sessionId}.log"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[k8s] Could not fetch logs for session ${sessionId}:`, message);
    return c.json({ error: message }, 500);
  }
};

// Cancel / delete a running agent job — invoked by Ragnarök dialog confirm
const deleteJob = async (c: Context) => {
  const sessionId = c.req.param("sessionId") ?? "";
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    await deleteAgentJob(sessionId, namespace);
    console.log(`[k8s] Job deleted for session ${sessionId}`);
    return c.json({ ok: true, sessionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[k8s] Could not delete job for session ${sessionId}:`, message);
    return c.json({ ok: false, error: message }, 500);
  }
};

// ── Human routes (auth enforced by oauth2-proxy sidecar) ──────────────────────

app.get("/api/namespaces", listNamespaces);
app.get("/api/jobs", listJobs);
app.get("/api/logs/:sessionId", downloadLogs);
app.delete("/api/jobs/:sessionId", deleteJob);

// Hermes pairing page — behind the proxy's Google auth (the website's own
// login). Mints the signed, user-scoped session token DIRECTLY and shows it
// for copy-paste into the plugin pane. Stateless by design: the monitor runs
// multiple replicas behind the ingress, so anything stored in memory (like a
// pending-code map) would live on one pod while the redeem lands on another.
// The token is HMAC-signed with the shared secret — every replica can verify
// it, nothing is stored, and reaching this page at all proves a completed
// human Google OAuth session.
app.get("/api/handoff", (c: Context) => {
  const client = c.req.query("client") || "unknown";
  const user = c.req.header("x-forwarded-user") ?? "local-dev";
  const token = mintSession(client, user);
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pair Hermes — Odin's Throne</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#07070d; color:#f5f5f5; font-family:Georgia,'Source Serif 4',serif; }
  .card { text-align:center; padding:2.6rem 3rem; border:1px solid #2a2a3e; border-radius:14px;
          background:#12121f; max-width:34rem; }
  h1 { font-size:1.1rem; letter-spacing:.08em; color:#c9920a; margin:0 0 .5rem; }
  p { color:#a0a0b0; font-size:.85rem; line-height:1.6; margin:.4rem 0; }
  .key { font-family:ui-monospace,Menlo,monospace; font-size:.78rem; color:#f0b429;
         margin:1.2rem 0; word-break:break-all; user-select:all; cursor:pointer;
         border:1px dashed rgba(201,146,10,.4); border-radius:8px; padding:1rem; }
  .key:hover { background:rgba(201,146,10,.06); }
  .copied { color:#22c55e !important; }
  .user { color:#606070; font-size:.72rem; margin-top:1.4rem; }
</style></head>
<body><div class="card">
  <h1>PAIR HERMES</h1>
  <p>Copy this key and paste it into the Odin's Throne pane in the Hermes desktop app.</p>
  <p>Click to copy. It expires in seven days; pair again any time.</p>
  <div class="key" id="k" title="Click to copy">${token}</div>
  <p id="hint">signed for ${user}</p>
  <p class="user">${user}</p>
</div>
<script>
  document.getElementById("k").addEventListener("click", function () {
    var t = this.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
      .then(function () { document.getElementById("hint").textContent = "copied ✓"; document.getElementById("hint").classList.add("copied"); })
      .catch(function () { var r = document.createRange(); r.selectNodeContents(document.getElementById("k"));
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy");
        document.getElementById("hint").textContent = "copied ✓"; document.getElementById("hint").classList.add("copied"); });
  });
</script>
</body></html>`;
  // no-store: a heuristically-cached old page (e.g. a pre-deploy code
  // format) must never be shown again after the flow changes.
  return c.body(html, 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
});

// ── Bot surface — token-gated mirror for the Hermes desktop plugin ───────────
// The plugin (odins-throne-hermes) cannot hold a Google OAuth session, so it
// authenticates with a shared bearer token instead. Handlers are identical to
// the human routes; only the gate differs. oauth2-proxy passes the /bot
// paths through (skip-auth-route), so this in-app check is the only gate —
// bearer-secret vs Google-email allowlist, same protection class.
//
// ODINS_THRONE_BOT_TOKEN unset ⇒ surface open (local dev: `pnpm dev` runs
// without oauth2-proxy). Production always sets it.

if (BOT_TOKEN) {
  console.log("[odin-throne] bot surface enabled (token-gated)");
} else {
  console.log("[odin-throne] bot surface OPEN — no ODINS_THRONE_BOT_TOKEN set (local dev)");
}

// CORS: the desktop renderer is cross-origin (Electron app origin) and sends
// an Authorization header, so it needs preflight + allow-origin on bot paths.
app.use(
  "/bot/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86_400,
  })
);

app.use("/bot/api/*", async (c: Context, next: Next): Promise<Response | void> => {
  if (BOT_TOKEN) {
    const header = c.req.header("Authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!botCredentialOk(presented)) {
      return c.json({ error: "Unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
    }
  }
  await next();
});

app.get("/bot/api/namespaces", listNamespaces);
app.get("/bot/api/jobs", listJobs);
app.get("/bot/api/logs/:sessionId", downloadLogs);
app.delete("/bot/api/jobs/:sessionId", deleteJob);

// ── Static file serving — web bundle output (WEB_DIST, default dist-ui) ──────
// Serves the web bundle as static assets (production build of the React UI).
// This runs AFTER API routes so API requests are never intercepted.
app.use("/*", serveStatic({ root: WEB_DIST }));

// SPA fallback — serve index.html for any unmatched routes
app.get("/*", serveStatic({ path: `${WEB_DIST}/index.html` }));

// ── Start server with WebSocket support ──────────────────────────────────────
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[odin-throne] Listening on http://localhost:${info.port}`);
});

attachWebSocketServer(server, JOB_LABEL, NAMESPACES.map((n) => n.id), DEFAULT_NAMESPACE);

export { app };
