// server/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";

// server/k8s.ts
import * as k8s from "@kubernetes/client-node";
import { Writable } from "node:stream";
var _kc = null;
var _batchApi = null;
var _coreApi = null;
function getKubeConfig() {
  if (_kc) return _kc;
  _kc = new k8s.KubeConfig();
  if (process.env.KUBERNETES_SERVICE_HOST) {
    _kc.loadFromCluster();
  } else {
    _kc.loadFromDefault();
  }
  return _kc;
}
function getBatchApi() {
  if (_batchApi) return _batchApi;
  _batchApi = getKubeConfig().makeApiClient(k8s.BatchV1Api);
  return _batchApi;
}
function getCoreApi() {
  if (_coreApi) return _coreApi;
  _coreApi = getKubeConfig().makeApiClient(k8s.CoreV1Api);
  return _coreApi;
}
function jobStatus(job) {
  const s = job.status;
  if (!s) return "pending";
  if (s.active && s.active > 0) return "active";
  if (s.succeeded && s.succeeded > 0) return "succeeded";
  if (s.failed && s.failed > 0) return "failed";
  return "pending";
}
function podPhaseToStatus(phase) {
  switch (phase) {
    case "Pending":
      return "pending";
    case "Running":
      return "running";
    case "Succeeded":
      return "succeeded";
    case "Failed":
      return "failed";
    default:
      return null;
  }
}
function parseJobMeta(name, labels) {
  const sessionId = labels["fenrir.dev/session-id"] || name.replace(/^agent-/, "");
  const m = sessionId.match(/issue-(\d+)-step(\d+)-([a-z]+)/i);
  return {
    sessionId,
    issueNumber: m ? parseInt(m[1] ?? "0", 10) : 0,
    agent: m ? (m[3] ?? "unknown").toLowerCase() : "unknown",
    step: m ? parseInt(m[2] ?? "0", 10) : 0
  };
}
function mapAgentJobToJob(j) {
  const meta = parseJobMeta(j.name, j.labels);
  const prTitle = j.annotations["fenrir/pr-title"] || null;
  const issueAnnotation = j.annotations["fenrir/issue-title"] || j.annotations["pack/issue-title"] || null;
  const branchName = j.annotations["fenrir/branch"] || null;
  return {
    ...meta,
    name: j.name,
    status: j.status === "active" ? "pending" : j.status,
    startedAt: j.startTime,
    completedAt: j.completionTime,
    podName: null,
    issueTitle: prTitle ?? issueAnnotation,
    branchName
  };
}
async function listAgentJobs(namespace = "fenrir-agents", labelSelector = "app.kubernetes.io/component=agent-sandbox") {
  const api = getBatchApi();
  const jobList = await api.listNamespacedJob({ namespace, labelSelector });
  return jobList.items.map((job) => ({
    name: job.metadata?.name ?? "unknown",
    namespace: job.metadata?.namespace ?? namespace,
    status: jobStatus(job),
    startTime: job.status?.startTime?.toISOString() ?? null,
    completionTime: job.status?.completionTime?.toISOString() ?? null,
    labels: job.metadata?.labels ?? {},
    annotations: job.metadata?.annotations ?? {}
  }));
}
function watchAgentJobs(namespace = "fenrir-agents", labelSelector = "app.kubernetes.io/component=agent-sandbox", onUpdate, onError) {
  let stopped = false;
  const jobMap = /* @__PURE__ */ new Map();
  let currentJobReq = null;
  let currentPodReq = null;
  function sortedJobs() {
    return Array.from(jobMap.values()).sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    });
  }
  const seedFromList = async () => {
    try {
      const jobs = await listAgentJobs(namespace, labelSelector);
      for (const j of jobs) {
        const mapped = mapAgentJobToJob(j);
        jobMap.set(j.name, mapped);
      }
      try {
        const coreApi = getCoreApi();
        const podList = await coreApi.listNamespacedPod({ namespace });
        for (const pod of podList.items) {
          const podLabels = pod.metadata?.labels ?? {};
          const jobName = podLabels["batch.kubernetes.io/job-name"];
          if (!jobName) continue;
          const existing = jobMap.get(jobName);
          if (!existing) continue;
          const phase = pod.status?.phase;
          const status = podPhaseToStatus(phase);
          if (status) {
            jobMap.set(jobName, {
              ...existing,
              status,
              podName: pod.metadata?.name ?? existing.podName
            });
          }
        }
      } catch {
      }
      for (const [jobName, job] of jobMap.entries()) {
        if ((job.status === "succeeded" || job.status === "failed") && job.podName === null && job.startedAt !== null) {
          jobMap.set(jobName, { ...job, status: "purged" });
        }
      }
      if (jobMap.size > 0) onUpdate(sortedJobs());
    } catch {
    }
  };
  const doJobWatch = async () => {
    if (stopped) return;
    try {
      const kc = getKubeConfig();
      const watch = new k8s.Watch(kc);
      const req = await watch.watch(
        `/apis/batch/v1/namespaces/${namespace}/jobs`,
        { labelSelector },
        (type, obj) => {
          const name = obj.metadata?.name ?? "unknown";
          const labels = obj.metadata?.labels ?? {};
          if (type === "DELETED") {
            jobMap.delete(name);
          } else {
            const s = obj.status;
            let status = "pending";
            if (s?.active && s.active > 0) status = "running";
            else if (s?.succeeded && s.succeeded > 0) status = "succeeded";
            else if (s?.failed && s.failed > 0) status = "failed";
            const existing = jobMap.get(name);
            const meta = parseJobMeta(name, labels);
            const annotations = obj.metadata?.annotations ?? {};
            const prTitle = annotations["fenrir/pr-title"] || null;
            const issueAnnotation = annotations["fenrir/issue-title"] || annotations["pack/issue-title"] || null;
            jobMap.set(name, {
              ...meta,
              name,
              // Preserve pod-derived status when job status is "active/running"
              // because pod phase is more granular (pending vs running).
              // Terminal states (succeeded/failed) always come from job status.
              // Do not downgrade a "purged" job back to a non-terminal status.
              status: existing?.status === "purged" ? "purged" : status === "running" && existing?.status === "pending" ? "pending" : status,
              startedAt: obj.status?.startTime?.toISOString() ?? null,
              completedAt: obj.status?.completionTime?.toISOString() ?? null,
              podName: existing?.podName ?? null,
              issueTitle: prTitle ?? issueAnnotation ?? existing?.issueTitle ?? null,
              branchName: annotations["fenrir/branch"] || (existing?.branchName ?? null)
            });
          }
          onUpdate(sortedJobs());
        },
        (err) => {
          currentJobReq = null;
          if (!stopped) {
            if (err) onError(err);
            setTimeout(async () => {
              if (!stopped) {
                await seedFromList();
                void doJobWatch();
              }
            }, 5e3);
          }
        }
      );
      currentJobReq = req;
    } catch (err) {
      currentJobReq = null;
      if (!stopped) {
        onError(err instanceof Error ? err : new Error(String(err)));
        setTimeout(() => void doJobWatch(), 5e3);
      }
    }
  };
  const doPodWatch = async () => {
    if (stopped) return;
    try {
      const kc = getKubeConfig();
      const watch = new k8s.Watch(kc);
      const req = await watch.watch(
        `/api/v1/namespaces/${namespace}/pods`,
        {},
        // no label selector — filter in handler via batch.kubernetes.io/job-name
        (type, pod) => {
          const podLabels = pod.metadata?.labels ?? {};
          const jobName = podLabels["batch.kubernetes.io/job-name"];
          if (!jobName) return;
          if (type === "DELETED") {
            const existing2 = jobMap.get(jobName);
            if (existing2 && (existing2.status === "succeeded" || existing2.status === "failed")) {
              jobMap.set(jobName, { ...existing2, status: "purged", podName: null });
              onUpdate(sortedJobs());
            }
            return;
          }
          const podName = pod.metadata?.name ?? null;
          const phase = pod.status?.phase;
          const newStatus = podPhaseToStatus(phase);
          if (!newStatus) return;
          const existing = jobMap.get(jobName);
          if (!existing) return;
          if (existing.status === newStatus && existing.podName === podName) return;
          if (newStatus === "succeeded" || newStatus === "failed") {
            if (existing.status === "succeeded" || existing.status === "failed") return;
          }
          jobMap.set(jobName, { ...existing, status: newStatus, podName });
          onUpdate(sortedJobs());
        },
        (err) => {
          currentPodReq = null;
          if (!stopped) {
            if (err) onError(err);
            setTimeout(async () => {
              if (!stopped) {
                await seedFromList();
                void doPodWatch();
              }
            }, 5e3);
          }
        }
      );
      currentPodReq = req;
    } catch (err) {
      currentPodReq = null;
      if (!stopped) {
        console.warn("[k8s] Pod watch error (degraded mode):", String(err));
        setTimeout(() => void doPodWatch(), 1e4);
      }
    }
  };
  const doWatch = async () => {
    if (stopped) return;
    await seedFromList();
    void doJobWatch();
    void doPodWatch();
  };
  void doWatch();
  return () => {
    stopped = true;
    currentJobReq?.abort();
    currentPodReq?.abort();
  };
}
async function streamPodLogs(podName, namespace = "fenrir-agents", onLine, onEnd, onError, options = {}) {
  const kc = getKubeConfig();
  const log = new k8s.Log(kc);
  let buf = "";
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line) onLine(line);
      }
      callback();
    },
    final(callback) {
      if (buf) onLine(buf);
      onEnd();
      callback();
    }
  });
  writable.on("error", onError);
  try {
    const abortController = await log.log(
      namespace,
      podName,
      "",
      // container — empty = first container
      writable,
      { follow: options.follow ?? true, timestamps: true }
    );
    return () => abortController.abort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("204")) {
      onEnd();
      return () => {
      };
    }
    throw err;
  }
}
async function deleteAgentJob(sessionId, namespace = "fenrir-agents") {
  const api = getBatchApi();
  const jobName = `agent-${sessionId}`;
  await api.deleteNamespacedJob({
    name: jobName,
    namespace,
    body: { propagationPolicy: "Background" }
  });
}
async function findPodForSession(sessionId, namespace = "fenrir-agents") {
  const api = getCoreApi();
  const podList = await api.listNamespacedPod({
    namespace,
    labelSelector: `fenrir.dev/session-id=${sessionId}`
  });
  const firstPod = podList.items[0];
  if (firstPod) {
    return firstPod.metadata?.name ?? null;
  }
  const jobName = `agent-${sessionId}`;
  const byJob = await api.listNamespacedPod({
    namespace,
    labelSelector: `batch.kubernetes.io/job-name=${jobName}`
  });
  return byJob.items[0]?.metadata?.name ?? null;
}

// server/ws.ts
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// server/report.ts
function stripK8sTimestamp(line) {
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+(.*)$/.exec(line);
  return match?.[1] ?? line;
}
function parseJsonlLine(rawLine) {
  const line = stripK8sTimestamp(rawLine.trim());
  if (!line || !line.startsWith("{")) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
function extractTurns(events) {
  const toolResults = /* @__PURE__ */ new Map();
  for (const ev of events) {
    if (ev.type !== "user" || !ev.message?.content) continue;
    for (const block of ev.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        const raw = block.content;
        const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") : "";
        toolResults.set(block.tool_use_id, {
          content,
          isError: block.is_error ?? false
        });
      }
    }
  }
  const turns = [];
  let turnNum = 0;
  for (const ev of events) {
    if (ev.type !== "assistant" || !ev.message?.content) continue;
    turnNum++;
    const turn = { turnNum, texts: [], tools: [] };
    for (const block of ev.message.content) {
      if (block.type === "text" && block.text) {
        turn.texts.push(block.text);
      } else if (block.type === "tool_use" && block.id && block.name) {
        const res = toolResults.get(block.id);
        const tool = {
          id: block.id,
          name: block.name,
          input: block.input ?? {}
        };
        if (res?.content !== void 0) tool.result = res.content;
        if (res?.isError !== void 0) tool.isError = res.isError;
        turn.tools.push(tool);
      }
    }
    turns.push(turn);
  }
  return turns;
}
function detectVerdict(events) {
  const turns = extractTurns(events);
  let verdict = null;
  for (const t of turns) {
    for (const text of t.texts) {
      if (/Loki QA Verdict/i.test(text) || /\*\*Verdict:\*\*/i.test(text)) {
        verdict = { text, pass: /PASS/i.test(text) };
      }
    }
    for (const tool of t.tools) {
      if (tool.name === "Bash" && tool.input?.command) {
        const cmd = String(tool.input.command);
        if (/Loki QA Verdict/i.test(cmd)) {
          const bodyMatch = cmd.match(/--body\s+["']?([\s\S]*?)(?:["']?\s*$)/);
          const body = bodyMatch?.[1] ?? cmd;
          verdict = { text: body, pass: /PASS/i.test(cmd) };
        }
      }
    }
  }
  return verdict;
}

// server/botToken.ts
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";

// server/handoff.ts
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var SESSION_TTL_MS = 7 * 24 * 60 * 6e4;
var HANDOFF_SECRET = process.env.ODINS_THRONE_HANDOFF_SECRET ?? "";
var ephemeralSecret = null;
function secret() {
  if (HANDOFF_SECRET) return HANDOFF_SECRET;
  if (ephemeralSecret === null) ephemeralSecret = randomBytes(32).toString("hex");
  return ephemeralSecret;
}
function sign(body) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}
function mintSession(client, user) {
  const body = Buffer.from(
    JSON.stringify({ u: user, c: client, exp: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}
function verifySession(token) {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const raw = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof raw.u !== "string" || typeof raw.c !== "string" || typeof raw.exp !== "number") {
      return null;
    }
    if (raw.exp < Date.now()) return null;
    return { user: raw.u, client: raw.c, exp: raw.exp };
  } catch {
    return null;
  }
}

// server/botToken.ts
var BOT_TOKEN = process.env.ODINS_THRONE_BOT_TOKEN ?? "";
function botTokenMatches(presented) {
  if (!BOT_TOKEN) return true;
  const a = Buffer.from(presented);
  const b = Buffer.from(BOT_TOKEN);
  return a.length === b.length && timingSafeEqual2(a, b);
}
function botCredentialOk(presented) {
  if (!BOT_TOKEN) return true;
  if (!presented) return false;
  return botTokenMatches(presented) || verifySession(presented) !== null;
}

// server/ws.ts
var NODE_UNREACHABLE_PATTERN = /i\/o timeout|dial tcp[^)]*:10250|node[^\n]*(?:not ready|unreachable)|context deadline exceeded/i;
function stripInternalIPs(msg) {
  return msg.replace(/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>").replace(/\b192\.168\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>").replace(/\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>").replace(/\b169\.254\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>");
}
function friendlyK8sError(rawMessage, sessionId) {
  if (NODE_UNREACHABLE_PATTERN.test(rawMessage)) {
    return `Node unreachable \u2014 the Kubernetes node running session ${sessionId} is not responding (kubelet timeout). The cluster is retrying; logs will resume if the node recovers.`;
  }
  const statusMatch = /\b(4\d\d|5\d\d)\b/.exec(rawMessage);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : null;
  switch (status) {
    case 404:
      return `Logs unavailable \u2014 the pod for session ${sessionId} has been cleaned up (job TTL expired).`;
    case 403:
      return `Access denied to pod logs for session ${sessionId}. Contact your cluster administrator.`;
    case 401:
      return `Authentication error \u2014 check cluster credentials.`;
    case 500:
      return `Kubernetes API server error while fetching logs for session ${sessionId}. The cluster may be experiencing issues.`;
    case 503:
      return `Kubernetes API unavailable \u2014 the cluster may be temporarily unreachable.`;
    default:
      break;
  }
  const stripped = stripInternalIPs(rawMessage).replace(/HTTP response body:.*$/gim, "").replace(/HTTP status code:?\s*\d+/gi, "").replace(/\bBody:\s*undefined\b/gi, "").replace(/\bContent-Type:[^\n]*/gi, "").replace(/\bAuthorization:[^\n]*/gi, "").replace(/\n{2,}/g, " ").trim();
  if (stripped.length > 0 && stripped.length < 300) {
    return stripped;
  }
  return `An unexpected error occurred while streaming logs for session ${sessionId}.`;
}
var FIXTURES_ENABLED = process.env.NODE_ENV !== "production";
var __dirname = dirname(fileURLToPath(import.meta.url));
var FIXTURES_DIR = resolve(__dirname, "../fixtures");
function findFixture(sessionId) {
  if (!FIXTURES_ENABLED) return null;
  if (!existsSync(FIXTURES_DIR)) return null;
  const exact = resolve(FIXTURES_DIR, `agent-${sessionId}.jsonl`);
  if (existsSync(exact)) return exact;
  try {
    const files = readdirSync(FIXTURES_DIR);
    const match = files.find((f) => f.includes(sessionId) && f.endsWith(".jsonl"));
    return match ? resolve(FIXTURES_DIR, match) : null;
  } catch {
    return null;
  }
}
function listFixtureJobs() {
  if (!FIXTURES_ENABLED) return [];
  if (!existsSync(FIXTURES_DIR)) return [];
  try {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".jsonl"));
    return files.map((f) => {
      const sessionId = f.replace(/^agent-/, "").replace(/\.jsonl$/, "");
      const m = sessionId.match(/issue-(\d+)-step(\d+)-([a-z]+)/i);
      const stat = statSync(resolve(FIXTURES_DIR, f));
      return {
        sessionId,
        name: f.replace(/\.jsonl$/, ""),
        issueNumber: m ? parseInt(m[1] ?? "0", 10) : 0,
        agent: m ? (m[3] ?? "unknown").toLowerCase() : "unknown",
        step: m ? parseInt(m[2] ?? "0", 10) : 0,
        status: "succeeded",
        startedAt: stat.mtime.toISOString(),
        completedAt: stat.mtime.toISOString(),
        podName: null,
        issueTitle: null,
        branchName: null,
        fixture: true
      };
    });
  } catch {
    return [];
  }
}
function sortJobsByStartedAtDesc(jobs) {
  return [...jobs].sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });
}
function mergeWithFixtures(liveJobs) {
  const fixtureJobs = listFixtureJobs();
  if (fixtureJobs.length === 0) return sortJobsByStartedAtDesc(liveJobs);
  const liveIds = new Set(liveJobs.map((j) => j.sessionId));
  const extras = fixtureJobs.filter((f) => !liveIds.has(f.sessionId));
  return sortJobsByStartedAtDesc([...liveJobs, ...extras]);
}
function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
function broadcast(clients, msg) {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}
var PENDING_RETRY_INTERVAL_MS = 3e3;
function startLogStream(ws, sessionId, namespace, getJobs) {
  let cancelled = false;
  let cancelInner = null;
  let retryTimer = null;
  const cancel = () => {
    cancelled = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    cancelInner?.();
  };
  const scheduleRetry = () => {
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void attempt();
    }, PENDING_RETRY_INTERVAL_MS);
  };
  const attempt = async () => {
    if (cancelled) return;
    try {
      const podName = await findPodForSession(sessionId, namespace);
      if (cancelled) return;
      if (!podName) {
        const job2 = getJobs().find((j) => j.sessionId === sessionId);
        const isPendingOrRunning = job2?.status === "pending" || job2?.status === "running";
        if (isPendingOrRunning) {
          scheduleRetry();
          return;
        }
        const fixture = findFixture(sessionId);
        if (fixture) {
          console.log(`[ws] Streaming fixture for ${sessionId}: ${fixture}`);
          send(ws, { type: "fixture-start", ts: Date.now(), sessionId });
          const lines = readFileSync(fixture, "utf-8").split("\n").filter((l) => l.trim());
          const events2 = [];
          let fixturePaused = false;
          let fixtureSpeed = 1;
          let lineIndex = 0;
          let timer = null;
          const baseDelay = 200;
          const streamNext = () => {
            if (cancelled) return;
            if (fixturePaused) return;
            if (lineIndex >= lines.length) {
              const verdict = detectVerdict(events2);
              if (verdict) {
                send(ws, { type: "verdict", ts: Date.now(), sessionId, result: verdict.pass ? "PASS" : "FAIL" });
              }
              send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
              return;
            }
            const line = lines[lineIndex++];
            send(ws, { type: "log-line", ts: Date.now(), sessionId, line });
            const ev = parseJsonlLine(line);
            if (ev) events2.push(ev);
            const delay = ev ? baseDelay / fixtureSpeed : 0;
            timer = setTimeout(streamNext, delay);
          };
          const onSpeedMessage = (data) => {
            try {
              const msg = JSON.parse(String(data));
              if (msg.type === "set-speed" && msg.sessionId === sessionId) {
                if (msg.speed === 0) {
                  fixturePaused = true;
                  if (timer) {
                    clearTimeout(timer);
                    timer = null;
                  }
                } else {
                  fixtureSpeed = msg.speed ?? 1;
                  fixturePaused = false;
                  if (!timer) streamNext();
                }
              }
            } catch {
            }
          };
          ws.on("message", onSpeedMessage);
          cancelInner = () => {
            if (timer) clearTimeout(timer);
            ws.off("message", onSpeedMessage);
          };
          streamNext();
          return;
        }
        send(ws, {
          type: "stream-error",
          ts: Date.now(),
          sessionId,
          message: `Pod for session ${sessionId} has been cleaned up (job TTL expired). Logs are no longer available from the cluster.`
        });
        send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
        return;
      }
      const job = getJobs().find((j) => j.sessionId === sessionId);
      const isCompleted = job?.status === "succeeded" || job?.status === "failed";
      const events = [];
      let innerCancel = null;
      try {
        innerCancel = await streamPodLogs(
          podName,
          namespace,
          (rawLine) => {
            if (cancelled) return;
            const line = rawLine.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, "");
            send(ws, { type: "log-line", ts: Date.now(), sessionId, line });
            const ev = parseJsonlLine(line);
            if (ev) events.push(ev);
          },
          () => {
            if (cancelled) return;
            const verdict = detectVerdict(events);
            if (verdict) {
              send(ws, { type: "verdict", ts: Date.now(), sessionId, result: verdict.pass ? "PASS" : "FAIL" });
            }
            send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
          },
          (err) => {
            if (cancelled) return;
            const friendly = friendlyK8sError(err.message, sessionId);
            send(ws, { type: "stream-error", ts: Date.now(), sessionId, message: friendly });
            send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "failed" });
          },
          { follow: !isCompleted }
        );
      } catch (streamErr) {
        if (cancelled) return;
        const raw = streamErr instanceof Error ? streamErr.message : String(streamErr);
        if (raw.includes("204")) {
          send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
          return;
        }
        const currentJob = getJobs().find((j) => j.sessionId === sessionId);
        if (currentJob?.status === "pending" || currentJob?.status === "running") {
          scheduleRetry();
          return;
        }
        throw streamErr;
      }
      if (cancelled) {
        innerCancel?.();
      } else {
        cancelInner = innerCancel;
      }
    } catch (err) {
      if (cancelled) return;
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes("204")) {
        send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
        return;
      }
      const friendly = friendlyK8sError(raw, sessionId);
      send(ws, { type: "stream-error", ts: Date.now(), sessionId, message: friendly });
      send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
    }
  };
  void attempt();
  return cancel;
}
var HEARTBEAT_INTERVAL_MS = 2e4;
function attachWebSocketServer(server, labelSelector = "app.kubernetes.io/component=agent-sandbox", allowedNamespaces = ["fenrir-agents"], defaultNamespace = "fenrir-agents") {
  const nsContexts = /* @__PURE__ */ new Map();
  function getOrCreateContext(namespace) {
    const existing = nsContexts.get(namespace);
    if (existing) return existing;
    const ctx = {
      cachedJobs: [],
      clients: /* @__PURE__ */ new Set(),
      cancelWatch: watchAgentJobs(
        namespace,
        labelSelector,
        (jobs) => {
          ctx.cachedJobs = jobs;
          broadcast(ctx.clients, {
            type: "jobs-updated",
            ts: Date.now(),
            jobs: mergeWithFixtures(jobs)
          });
        },
        (err) => {
          console.error(`[ws] K8s watch error (ns=${namespace}):`, err.message);
        }
      )
    };
    nsContexts.set(namespace, ctx);
    return ctx;
  }
  function releaseContext(namespace, ws) {
    const ctx = nsContexts.get(namespace);
    if (!ctx) return;
    ctx.clients.delete(ws);
    if (ctx.clients.size === 0) {
      ctx.cancelWatch();
      nsContexts.delete(namespace);
    }
  }
  const handleConnection = async (ws, req, requireBotToken) => {
    if (requireBotToken) {
      const rawAuthUrl = req.url ?? "";
      const qIdx2 = rawAuthUrl.indexOf("?");
      const presented = qIdx2 >= 0 ? new URLSearchParams(rawAuthUrl.slice(qIdx2 + 1)).get("token") ?? "" : "";
      if (!botCredentialOk(presented)) {
        ws.close(4401, "unauthorized");
        return;
      }
    }
    const rawUrl = req.url ?? "";
    const qIdx = rawUrl.indexOf("?");
    const nsParam = qIdx >= 0 ? new URLSearchParams(rawUrl.slice(qIdx + 1)).get("namespace") ?? "" : "";
    const namespace = allowedNamespaces.includes(nsParam) ? nsParam : defaultNamespace;
    const ctx = getOrCreateContext(namespace);
    ctx.clients.add(ws);
    let isAlive = true;
    ws.on("pong", () => {
      isAlive = true;
    });
    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeat);
        return;
      }
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL_MS);
    let jobs = ctx.cachedJobs;
    if (jobs.length === 0) {
      try {
        const agentJobs = await listAgentJobs(namespace, labelSelector);
        jobs = agentJobs.map(mapAgentJobToJob);
        ctx.cachedJobs = jobs;
      } catch {
      }
    }
    send(ws, { type: "jobs-snapshot", ts: Date.now(), jobs: mergeWithFixtures(jobs) });
    const subscriptions = /* @__PURE__ */ new Map();
    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }
      if (msg.type === "ping") {
        send(ws, { type: "pong" });
      } else if (msg.type === "subscribe") {
        const { sessionId } = msg;
        if (subscriptions.has(sessionId)) return;
        const cancel = startLogStream(ws, sessionId, namespace, () => ctx.cachedJobs);
        subscriptions.set(sessionId, cancel);
      } else if (msg.type === "unsubscribe") {
        const { sessionId } = msg;
        const cancel = subscriptions.get(sessionId);
        if (cancel) {
          cancel();
          subscriptions.delete(sessionId);
          send(ws, {
            type: "stream-end",
            ts: Date.now(),
            sessionId,
            reason: "cancelled"
          });
        }
      }
    });
    const cleanup = () => {
      clearInterval(heartbeat);
      releaseContext(namespace, ws);
      for (const [, cancel] of subscriptions) {
        cancel();
      }
      subscriptions.clear();
    };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  };
  const wss = new WebSocketServer({ noServer: true });
  const botWss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/bot/ws") {
      botWss.handleUpgrade(
        req,
        socket,
        head,
        (ws) => void handleConnection(ws, req, Boolean(BOT_TOKEN))
      );
    } else if (path === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => void handleConnection(ws, req, false));
    } else {
      socket.destroy();
    }
  });
  return wss;
}

// server/spaEntry.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
var SPA_ENTRY_CACHE_CONTROL = "no-store";
function spaEntryHandler(distDir) {
  return async (c) => {
    try {
      const html = await readFile(join(distDir, "index.html"), "utf8");
      return c.body(html, 200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": SPA_ENTRY_CACHE_CONTROL
      });
    } catch {
      return c.text("Not found", 404);
    }
  };
}

// server/index.ts
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";
var app = new Hono();
var PORT = parseInt(process.env.PORT ?? "3001", 10);
var DEFAULT_NAMESPACE = process.env.K8S_NAMESPACE ?? "fenrir-agents";
var JOB_LABEL = process.env.JOB_LABEL_SELECTOR ?? "app.kubernetes.io/component=agent-sandbox";
var WEB_DIST = process.env.WEB_DIST ?? "dist-ui";
var spaEntry = spaEntryHandler(WEB_DIST);
var DEFAULT_NAMESPACES = [
  { id: "fenrir-agents", label: "Fenrir Ledger Agents" },
  { id: "say-so-agents", label: "SaySo Agents" },
  { id: "mytruthfinder-agents", label: "MyTruthFinder Agents" },
  { id: "shanaghy-com-agents", label: "Shanaghy.com Agents" },
  { id: "re-goatmower-agents", label: "Re-Goatmower Agents" }
];
function loadNamespaces() {
  const raw = process.env.NAMESPACES_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (raw_error) {
      console.warn("[config] Failed to parse NAMESPACES_JSON, using defaults");
    }
  }
  return DEFAULT_NAMESPACES;
}
var NAMESPACES = loadNamespaces();
function resolveNamespace(param) {
  if (!param) return DEFAULT_NAMESPACE;
  const allowed = NAMESPACES.map((n) => n.id);
  return allowed.includes(param) ? param : DEFAULT_NAMESPACE;
}
app.get("/healthz", (c) => {
  return c.json({ status: "ok", service: "odin-throne-monitor", ts: Date.now() });
});
var listNamespaces = (_c) => {
  return _c.json({ namespaces: NAMESPACES });
};
var listJobs = async (c) => {
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
var downloadLogs = async (c) => {
  const sessionId = c.req.param("sessionId") ?? "";
  const namespace = resolveNamespace(c.req.query("namespace"));
  try {
    const podName = await findPodForSession(sessionId, namespace);
    if (!podName) {
      return c.json({ error: "Pod not found for session" }, 404);
    }
    const lines = [];
    await new Promise((resolve2, reject) => {
      streamPodLogs(
        podName,
        namespace,
        (line) => lines.push(line),
        () => resolve2(),
        (err) => reject(err),
        { follow: false }
      );
    });
    const content = lines.join("\n");
    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sessionId}.log"`
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[k8s] Could not fetch logs for session ${sessionId}:`, message);
    return c.json({ error: message }, 500);
  }
};
var deleteJob = async (c) => {
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
app.get("/api/namespaces", listNamespaces);
app.get("/api/jobs", listJobs);
app.get("/api/logs/:sessionId", downloadLogs);
app.delete("/api/jobs/:sessionId", deleteJob);
app.get("/api/handoff", (c) => {
  const client = c.req.query("client") || "unknown";
  const user = c.req.header("x-forwarded-user") ?? "local-dev";
  const token = mintSession(client, user);
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pair Hermes \u2014 Odin's Throne</title>
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
      .then(function () { document.getElementById("hint").textContent = "copied \u2713"; document.getElementById("hint").classList.add("copied"); })
      .catch(function () { var r = document.createRange(); r.selectNodeContents(document.getElementById("k"));
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy");
        document.getElementById("hint").textContent = "copied \u2713"; document.getElementById("hint").classList.add("copied"); });
  });
</script>
</body></html>`;
  return c.body(html, 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
});
if (BOT_TOKEN) {
  console.log("[odin-throne] bot surface enabled (token-gated)");
} else {
  console.log("[odin-throne] bot surface OPEN \u2014 no ODINS_THRONE_BOT_TOKEN set (local dev)");
}
app.use(
  "/bot/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400
  })
);
app.use("/bot/api/*", async (c, next) => {
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
var ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
app.get("/", spaEntry);
app.get("/index.html", spaEntry);
app.use("/assets/*", async (c, next) => {
  c.header("Cache-Control", ASSET_CACHE_CONTROL);
  await next();
});
app.use("/*", serveStatic({ root: WEB_DIST }));
app.get("/*", spaEntry);
function startServer() {
  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[odin-throne] Listening on http://localhost:${info.port}`);
  });
  attachWebSocketServer(server, JOB_LABEL, NAMESPACES.map((n) => n.id), DEFAULT_NAMESPACE);
}
var isMainEntry = (() => {
  try {
    return process.argv[1] !== void 0 && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();
if (isMainEntry) startServer();
export {
  app
};
