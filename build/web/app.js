// src/targets/web/main.tsx
import { createRoot } from "react-dom/client";

// src/ui/platform.ts
var adapter = null;
function setPlatform(a) {
  adapter = a;
}
function getPlatform() {
  if (!adapter) {
    throw new Error(
      "platform adapter not installed \u2014 a target entry must call setPlatform() before the ui/ core renders"
    );
  }
  return adapter;
}

// src/ui/hooks/useTheme.ts
import { useSyncExternalStore } from "react";
var STORAGE_KEY = "fenrir-odins-throne-theme";
var current = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
})();
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const l of listeners) l();
}
function setTheme(t) {
  current = t;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
  }
  emit();
  getPlatform().applyTheme(t);
}
function subscribe(cb) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function currentTheme() {
  return current;
}
function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => current);
  return { theme, setTheme };
}

// src/targets/web/platform.ts
var PORTRAIT_STEMS = {
  firemandecko: "fireman-decko",
  loki: "loki",
  luna: "luna",
  freya: "freya",
  heimdall: "heimdall",
  odin: "odin"
};
var webPlatform = {
  shell: "web",
  // Seam 1: the web page owns <html>.
  applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  },
  // Seam 2: same-origin /ws — the site's own session gates the socket.
  wsUrl(namespace) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${location.host}/ws?namespace=${encodeURIComponent(namespace)}`;
  },
  // Seam 3: the SPA's original paths, untouched.
  restFetch(path, init) {
    return fetch(path, init);
  },
  // Seam 4: same-origin portrait URLs.
  avatarUrl(agentKey, variant) {
    const stem = PORTRAIT_STEMS[agentKey];
    return stem ? `/profiles/${stem}-${variant}.png` : void 0;
  },
  // The full-page shell shows the sidebar and the log terminal at once —
  // nothing to bring forward.
  focusLogView() {
  }
};

// src/targets/web/AppShell.tsx
import { useMemo as useMemo3 } from "react";

// src/ui/App.tsx
import { useCallback as useCallback6, useEffect as useEffect4, useMemo, useRef as useRef4, useState as useState6 } from "react";

// src/ui/lib/constants.ts
var AGENT_NAMES = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
  odin: "Odin"
};
var AGENT_TITLES = {
  firemandecko: "Principal Engineer",
  loki: "QA Tester",
  luna: "UX Designer",
  freya: "Product Owner",
  heimdall: "Security Specialist",
  odin: "All-Father"
};
function avatarUrl(agentKey, variant) {
  return getPlatform().avatarUrl(agentKey, variant);
}
var AGENT_COLORS = {
  firemandecko: "#4ecdc4",
  loki: "#a78bfa",
  luna: "#6b8afd",
  freya: "#f0b429",
  heimdall: "#8B5E3C",
  odin: "#c9920a",
  unknown: "#ef4444"
};
var AGENT_RUNE_NAMES = {
  firemandecko: "\u16A0\u16C1\u16B1\u16D6\u16D7\u16A8\u16BE\u16DE\u16D6\u16B2\u16DF",
  loki: "\u16DA\u16DF\u16B2\u16C1",
  luna: "\u16DA\u16A2\u16BE\u16A8",
  freya: "\u16A0\u16B1\u16D6\u16C3\u16A8",
  heimdall: "\u16BA\u16D6\u16C1\u16D7\u16DE\u16A8\u16DA\u16DA",
  odin: "\u16DF\u16DE\u16C1\u16BE",
  _fallback: "\u16A8\u16CA\u16B7\u16A8\u16B1\u16DE"
};
var AGENT_QUOTES = {
  firemandecko: "Not with words but with fire and iron is the world built \u2014 strike true, forge deep, let no flaw survive the flame",
  loki: "Every truth hides a lie, every build hides a flaw \u2014 I am the crack in the armor that saves you before battle",
  luna: "By moonlight are the hidden paths revealed \u2014 that which cannot be seen cannot be walked",
  freya: "I have walked the nine worlds in sorrow and in glory \u2014 I know what is worth building before the first stone is laid",
  heimdall: "Nothing passes the Bifr\xF6st without my knowing \u2014 I neither sleep nor blink, and neither shall your secrets slip past me",
  odin: "I hung on that windy tree for nine long nights, wounded by a spear, offered to myself \u2014 and from that sacrifice I drew the runes",
  _fallback: "From Asgard this decree is issued \u2014 let it be fulfilled"
};
var AGENT_DESCRIPTIONS = {
  firemandecko: "FiremanDecko is the Principal Engineer of Fenrir Ledger \u2014 architect, implementer, and keeper of the forge. He receives the Product Design Brief and produces architecture, technical specifications, and working code, owning the full technical lifecycle from design through implementation.",
  loki: "Loki is the QA Tester of Fenrir Ledger \u2014 the trickster who finds every crack in the armour before the enemy does. He validates implementations, writes Playwright tests, and files defects with a devil\u2019s advocate mindset. Nothing ships without his blessing.",
  luna: "Luna is the UX Designer of Fenrir Ledger \u2014 she illuminates the hidden paths so that users never stumble in the dark. She produces wireframes, interaction specs, accessibility guidelines, and component specs. She collaborates with Freya before handing designs to FiremanDecko.",
  freya: "Freya is the Product Owner of Fenrir Ledger \u2014 she has walked the nine worlds and knows what is worth building before the first stone is laid. She owns the product vision, maintains the backlog, and produces the Product Design Brief that sets the team in motion.",
  heimdall: "Heimdall is the Security Specialist of Fenrir Ledger \u2014 the ever-wakeful guardian of the Bifr\xF6st. He audits code for OWASP Top 10 vulnerabilities, verifies authentication patterns, ensures secrets are masked, and owns all security architecture and threat modelling.",
  odin: "Odin is the All-Father \u2014 he watches over all nine worlds from his throne Hlidskjalf. In Fenrir Ledger, Odin orchestrates the agents, preserves session memory, and ensures every dispatch returns from its quest. He neither sleeps nor blinks."
};
var ERROR_TABLET_SEALS = {
  "ttl-expired": {
    runes: "\u16C3\u16B7\u16B7\u16DE\u16B1\u16A8\u16CA\u16C1\u16DA",
    inscription: "From the roots of Yggdrasil, all things return to silence",
    sub: "\u16A6 \u2014 So it is carved in the world-tree \u2014 \u16A6"
  },
  "node-unreachable": {
    runes: "\u16D2\u16C1\u16A0\u16B1\u16DF\u16CA\u16CF",
    inscription: "The bridge between worlds does not always hold \u2014 seek another path",
    sub: "\u16BA \u2014 Heimdall watches, but even gods cannot hold the severed \u2014 \u16BA"
  }
};
var WIKI_LINKS = {
  Yggdrasil: "https://en.wikipedia.org/wiki/Yggdrasil",
  "Bifr\xF6st": "https://en.wikipedia.org/wiki/Bifr%C3%B6st",
  Valhalla: "https://en.wikipedia.org/wiki/Valhalla",
  "Nine Worlds": "https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds",
  "Nine Realms": "https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds",
  Fenrir: "https://en.wikipedia.org/wiki/Fenrir",
  Asgard: "https://en.wikipedia.org/wiki/Asgard",
  Gleipnir: "https://en.wikipedia.org/wiki/Gleipnir",
  "Mj\xF6lnir": "https://en.wikipedia.org/wiki/Mj%C3%B6lnir",
  Gjallarhorn: "https://en.wikipedia.org/wiki/Gjallarhorn",
  Norns: "https://en.wikipedia.org/wiki/Norns",
  "Huginn and Muninn": "https://en.wikipedia.org/wiki/Huginn_and_Muninn"
};
var STATUS_COLORS = {
  running: "#4ecdc4",
  succeeded: "#22c55e",
  failed: "#ef4444",
  pending: "#f0b429",
  purged: "#606070",
  // gray — pod reaped by K8s GC
  cached: "#c9920a"
  // gold — pinned in Odin's memory
};
var STATUS_COLORS_LIGHT = {
  running: "#0e7490",
  // dark cyan    — matches --teal-asgard family
  succeeded: "#16a34a",
  // dark green   — same as --success-strong light
  failed: "#dc2626",
  // dark red     — same as --error-strong light
  pending: "#b45309",
  // dark amber
  purged: "#57534e",
  // warm dark gray
  cached: "#8f6e0e"
  // dark gold    — same as --gold light
};
var STATUS_LABELS = {
  running: "running",
  succeeded: "succeeded",
  failed: "FAILED",
  pending: "pending",
  purged: "purged",
  // pod reaped, JSONL logs still viewable
  cached: "pinned"
  // preserved in localStorage after pod reap
};
var ODIN_QUOTES = [
  "I hung on that windy tree for nine long nights. What\u2019s a failed build to that?",
  "I gave my eye for wisdom. You lot better not waste it on sloppy commits.",
  "The wolves are always hungry. Ship or be devoured.",
  "I see all nine worlds from Hlidskjalf. I can certainly see your merge conflicts.",
  "Even Ragnarok has a sprint deadline.",
  "The All-Father watches. The All-Father judges. The All-Father merges.",
  "Every rune I carved cost blood. Every PR you ship better be worth it.",
  "Fenrir breaks chains. We break annual fees. Same energy.",
  "My spear Gungnir never misses its mark. Your tests should aspire to the same."
];
function randomQuote() {
  return ODIN_QUOTES[Math.floor(Math.random() * ODIN_QUOTES.length)] ?? ODIN_QUOTES[0];
}
function toolBadgeClass(name) {
  const n = name.toLowerCase();
  if (n === "bash" || n === "terminal") return "bash";
  if (n === "read" || n === "grep" || n === "glob" || n === "read_file" || n === "tool_search") return "read";
  if (n === "edit" || n === "multiedit" || n === "patch") return "edit";
  if (n === "write" || n === "write_file") return "write";
  if (n === "agent") return "agent";
  return "";
}
function toolCategory(name, input) {
  const cmd = String(input?.command ?? "");
  const path = String(input?.file_path ?? input?.pattern ?? "");
  if (name === "TodoWrite" || name === "TodoUpdate" || name === "plan") return "tracking";
  if (name === "Read" || name === "Grep" || name === "Glob" || name === "read_file") return "reading";
  if (name === "tool_search") return "searching";
  if (name === "Edit" || name === "MultiEdit" || name === "patch") return "editing";
  if (name === "Write" || name === "write_file") return "writing";
  if (name === "Agent") return "delegating";
  if (name === "Bash" || name === "terminal") {
    if (/git\s+(add|commit|push)/.test(cmd)) return "committing";
    if (/git\s+(fetch|rebase|pull|merge)/.test(cmd)) return "syncing";
    if (/git\s+(log|diff|status|branch)/.test(cmd)) return "inspecting";
    if (/verify\.sh|tsc|--noEmit/.test(cmd)) return "verifying";
    if (/vitest|playwright|jest/.test(cmd)) return "testing";
    if (/next\s+build|npm\s+run\s+build/.test(cmd)) return "building";
    if (/gh\s+issue/.test(cmd)) return "issue ops";
    if (/gh\s+pr/.test(cmd)) return "PR ops";
    if (/npm\s+(ci|install)|npx/.test(cmd)) return "installing";
    if (/curl|wget/.test(cmd)) return "fetching";
    if (/kubectl|helm/.test(cmd)) return "k8s ops";
    if (/rm\s+-rf|mkdir/.test(cmd)) return "cleanup";
  }
  return path ? `${name.toLowerCase()} ${path.split("/").pop() ?? ""}` : name.toLowerCase();
}
function batchSummary(tools) {
  const categories = {};
  for (const t of tools) {
    let parsed;
    try {
      parsed = t.toolInput ? JSON.parse(t.toolInput) : void 0;
    } catch {
    }
    const cat = toolCategory(t.toolName ?? "", parsed);
    categories[cat] = (categories[cat] ?? 0) + 1;
  }
  const parts = Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => count > 1 ? `${count} ${cat}` : cat);
  return parts.join(", ");
}
function toolPreview(name, input) {
  if (!input) return "";
  if ((name === "Bash" || name === "terminal") && input.command) return String(input.command).slice(0, 120);
  if ((name === "Read" || name === "Edit" || name === "Write" || name === "read_file" || name === "write_file" || name === "patch") && input.file_path)
    return String(input.file_path);
  if ((name === "Grep" || name === "Glob" || name === "tool_search") && input.pattern)
    return String(input.pattern);
  const keys = Object.keys(input);
  const firstKey = keys[0];
  if (firstKey !== void 0) return String(input[firstKey]).slice(0, 80);
  return "";
}

// src/ui/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from "react";
var MAX_RECONNECT = 10;
var BASE_DELAY_MS = 1e3;
function useWebSocket(onMessage, namespace = "fenrir-agents") {
  const wsRef = useRef(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const connectedNamespaceRef = useRef(null);
  const [state, setState] = useState("connecting");
  const [error, setError] = useState(null);
  const connect = useCallback((ns) => {
    if (connectedNamespaceRef.current === ns && (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING)) return;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
      connectedNamespaceRef.current = null;
    }
    const ws = new WebSocket(getPlatform().wsUrl(ns));
    wsRef.current = ws;
    connectedNamespaceRef.current = ns;
    setState("connecting");
    ws.addEventListener("open", () => {
      setError(null);
      reconnectCount.current = 0;
      setState("open");
    });
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        onMessageRef.current(msg);
      } catch {
      }
    });
    ws.addEventListener("close", () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
        connectedNamespaceRef.current = null;
      }
      setState("closed");
      scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      setState("error");
      setError("WebSocket connection lost \u2014 reconnecting\u2026");
    });
  }, []);
  const namespaceRef = useRef(namespace);
  namespaceRef.current = namespace;
  const scheduleReconnect = useCallback(() => {
    if (reconnectCount.current >= MAX_RECONNECT) {
      setError(`WebSocket failed after ${MAX_RECONNECT} attempts. Reload to retry.`);
      return;
    }
    const delay = Math.min(BASE_DELAY_MS * 2 ** reconnectCount.current, 3e4);
    reconnectCount.current++;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect(namespaceRef.current);
    }, delay);
  }, [connect]);
  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);
  useEffect(() => {
    reconnectCount.current = 0;
    connect(namespace);
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
        connectedNamespaceRef.current = null;
      }
    };
  }, [connect, namespace]);
  return { state, error, send };
}

// src/ui/hooks/useNamespace.ts
import { useState as useState2, useCallback as useCallback2, useEffect as useEffect2 } from "react";
var STORAGE_KEY2 = "hlidskjalf:namespace";
var DEFAULT_NAMESPACE = "fenrir-agents";
function loadNamespace() {
  try {
    const v = localStorage.getItem(STORAGE_KEY2);
    if (v) return v;
  } catch {
  }
  return DEFAULT_NAMESPACE;
}
function saveNamespace(ns) {
  try {
    localStorage.setItem(STORAGE_KEY2, ns);
  } catch {
  }
}
function useNamespace() {
  const [namespace, setNamespaceState] = useState2(loadNamespace);
  const [namespaces, setNamespaces] = useState2([
    { id: "fenrir-agents", label: "Fenrir Ledger Agents" },
    { id: "say-so-agents", label: "SaySo Agents" },
    { id: "mytruthfinder-agents", label: "MyTruthFinder Agents" },
    { id: "shanaghy-com-agents", label: "Shanaghy.com Agents" },
    { id: "re-goatmower-agents", label: "Re-Goatmower Agents" }
  ]);
  useEffect2(() => {
    getPlatform().restFetch("/api/namespaces").then((res) => res.json()).then((data) => {
      if (Array.isArray(data.namespaces) && data.namespaces.length > 0) {
        setNamespaces(data.namespaces);
        const ids = data.namespaces.map((n) => n.id);
        setNamespaceState((prev) => {
          if (!ids.includes(prev)) {
            const fallback = data.namespaces[0].id;
            saveNamespace(fallback);
            return fallback;
          }
          return prev;
        });
      }
    }).catch(() => {
    });
  }, []);
  const setNamespace = useCallback2((ns) => {
    saveNamespace(ns);
    setNamespaceState(ns);
  }, []);
  return { namespace, namespaces, setNamespace };
}

// src/ui/hooks/useNamespaceSummaries.ts
import { useCallback as useCallback3, useEffect as useEffect3, useRef as useRef2, useState as useState3 } from "react";

// src/ui/lib/restJobs.ts
function isWireJob(raw) {
  return typeof raw === "object" && raw !== null && typeof raw.sessionId === "string";
}
function normalizeRestJob(raw) {
  const labels = raw.labels ?? {};
  const annotations = raw.annotations ?? {};
  const sessionId = labels["fenrir.dev/session-id"] || raw.name.replace(/^agent-/, "");
  const m = /issue-(\d+)-step(\d+)-([a-z]+)/i.exec(sessionId);
  const prTitle = annotations["fenrir/pr-title"] || null;
  const issueAnnotation = annotations["fenrir/issue-title"] || annotations["pack/issue-title"] || null;
  return {
    sessionId,
    name: raw.name,
    issueNumber: m ? parseInt(m[1] ?? "0", 10) : 0,
    agent: m ? (m[3] ?? "unknown").toLowerCase() : "unknown",
    step: m ? parseInt(m[2] ?? "0", 10) : 0,
    // REST can't see pod phases: the K8s job controller's "active" means the
    // pod exists but may still be pulling/scheduling — that's "pending" on
    // the wire (the WS watch upgrades it to "running" later).
    status: raw.status === "active" ? "pending" : raw.status,
    startedAt: raw.startTime ?? null,
    completedAt: raw.completionTime ?? null,
    podName: null,
    issueTitle: prTitle ?? issueAnnotation,
    branchName: annotations["fenrir/branch"] || null
  };
}
function normalizeRestJobs(raw) {
  return raw.map((j) => isWireJob(j) ? j : normalizeRestJob(j));
}

// src/ui/hooks/useNamespaceSummaries.ts
var JOB_STATUSES = [
  "running",
  "pending",
  "failed",
  "succeeded",
  "cached",
  "purged"
];
var REFRESH_MS = 3e4;
var ACTIVITY_DEBOUNCE_MS = 1e3;
function emptyCounts() {
  return { pending: 0, running: 0, succeeded: 0, failed: 0, purged: 0, cached: 0 };
}
function summarizeJobs(jobs) {
  const counts = emptyCounts();
  for (const job of jobs) {
    if (job.status in counts) counts[job.status] += 1;
  }
  return { total: jobs.length, counts, jobs, error: null };
}
function summaryLine(summary) {
  const parts = [`${summary.total} task${summary.total !== 1 ? "s" : ""}`];
  for (const status of JOB_STATUSES) {
    const n = summary.counts[status];
    if (n > 0) parts.push(`${n} ${status}`);
  }
  return parts.join(" \xB7 ");
}
function useNamespaceSummaries(namespaces, activeNamespace, activityKey) {
  const [summaries, setSummaries] = useState3({});
  const mountedRef = useRef2(true);
  const inflightRef = useRef2(/* @__PURE__ */ new Set());
  useEffect3(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const fetchOne = useCallback3(async (nsId) => {
    if (inflightRef.current.has(nsId)) return;
    inflightRef.current.add(nsId);
    try {
      const res = await getPlatform().restFetch(`/api/jobs?namespace=${encodeURIComponent(nsId)}`);
      if (!mountedRef.current) return;
      if (!res.ok) {
        setSummaries((prev) => ({
          ...prev,
          [nsId]: { total: 0, counts: emptyCounts(), jobs: [], error: `HTTP ${res.status}` }
        }));
        return;
      }
      const data = await res.json();
      if (!mountedRef.current) return;
      const jobs = normalizeRestJobs(Array.isArray(data.jobs) ? data.jobs : []);
      const summary = summarizeJobs(jobs);
      setSummaries((prev) => ({ ...prev, [nsId]: summary }));
    } catch {
      if (!mountedRef.current) return;
      setSummaries((prev) => ({
        ...prev,
        [nsId]: { total: 0, counts: emptyCounts(), jobs: [], error: "unreachable" }
      }));
    } finally {
      inflightRef.current.delete(nsId);
    }
  }, []);
  const fetchAll = useCallback3(() => {
    for (const ns of namespaces) void fetchOne(ns.id);
  }, [namespaces, fetchOne]);
  useEffect3(() => {
    fetchAll();
    const timer = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);
  const firstRunRef = useRef2(true);
  useEffect3(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    const timer = setTimeout(() => void fetchOne(activeNamespace), ACTIVITY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [activityKey, activeNamespace, fetchOne]);
  return summaries;
}

// src/ui/hooks/useJobs.ts
import { useState as useState4, useCallback as useCallback4 } from "react";

// src/ui/lib/localStorageLogs.ts
var LOG_PREFIX = "odin-throne:log:";
var LOG_TTL_PREFIX = "odin-throne:log-ttl:";
var LOG_CACHE_TTL_MS = 60 * 60 * 1e3;
var MAX_LOG_SESSIONS = 10;
var MAX_LOG_BYTES = 5 * 1024 * 1024;
var CACHE_PREFIX = "odin-throne:cache:";
var MAX_CACHE_SESSIONS = 10;
var MAX_CACHE_BYTES = 20 * 1024 * 1024;
var META_PREFIX = "odin-throne:cache-meta:";
function keysWithPrefix(prefix) {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch {
  }
  return keys;
}
function appendLogLine(sessionId, line) {
  try {
    if (isPinned(sessionId)) {
      appendToCacheRaw(sessionId, line);
      return;
    }
    const key = LOG_PREFIX + sessionId;
    const existing = localStorage.getItem(key) ?? "";
    const next = existing ? existing + "\n" + line : line;
    const keys = keysWithPrefix(LOG_PREFIX);
    if (!keys.includes(key) && keys.length >= MAX_LOG_SESSIONS) {
      localStorage.removeItem(keys[0]);
    }
    const updatedKeys = keysWithPrefix(LOG_PREFIX).filter((k) => k !== key);
    let totalBytes = updatedKeys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    while (totalBytes + next.length > MAX_LOG_BYTES && updatedKeys.length > 0) {
      const oldest = updatedKeys.shift();
      totalBytes -= localStorage.getItem(oldest)?.length ?? 0;
      localStorage.removeItem(oldest);
    }
    localStorage.setItem(key, next);
    localStorage.setItem(LOG_TTL_PREFIX + sessionId, String(Date.now()));
  } catch {
  }
}
function getLog(sessionId) {
  try {
    return localStorage.getItem(LOG_PREFIX + sessionId);
  } catch {
    return null;
  }
}
function triggerBlobDownload(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
async function downloadLogFile(sessionId) {
  try {
    const res = await getPlatform().restFetch(`/api/logs/${encodeURIComponent(sessionId)}`);
    if (res.ok) {
      const content2 = await res.text();
      if (content2) {
        triggerBlobDownload(content2, `${sessionId}.log`);
        return;
      }
    }
  } catch {
  }
  const content = getLog(sessionId) ?? getCachedLog(sessionId);
  if (content) {
    triggerBlobDownload(content, `${sessionId}.log`);
  }
}
function isPinned(sessionId) {
  try {
    return localStorage.getItem(CACHE_PREFIX + sessionId) !== null;
  } catch {
    return false;
  }
}
function pinSession(sessionId, meta) {
  try {
    const content = getLog(sessionId) ?? "";
    const cacheKey = CACHE_PREFIX + sessionId;
    const metaKey = META_PREFIX + sessionId;
    const keys = keysWithPrefix(CACHE_PREFIX);
    if (!keys.includes(cacheKey) && keys.length >= MAX_CACHE_SESSIONS) {
      const oldest = keys[0];
      const oldestId = oldest.slice(CACHE_PREFIX.length);
      localStorage.removeItem(oldest);
      localStorage.removeItem(META_PREFIX + oldestId);
    }
    const updatedKeys = keysWithPrefix(CACHE_PREFIX).filter((k) => k !== cacheKey);
    let totalBytes = updatedKeys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    while (totalBytes + content.length > MAX_CACHE_BYTES && updatedKeys.length > 0) {
      const oldest = updatedKeys.shift();
      const oldId = oldest.slice(CACHE_PREFIX.length);
      totalBytes -= localStorage.getItem(oldest)?.length ?? 0;
      localStorage.removeItem(oldest);
      localStorage.removeItem(META_PREFIX + oldId);
    }
    localStorage.setItem(cacheKey, content);
    localStorage.setItem(metaKey, JSON.stringify(meta));
    localStorage.removeItem(LOG_PREFIX + sessionId);
    return true;
  } catch {
    return false;
  }
}
function unpinSession(sessionId) {
  try {
    localStorage.removeItem(CACHE_PREFIX + sessionId);
    localStorage.removeItem(META_PREFIX + sessionId);
  } catch {
  }
}
function getCachedLog(sessionId) {
  try {
    return localStorage.getItem(CACHE_PREFIX + sessionId);
  } catch {
    return null;
  }
}
function getCachedSessionMeta(sessionId) {
  try {
    const raw = localStorage.getItem(META_PREFIX + sessionId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function getCachedSessionIds() {
  const keys = keysWithPrefix(CACHE_PREFIX);
  const withMeta = [];
  for (const key of keys) {
    const id = key.slice(CACHE_PREFIX.length);
    const meta = getCachedSessionMeta(id);
    withMeta.push({ id, pinnedAt: meta?.pinnedAt ?? 0 });
  }
  return withMeta.sort((a, b) => b.pinnedAt - a.pinnedAt).map((x) => x.id);
}
function appendToCacheRaw(sessionId, line) {
  try {
    const key = CACHE_PREFIX + sessionId;
    const existing = localStorage.getItem(key);
    if (existing === null) return;
    const next = existing ? existing + "\n" + line : line;
    localStorage.setItem(key, next);
  } catch {
  }
}
function isCacheNearCap() {
  try {
    const keys = keysWithPrefix(CACHE_PREFIX);
    if (keys.length >= MAX_CACHE_SESSIONS) return true;
    const totalBytes = keys.reduce(
      (sum, k) => sum + (localStorage.getItem(k)?.length ?? 0),
      0
    );
    return totalBytes > MAX_CACHE_BYTES * 0.9;
  } catch {
    return false;
  }
}
function evictExpiredLogs(ttlMs = LOG_CACHE_TTL_MS) {
  try {
    const ttlKeys = keysWithPrefix(LOG_TTL_PREFIX);
    for (const ttlKey of ttlKeys) {
      const sessionId = ttlKey.slice(LOG_TTL_PREFIX.length);
      const ts = localStorage.getItem(ttlKey);
      if (ts && Date.now() - Number(ts) > ttlMs) {
        localStorage.removeItem(LOG_PREFIX + sessionId);
        localStorage.removeItem(ttlKey);
      }
    }
  } catch {
  }
}
function migrateRemoveDuplicateLogs() {
  try {
    const logKeys = keysWithPrefix(LOG_PREFIX);
    for (const logKey of logKeys) {
      const sessionId = logKey.slice(LOG_PREFIX.length);
      if (isPinned(sessionId)) {
        localStorage.removeItem(logKey);
      }
    }
  } catch {
  }
}

// src/ui/hooks/useJobs.ts
var STATUS_PRIORITY = {
  running: 0,
  pending: 1,
  failed: 2,
  succeeded: 3,
  cached: 4,
  purged: 5
};
function sortJobs(a, b) {
  const aPriority = STATUS_PRIORITY[a.status] ?? 99;
  const bPriority = STATUS_PRIORITY[b.status] ?? 99;
  if (aPriority !== bPriority) return aPriority - bPriority;
  const aTime = a.startTime ?? 0;
  const bTime = b.startTime ?? 0;
  return bTime - aTime;
}
function parseJob(job) {
  const agentKey = job.agent || "unknown";
  return {
    sessionId: job.sessionId,
    name: job.name,
    issue: String(job.issueNumber || "?"),
    step: String(job.step || "?"),
    agentKey,
    agentName: AGENT_NAMES[agentKey] || agentKey,
    status: job.status,
    startTime: job.startedAt ? new Date(job.startedAt).getTime() : null,
    completionTime: job.completedAt ? new Date(job.completedAt).getTime() : null,
    issueTitle: job.issueTitle ?? null,
    branchName: job.branchName ?? null,
    fixture: job.fixture ?? false
  };
}
function buildCachedJobs(liveIds) {
  const ids = getCachedSessionIds();
  const result = [];
  for (const sessionId of ids) {
    if (liveIds.has(sessionId)) continue;
    const meta = getCachedSessionMeta(sessionId);
    if (!meta) continue;
    const agentKey = meta.agent || "unknown";
    result.push({
      sessionId,
      name: meta.name,
      issue: String(meta.issueNumber || "?"),
      step: String(meta.step || "?"),
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      status: "cached",
      startTime: meta.startedAt ? new Date(meta.startedAt).getTime() : null,
      completionTime: meta.completedAt ? new Date(meta.completedAt).getTime() : null,
      issueTitle: meta.issueTitle ?? null,
      branchName: meta.branchName ?? null,
      fixture: false
    });
  }
  return result;
}
function useJobs() {
  const [jobs, setJobs] = useState4(() => {
    return buildCachedJobs(/* @__PURE__ */ new Set());
  });
  const handleMessage = useCallback4((msg) => {
    if (msg.type === "jobs-snapshot" || msg.type === "jobs-updated") {
      const live = (msg.jobs || []).filter((j) => j.status !== "purged").map(parseJob);
      const liveIds = new Set(live.map((j) => j.sessionId));
      const cached = buildCachedJobs(liveIds);
      const all = [...live, ...cached].sort(sortJobs);
      setJobs(all);
    }
  }, []);
  const refreshCached = useCallback4(() => {
    setJobs((prev) => {
      const liveIds = new Set(
        prev.filter((j) => j.status !== "cached").map((j) => j.sessionId)
      );
      const live = prev.filter((j) => j.status !== "cached");
      const cached = buildCachedJobs(liveIds);
      return [...live, ...cached].sort(sortJobs);
    });
  }, []);
  return { jobs, handleMessage, refreshCached };
}

// src/ui/hooks/useLogStream.ts
import { useState as useState5, useCallback as useCallback5, useRef as useRef3 } from "react";

// src/ui/lib/jsonl.ts
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

// src/ui/lib/hermesFormat.ts
var DIVIDER_RE = /^─{10,}$/;
var ASSISTANT_RE = /^☤/;
var QUERY_RE = /^Query: /;
var HERMES_WARN_RE = /^\[hermes\]\s*(?:WARNING|WARN):?\s*/i;
var TERMINAL_RE = /^[💻✗]\s*\$(.+)$/u;
var EXIT_RE = /\s*\[exit (\d+)\]\s*$/;
var DURATION_RE = /\s{2,}(?:\d+m\s*)?\d+(?:\.\d+)?s$/;
var READ_RE = /^📖\s*Read\s+(\S.*)$/u;
var TOOL_DETAILS_RE = /^📖\s*Reading tool details\s*·\s*(\S.*)$/u;
var TOOL_SEARCH_RE = /^🔎\s*Searching tools\s*·\s*(.+)$/u;
var WRITE_RE = /^✍\uFE0F?\s*Write\s+(\S.*)$/u;
var PATCH_RE = /^🔧\s*Patch\s+(\S.*)$/u;
var PLAN_RE = /^📋\s*Plan\s+(\S.*)$/u;
var DIFF_RE = /^│\s?(.*)$/;
var KV_RE = /^(Session|Title|Duration|Messages|Model|Branch|Working directory):\s*(.*)$/;
var RESUME_RE = /^(Resume this session with:|hermes (?:--resume|-c) )/;
var DECREE_RE = /᛭᛭᛭\s*DECREE COMPLETE/;
var VERDICT_RE = /VERDICT:\s*\**\s*([A-Za-z]+)/;
var DIFF_MAX = 1200;
var INPUT_MAX = 800;
function mergeSteps(a, b) {
  return {
    ...a.update || b.update ? { update: a.update ?? b.update } : {},
    ...a.append || b.append ? { append: [...a.append ?? [], ...b.append ?? []] } : {}
  };
}
var HermesLogParser = class {
  constructor(allocId) {
    this.allocId = allocId;
  }
  active = false;
  inEcho = false;
  sawDivider = false;
  assistant = null;
  batchId = null;
  batchChildren = [];
  batchComplete = false;
  /** the most recent tool accepts │ diff continuation lines (write_file / patch) */
  lastDiffable = false;
  reset() {
    this.active = false;
    this.inEcho = false;
    this.sawDivider = false;
    this.assistant = null;
    this.batchId = null;
    this.batchChildren = [];
    this.batchComplete = false;
    this.lastDiffable = false;
  }
  /** Activate (and reset) for a Hermes-harness session. */
  activate() {
    this.reset();
    this.active = true;
  }
  isActive() {
    return this.active;
  }
  /**
   * Feed one raw (timestamp-stripped) log line.
   * Returns null when the parser is not active and the line holds no Hermes
   * activation marker — caller falls back to its own handling.
   */
  processLine(line) {
    if (!this.active) {
      if (ASSISTANT_RE.test(line) || QUERY_RE.test(line)) this.active = true;
      else return null;
    }
    if (this.inEcho) {
      if (DIVIDER_RE.test(line)) this.inEcho = false;
      else return {};
    }
    if (DIVIDER_RE.test(line)) {
      this.sawDivider = true;
      this.lastDiffable = false;
      if (this.assistant !== null) return this.flushAssistant();
      return {};
    }
    if (ASSISTANT_RE.test(line)) {
      const step = this.assistant !== null ? this.flushAssistant() : this.completeBatch();
      this.assistant = [];
      return step;
    }
    if (this.assistant !== null) {
      this.assistant.push(line);
      return {};
    }
    if (QUERY_RE.test(line)) {
      this.inEcho = true;
      return {};
    }
    if (line.trim() === "") return {};
    if (HERMES_WARN_RE.test(line)) {
      return { append: [{ id: this.allocId(), type: "warning", message: line }] };
    }
    const diff = DIFF_RE.exec(line);
    if (diff && this.lastDiffable && this.batchChildren.length > 0) {
      return this.appendDiff(diff[1] ?? "");
    }
    const term = TERMINAL_RE.exec(line);
    if (term) {
      const failed = line.startsWith("\u2717");
      let cmd = term[1] ?? "";
      let toolResult;
      const em = EXIT_RE.exec(cmd);
      if (em) {
        toolResult = `exit ${em[1]}`;
        cmd = cmd.slice(0, em.index);
      }
      cmd = cmd.replace(DURATION_RE, "").trim();
      return this.pushTool({
        toolName: "terminal",
        toolInput: JSON.stringify({ command: cmd }).slice(0, INPUT_MAX),
        toolIsError: failed,
        ...toolResult !== void 0 ? { toolResult } : {}
      });
    }
    const read = READ_RE.exec(line);
    if (read) {
      return this.pushTool({
        toolName: "read_file",
        toolInput: JSON.stringify({ file_path: read[1].trim() }).slice(0, INPUT_MAX)
      });
    }
    const details = TOOL_DETAILS_RE.exec(line);
    if (details) {
      return this.pushTool({
        toolName: "tool_search",
        toolInput: JSON.stringify({ pattern: `tool details \xB7 ${details[1].trim()}` }).slice(0, INPUT_MAX)
      });
    }
    const search = TOOL_SEARCH_RE.exec(line);
    if (search) {
      const q = (search[1] ?? "").replace(DURATION_RE, "").trim();
      return this.pushTool({
        toolName: "tool_search",
        toolInput: JSON.stringify({ pattern: q }).slice(0, INPUT_MAX)
      });
    }
    const write = WRITE_RE.exec(line);
    if (write) {
      return this.pushTool({
        toolName: "write_file",
        toolInput: JSON.stringify({ file_path: write[1].trim() }).slice(0, INPUT_MAX),
        diffable: true
      });
    }
    const patch = PATCH_RE.exec(line);
    if (patch) {
      return this.pushTool({
        toolName: "patch",
        toolInput: JSON.stringify({ file_path: patch[1].trim() }).slice(0, INPUT_MAX),
        diffable: true
      });
    }
    const plan = PLAN_RE.exec(line);
    if (plan) {
      return this.pushTool({
        toolName: "plan",
        toolInput: JSON.stringify({ plan: plan[1].trim() }).slice(0, INPUT_MAX)
      });
    }
    if (RESUME_RE.test(line)) {
      const step = this.assistant !== null ? this.flushAssistant() : {};
      return mergeSteps(step, { append: [this.raw(line)] });
    }
    const kv = KV_RE.exec(line);
    if (kv) {
      if (!this.sawDivider) return { append: [this.raw(line)] };
      return {
        append: [{ id: this.allocId(), type: "entrypoint-info", detail: kv[1], text: kv[2].trim() }]
      };
    }
    return { append: [this.raw(line)] };
  }
  raw(line) {
    return { id: this.allocId(), type: "raw", text: line };
  }
  pushTool(tool) {
    const entry = {
      id: this.allocId(),
      type: "tool-use",
      toolId: "",
      toolName: tool.toolName,
      toolInput: tool.toolInput,
      ...tool.toolIsError !== void 0 ? { toolIsError: tool.toolIsError } : {},
      ...tool.toolResult !== void 0 ? { toolResult: tool.toolResult } : {}
    };
    this.lastDiffable = tool.diffable === true;
    if (this.batchId !== null && !this.batchComplete) {
      this.batchChildren = [...this.batchChildren, entry];
      return { update: this.batchEntry() };
    }
    this.batchId = this.allocId();
    this.batchChildren = [entry];
    this.batchComplete = false;
    return { append: [this.batchEntry()] };
  }
  appendDiff(line) {
    const last = this.batchChildren[this.batchChildren.length - 1];
    const cur = last.toolResult ?? "";
    if (cur.length >= DIFF_MAX) return {};
    let next = cur ? `${cur}
${line}` : line;
    if (next.length > DIFF_MAX) next = `${next.slice(0, DIFF_MAX)}
\u2026(truncated)`;
    const nextTool = { ...last, toolResult: next };
    this.batchChildren = [...this.batchChildren.slice(0, -1), nextTool];
    return { update: this.batchEntry() };
  }
  completeBatch() {
    if (this.batchId === null || this.batchComplete) return {};
    this.batchComplete = true;
    this.lastDiffable = false;
    return { update: this.batchEntry() };
  }
  batchEntry() {
    return {
      id: this.batchId ?? "",
      type: "tool-batch",
      text: batchSummary(this.batchChildren.filter((c) => c.type === "tool-use")),
      children: this.batchChildren,
      ...this.batchComplete ? { complete: true } : {}
    };
  }
  /** Close the open assistant turn: complete the open batch, emit the text, and a verdict if it is a decree. */
  flushAssistant() {
    const lines = this.assistant ?? [];
    this.assistant = null;
    this.lastDiffable = false;
    const text = lines.join("\n").replace(/^\n+|\n+$/g, "");
    if (!text) return this.completeBatch();
    const append = [{ id: this.allocId(), type: "assistant-text", text }];
    if (DECREE_RE.test(text)) {
      const vm = VERDICT_RE.exec(text);
      if (vm) {
        const v = vm[1].toUpperCase();
        append.push({
          id: this.allocId(),
          type: "verdict",
          verdictResult: /^FAIL|^FINDINGS/.test(v) ? "FAIL" : "PASS"
        });
      }
    }
    return mergeSteps(this.completeBatch(), { append });
  }
};

// src/ui/hooks/useLogStream.ts
var entryCounter = 0;
function nextId() {
  return `log-${++entryCounter}`;
}
var hermesParser = new HermesLogParser(nextId);
function stripTimestamp(line) {
  return line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\s+/, "");
}
function parseEntrypointLine(line) {
  if (/^===.*===$/.test(line)) {
    return { id: nextId(), type: "entrypoint-header", text: line.replace(/^=+\s*|\s*=+$/g, "") };
  }
  if (/^---.*---$/.test(line)) {
    return { id: nextId(), type: "entrypoint-header", text: line.replace(/^-+\s*|\s*-+$/g, "") };
  }
  if (line.startsWith("[FATAL]")) {
    return { id: nextId(), type: "entrypoint-fatal", text: line.slice(7).trim() };
  }
  if (line.startsWith("[WARN]")) {
    return { id: nextId(), type: "warning", message: line.slice(6).trim() };
  }
  if (line.startsWith("[ok]")) {
    return { id: nextId(), type: "entrypoint-ok", text: line.slice(4).trim() };
  }
  const kvMatch = /^(Session|Branch|Model|Working directory):\s*(.+)$/.exec(line);
  if (kvMatch) {
    return { id: nextId(), type: "entrypoint-info", detail: kvMatch[1], text: kvMatch[2] };
  }
  return { id: nextId(), type: "raw", text: line };
}
var TTL_ERROR_PATTERN = /TTL expired|cleaned up/i;
var NODE_UNREACHABLE_PATTERN = /Node unreachable|kubelet timeout/i;
var POD_NOT_READY_PATTERN = /HTTP-Code:\s*400|is not running|container.*not running/i;
function useLogStream() {
  const [entries, setEntries] = useState5([]);
  const [activeSessionId, _setActiveSessionId] = useState5(null);
  const activeSessionIdRef = useRef3(null);
  const [streamError, setStreamError] = useState5(null);
  const [streamEnded, setStreamEnded] = useState5(false);
  const [replayedFromCache, setReplayedFromCache] = useState5(false);
  const [isConnecting, _setIsConnecting] = useState5(false);
  const isConnectingRef = useRef3(false);
  const [isPodStarting, _setIsPodStarting] = useState5(false);
  const isPodStartingRef = useRef3(false);
  const replayFromCacheRef = useRef3(null);
  const taskPromptBuffer = useRef3([]);
  const inTaskPrompt = useRef3(false);
  const inEntrypoint = useRef3(false);
  const hasEmittedTaskPrompt = useRef3(false);
  const seenAssistantTurn = useRef3(false);
  const liveSkipRef = useRef3(0);
  const setIsConnecting = useCallback5((v) => {
    isConnectingRef.current = v;
    _setIsConnecting(v);
  }, []);
  const setIsPodStarting = useCallback5((v) => {
    isPodStartingRef.current = v;
    _setIsPodStarting(v);
  }, []);
  const setActiveSessionId = useCallback5((id) => {
    activeSessionIdRef.current = id;
    _setActiveSessionId(id);
  }, []);
  const clearEntries = useCallback5(() => {
    setEntries([]);
    entryCounter = 0;
    liveSkipRef.current = 0;
    taskPromptBuffer.current = [];
    inTaskPrompt.current = false;
    inEntrypoint.current = false;
    hasEmittedTaskPrompt.current = false;
    seenAssistantTurn.current = false;
    hermesParser.reset();
    setStreamError(null);
    setStreamEnded(false);
    setReplayedFromCache(false);
    setIsPodStarting(false);
    setIsConnecting(true);
  }, [setIsConnecting, setIsPodStarting]);
  const setLiveSkipCount = useCallback5((n) => {
    liveSkipRef.current = n;
  }, []);
  const processEvent = useCallback5((ev) => {
    if (ev.type === "system") {
      let detail = ev.subtype || "";
      if (ev.subtype === "init") {
        if (ev.model) detail = `init \u2014 model: ${ev.model}`;
        if (ev.cwd) detail += ` \u2014 cwd: ${ev.cwd}`;
      }
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "system", detail }
      ]);
      return;
    }
    if (ev.type === "rate_limit_event") {
      const info = ev.rate_limit_info;
      const status = String(info?.status ?? "unknown");
      const limitType = String(info?.rateLimitType ?? "");
      const resetsAt = info?.resetsAt ? new Date(Number(info.resetsAt) * 1e3).toLocaleTimeString() : "";
      const detail = `rate limit: ${status} (${limitType})${resetsAt ? ` \u2014 resets ${resetsAt}` : ""}`;
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "warning", message: detail }
      ]);
      return;
    }
    if (ev.type === "result") {
      const isError = ev.is_error === true;
      const duration = ev.duration_ms ? `${Math.round(Number(ev.duration_ms) / 1e3)}s` : "";
      const turns = ev.num_turns ? `${ev.num_turns} turns` : "";
      const resultText = typeof ev.result === "string" ? ev.result : "";
      const verdictMatch = resultText.match(/Verdict:\s*(PASS|FAIL)/i);
      if (verdictMatch) {
        setEntries((prev) => [
          ...prev,
          { id: nextId(), type: "verdict", verdictResult: verdictMatch[1]?.toUpperCase() === "PASS" ? "PASS" : "FAIL" }
        ]);
      }
      const detail = `session ${isError ? "failed" : "completed"} (${[duration, turns].filter(Boolean).join(", ")})`;
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "system", detail }
      ]);
      return;
    }
    if (ev.type === "assistant" && ev.message?.content) {
      seenAssistantTurn.current = true;
      const newTools = [];
      const newEntries = [];
      let hasText = false;
      for (const block of ev.message.content) {
        if (block.type === "thinking" && block.text) {
          newEntries.push({
            id: nextId(),
            type: "assistant-text",
            text: block.text,
            detail: "thinking"
          });
        } else if (block.type === "text" && block.text) {
          hasText = true;
          newEntries.push({
            id: nextId(),
            type: "assistant-text",
            text: block.text
          });
        } else if (block.type === "tool_use" && block.name) {
          const inputJson = block.input ? JSON.stringify(block.input, null, 2).slice(0, 500) : "";
          newTools.push({
            id: nextId(),
            type: "tool-use",
            toolId: block.id ?? "",
            toolName: block.name,
            toolInput: inputJson
          });
        }
      }
      if (newEntries.length === 0 && newTools.length === 0) return;
      setEntries((prev) => {
        const updated = [...prev];
        if (hasText) {
          for (let i = updated.length - 1; i >= 0; i--) {
            const e = updated[i];
            if (e && e.type === "tool-batch" && !e.complete) {
              updated[i] = { ...e, complete: true };
              break;
            }
          }
        }
        updated.push(...newEntries);
        if (newTools.length > 0) {
          let batchIdx = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            const e = updated[i];
            if (e && e.type === "tool-batch" && !e.complete) {
              batchIdx = i;
              break;
            }
            if (e && e.type !== "tool-batch") break;
          }
          if (batchIdx >= 0) {
            const batch = updated[batchIdx];
            const allChildren = [...batch.children ?? [], ...newTools];
            updated[batchIdx] = {
              ...batch,
              children: allChildren,
              text: batchSummary(allChildren.filter((c) => c.type === "tool-use"))
            };
          } else {
            updated.push({
              id: nextId(),
              type: "tool-batch",
              text: batchSummary(newTools),
              children: newTools
            });
          }
        }
        return updated;
      });
      return;
    }
    if (ev.type === "user" && ev.message?.content) {
      if (!seenAssistantTurn.current && !hasEmittedTaskPrompt.current && Array.isArray(ev.message.content)) {
        const promptParts = [];
        for (const block of ev.message.content) {
          if (block.type === "text" && block.text) promptParts.push(block.text);
        }
        if (promptParts.length > 0) {
          hasEmittedTaskPrompt.current = true;
          const promptText = promptParts.join("\n\n");
          setEntries((prev) => [
            ...prev,
            { id: nextId(), type: "entrypoint-task", text: promptText }
          ]);
        }
      }
      setEntries((prev) => {
        const updated = [...prev];
        for (const block of ev.message.content) {
          if (block.type === "tool_result" && block.tool_use_id) {
            const raw = block.content;
            let text = "";
            if (typeof raw === "string") text = raw;
            else if (Array.isArray(raw))
              text = raw.filter((b) => b.type === "text").map((b) => b.text || "").join("");
            if (text.length > 800) text = text.slice(0, 800) + "\n\u2026(truncated)";
            for (let i = updated.length - 1; i >= 0; i--) {
              const entry = updated[i];
              if (entry && entry.type === "tool-batch" && entry.children) {
                const children = [...entry.children];
                let found = false;
                for (let j = children.length - 1; j >= 0; j--) {
                  const child = children[j];
                  if (child && child.type === "tool-use" && child.toolId === block.tool_use_id) {
                    children[j] = { ...child, toolResult: text, toolIsError: block.is_error || false };
                    found = true;
                    break;
                  }
                }
                if (found) {
                  updated[i] = { ...entry, children };
                  break;
                }
              }
            }
          }
        }
        return updated;
      });
      return;
    }
    setEntries((prev) => [
      ...prev,
      { id: nextId(), type: "raw", text: JSON.stringify(ev).slice(0, 200) }
    ]);
  }, []);
  const processRawLogLine = useCallback5((line) => {
    const ev = parseJsonlLine(line);
    if (!ev) {
      if (line.trim()) {
        const stripped = stripTimestamp(line.trim());
        if (/^---\s*TASK PROMPT\s*---$/.test(stripped)) {
          inTaskPrompt.current = true;
          hasEmittedTaskPrompt.current = true;
          taskPromptBuffer.current = [];
          return;
        }
        if (/^---\s*END PROMPT\s*---$/.test(stripped)) {
          inTaskPrompt.current = false;
          const fullPrompt = taskPromptBuffer.current.join("\n");
          taskPromptBuffer.current = [];
          setEntries((prev) => [
            ...prev,
            { id: nextId(), type: "entrypoint-task", text: fullPrompt }
          ]);
          return;
        }
        if (inTaskPrompt.current) {
          taskPromptBuffer.current.push(stripped);
          return;
        }
        if (/^===\s*Agent Sandbox Entrypoint\s*===/.test(stripped)) {
          inEntrypoint.current = true;
          setEntries((prev) => [...prev, parseEntrypointLine(stripped)]);
          return;
        }
        if (/^===\s*Starting (Claude Code|Hermes Agent)\s*===/.test(stripped)) {
          inEntrypoint.current = false;
          hermesParser.reset();
          if (/Hermes Agent/.test(stripped)) hermesParser.activate();
          setEntries((prev) => {
            const groupTypes = /* @__PURE__ */ new Set(["entrypoint-header", "entrypoint-ok", "entrypoint-info", "entrypoint-fatal", "raw"]);
            const epChildren = [];
            const rest = [];
            for (const e of prev) {
              if (groupTypes.has(e.type)) epChildren.push(e);
              else rest.push(e);
            }
            const group = {
              id: nextId(),
              type: "entrypoint-group",
              text: "Agent Sandbox Setup",
              children: epChildren
            };
            return [...rest, group, parseEntrypointLine(stripped)];
          });
          return;
        }
        if (inEntrypoint.current) {
          setEntries((prev) => [...prev, parseEntrypointLine(stripped)]);
          return;
        }
        const step = hermesParser.processLine(stripped);
        if (step) {
          if (step.append?.some((e) => e.type === "assistant-text")) {
            seenAssistantTurn.current = true;
          }
          setEntries((prev) => {
            let next = prev;
            const upd = step.update;
            if (upd) next = next.map((e) => e.id === upd.id ? upd : e);
            const add = step.append;
            if (add && add.length > 0) next = [...next, ...add];
            return next;
          });
          return;
        }
        setEntries((prev) => [...prev, { id: nextId(), type: "raw", text: stripped }]);
      }
      return;
    }
    processEvent(ev);
  }, [processEvent]);
  const handleMessage = useCallback5((msg) => {
    if (msg.type === "log-line") {
      const line = msg.line;
      if (liveSkipRef.current > 0) {
        liveSkipRef.current--;
        return;
      }
      if (isConnectingRef.current) {
        setIsConnecting(false);
      }
      if (isPodStartingRef.current) {
        setIsPodStarting(false);
      }
      if (activeSessionIdRef.current) {
        appendLogLine(activeSessionIdRef.current, line);
      }
      processRawLogLine(line);
    } else if (msg.type === "stream-error") {
      liveSkipRef.current = 0;
      const sessionId = activeSessionIdRef.current;
      if (sessionId && getCachedLog(sessionId)) {
        if (isConnectingRef.current) {
          setIsConnecting(false);
        }
        replayFromCacheRef.current?.(sessionId);
        return;
      }
      if (POD_NOT_READY_PATTERN.test(msg.message)) {
        setIsPodStarting(true);
        return;
      }
      if (isConnectingRef.current) {
        setIsConnecting(false);
      }
      setStreamError(msg.message);
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "error", message: msg.message }
      ]);
    } else if (msg.type === "stream-end") {
      liveSkipRef.current = 0;
      if (isConnectingRef.current) {
        setIsConnecting(false);
      }
      setStreamEnded(true);
      setEntries((prev) => {
        const updated = prev.map(
          (e) => e.type === "tool-batch" && !e.complete ? { ...e, complete: true } : e
        );
        return [...updated, { id: nextId(), type: "stream-end", reason: msg.reason }];
      });
    } else if (msg.type === "verdict") {
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "verdict", verdictResult: msg.result }
      ]);
    }
  }, [processRawLogLine, setIsConnecting, setIsPodStarting]);
  const showPodStartTimeout = useCallback5(() => {
    setIsPodStarting(false);
    setIsConnecting(false);
    const msg = "Agent pod failed to start \u2014 check cluster status";
    setStreamError(msg);
    setEntries((prev) => [
      ...prev,
      { id: nextId(), type: "error", message: msg }
    ]);
  }, [setIsConnecting, setIsPodStarting]);
  const replayFromCache = useCallback5((sessionId) => {
    const content = getCachedLog(sessionId);
    if (!content) return;
    if (isConnectingRef.current) {
      setIsConnecting(false);
    }
    setReplayedFromCache(true);
    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      processRawLogLine(line);
    }
    setEntries((prev) => [
      ...prev,
      { id: nextId(), type: "system", detail: "replayed from Odin\u2019s memory (pinned cache)" }
    ]);
  }, [processRawLogLine, setIsConnecting]);
  replayFromCacheRef.current = replayFromCache;
  const replayFromTempLog = useCallback5((sessionId) => {
    const content = getLog(sessionId);
    if (!content) return 0;
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      processRawLogLine(line);
    }
    return lines.length;
  }, [processRawLogLine]);
  const isTtlExpired = streamEnded && streamError !== null && TTL_ERROR_PATTERN.test(streamError);
  const isNodeUnreachable = streamEnded && streamError !== null && NODE_UNREACHABLE_PATTERN.test(streamError);
  return {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage,
    replayFromCache,
    replayFromTempLog,
    setLiveSkipCount,
    streamError,
    streamEnded,
    isTtlExpired,
    isNodeUnreachable,
    replayedFromCache,
    isConnecting,
    isPodStarting,
    showPodStartTimeout
  };
}

// src/ui/store.ts
import { useSyncExternalStore as useSyncExternalStore2 } from "react";
var snapshot = null;
var version = 0;
var listeners2 = /* @__PURE__ */ new Set();
function emit2() {
  version += 1;
  for (const l of listeners2) l();
}
var throneStore = {
  publish(next) {
    snapshot = next;
    emit2();
  },
  get() {
    return snapshot;
  }
};
function useThrone() {
  useSyncExternalStore2(
    (cb) => {
      listeners2.add(cb);
      return () => {
        listeners2.delete(cb);
      };
    },
    () => version,
    () => version
  );
  return snapshot;
}

// src/ui/App.tsx
function App() {
  const quote = useMemo(() => randomQuote(), []);
  const { theme } = useTheme();
  const { namespace, namespaces, setNamespace } = useNamespace();
  const [profileAgent, setProfileAgent] = useState6(null);
  const [cancelTarget, setCancelTarget] = useState6(null);
  const { jobs, handleMessage: handleJobsMessage, refreshCached } = useJobs();
  const jobsActivityKey = useMemo(
    () => jobs.map((j) => `${j.sessionId}:${j.status}`).join("|"),
    [jobs]
  );
  const namespaceSummaries = useNamespaceSummaries(namespaces, namespace, jobsActivityKey);
  const {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage: handleLogMessage,
    replayFromCache,
    replayFromTempLog,
    setLiveSkipCount,
    isTtlExpired,
    isNodeUnreachable,
    streamError,
    replayedFromCache,
    isConnecting,
    isPodStarting,
    showPodStartTimeout
  } = useLogStream();
  const subscribedSessionRef = useRef4(null);
  const backgroundSubsRef = useRef4(/* @__PURE__ */ new Set());
  useEffect4(() => {
    migrateRemoveDuplicateLogs();
    evictExpiredLogs();
  }, []);
  const prevNamespaceRef = useRef4(namespace);
  const pendingSelectRef = useRef4(null);
  useEffect4(() => {
    if (prevNamespaceRef.current === namespace) return;
    prevNamespaceRef.current = namespace;
    if (subscribedSessionRef.current) {
      subscribedSessionRef.current = null;
    }
    backgroundSubsRef.current.clear();
    const pending = pendingSelectRef.current;
    pendingSelectRef.current = null;
    setActiveSessionId(pending);
    clearEntries();
  }, [namespace, setActiveSessionId, clearEntries]);
  const [isFixture, setIsFixture] = useState6(false);
  const [pinnedSessionId, setPinnedSessionId] = useState6(null);
  const [storageWarning, setStorageWarning] = useState6(null);
  const [toast, setToast] = useState6(null);
  const [terminatingSessionIds, setTerminatingSessionIds] = useState6(/* @__PURE__ */ new Set());
  useEffect4(() => {
    if (activeSessionId) {
      setPinnedSessionId(isPinned(activeSessionId) ? activeSessionId : null);
    } else {
      setPinnedSessionId(null);
    }
  }, [activeSessionId]);
  const isPinned2 = pinnedSessionId === activeSessionId && activeSessionId !== null;
  const pinnedSessionIds = useMemo(
    () => new Set(jobs.filter((j) => isPinned(j.sessionId)).map((j) => j.sessionId)),
    [jobs]
  );
  const onMessage = useCallback6(
    (msg) => {
      handleJobsMessage(msg);
      if (msg.type === "fixture-start" && "sessionId" in msg && msg.sessionId === activeSessionId) {
        setIsFixture(true);
      }
      if (msg.type === "stream-end" && "sessionId" in msg && msg.sessionId === activeSessionId) {
        setIsFixture(false);
      }
      if (msg.type === "log-line" || msg.type === "stream-error" || msg.type === "stream-end" || msg.type === "verdict") {
        if ("sessionId" in msg && msg.sessionId === activeSessionId) {
          handleLogMessage(msg);
        } else if ("sessionId" in msg && backgroundSubsRef.current.has(msg.sessionId)) {
          if (msg.type === "log-line") {
            appendLogLine(msg.sessionId, msg.line);
          } else if (msg.type === "stream-end") {
            backgroundSubsRef.current.delete(msg.sessionId);
          }
        }
      }
    },
    [handleJobsMessage, handleLogMessage, activeSessionId]
  );
  const { state: wsState, error: wsError, send } = useWebSocket(onMessage, namespace);
  const handleSelectSession = useCallback6(
    (sessionId) => {
      const currentSub = subscribedSessionRef.current;
      if (currentSub !== null && currentSub !== sessionId) {
        if (isPinned(currentSub)) {
          backgroundSubsRef.current.add(currentSub);
        } else {
          send({ type: "unsubscribe", sessionId: currentSub });
          backgroundSubsRef.current.delete(currentSub);
        }
      }
      setActiveSessionId(sessionId);
      setIsFixture(false);
      clearEntries();
      getPlatform().focusLogView();
      const selectedJob = jobs.find((j) => j.sessionId === sessionId);
      if (selectedJob?.status === "cached") {
        subscribedSessionRef.current = null;
        setTimeout(() => replayFromCache(sessionId), 0);
      } else if (currentSub === sessionId) {
        const cachedLineCount = replayFromTempLog(sessionId);
        if (cachedLineCount > 0) {
          setLiveSkipCount(cachedLineCount);
        }
      } else {
        const cachedLineCount = replayFromTempLog(sessionId);
        subscribedSessionRef.current = sessionId;
        if (cachedLineCount > 0) {
          setLiveSkipCount(cachedLineCount);
        }
        send({ type: "subscribe", sessionId });
      }
    },
    [send, setActiveSessionId, clearEntries, replayFromCache, replayFromTempLog, setLiveSkipCount, jobs]
  );
  const handleSelectTask = useCallback6(
    (ns, sessionId) => {
      if (ns === namespace) {
        handleSelectSession(sessionId);
        return;
      }
      pendingSelectRef.current = sessionId;
      setIsFixture(false);
      setNamespace(ns);
      getPlatform().focusLogView();
    },
    [namespace, handleSelectSession, setNamespace]
  );
  useEffect4(() => {
    return () => {
      if (subscribedSessionRef.current) {
        send({ type: "unsubscribe", sessionId: subscribedSessionRef.current });
      }
      for (const sessionId of backgroundSubsRef.current) {
        send({ type: "unsubscribe", sessionId });
      }
    };
  }, [send]);
  const isTtlExpiredRef = useRef4(isTtlExpired);
  isTtlExpiredRef.current = isTtlExpired;
  const isNodeUnreachableRef = useRef4(isNodeUnreachable);
  isNodeUnreachableRef.current = isNodeUnreachable;
  const prevWsState = useRef4(wsState);
  useEffect4(() => {
    const wasDisconnected = prevWsState.current !== "open";
    prevWsState.current = wsState;
    if (wsState === "open" && wasDisconnected && activeSessionId && !isTtlExpiredRef.current && !isNodeUnreachableRef.current) {
      const activeJob2 = jobs.find((j) => j.sessionId === activeSessionId);
      if (activeJob2?.status === "cached") return;
      clearEntries();
      const cachedLineCount = replayFromTempLog(activeSessionId);
      if (cachedLineCount > 0) {
        setLiveSkipCount(cachedLineCount);
      }
      subscribedSessionRef.current = activeSessionId;
      send({ type: "subscribe", sessionId: activeSessionId });
    }
  }, [wsState, activeSessionId, send, clearEntries, replayFromTempLog, setLiveSkipCount, jobs]);
  const podStartBeginRef = useRef4(null);
  useEffect4(() => {
    if (!isPodStarting || !activeSessionId) {
      podStartBeginRef.current = null;
      return;
    }
    if (podStartBeginRef.current === null) {
      podStartBeginRef.current = Date.now();
    }
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - (podStartBeginRef.current ?? Date.now());
      if (elapsed >= 12e4) {
        clearInterval(intervalId);
        showPodStartTimeout();
        return;
      }
      send({ type: "subscribe", sessionId: activeSessionId });
    }, 4e3);
    return () => clearInterval(intervalId);
  }, [isPodStarting, activeSessionId, send, showPodStartTimeout]);
  const activeJob = jobs.find((j) => j.sessionId === activeSessionId) || null;
  const handleTogglePinForSession = useCallback6(
    (sessionId) => {
      const job = jobs.find((j) => j.sessionId === sessionId);
      if (!job) return;
      if (isPinned(sessionId)) {
        unpinSession(sessionId);
        if (sessionId === activeSessionId) setPinnedSessionId(null);
        if (backgroundSubsRef.current.has(sessionId)) {
          send({ type: "unsubscribe", sessionId });
          backgroundSubsRef.current.delete(sessionId);
        }
        refreshCached();
      } else {
        const meta = {
          sessionId,
          name: job.name,
          issueNumber: Number(job.issue) || 0,
          agent: job.agentKey ?? "unknown",
          step: Number(job.step) || 1,
          startedAt: job.startTime ? new Date(job.startTime).toISOString() : null,
          completedAt: job.completionTime ? new Date(job.completionTime).toISOString() : null,
          issueTitle: job.issueTitle,
          branchName: job.branchName,
          pinnedAt: Date.now()
        };
        const ok = pinSession(sessionId, meta);
        if (ok) {
          if (sessionId === activeSessionId) setPinnedSessionId(sessionId);
          refreshCached();
          if (isCacheNearCap()) {
            setStorageWarning("Odin\u2019s memory is nearly full \u2014 oldest pins will be evicted.");
            setTimeout(() => setStorageWarning(null), 5e3);
          }
        }
      }
    },
    [jobs, activeSessionId, refreshCached, send]
  );
  const handleTogglePin = useCallback6(() => {
    if (!activeSessionId) return;
    handleTogglePinForSession(activeSessionId);
  }, [activeSessionId, handleTogglePinForSession]);
  const handleOpenCancelDialog = useCallback6(
    (sessionId) => {
      const job = jobs.find((j) => j.sessionId === sessionId);
      if (!job || job.status !== "running") return;
      const jobTitle = job.issueTitle ? `#${job.issue} \u2013 ${job.issueTitle}` : `#${job.issue} \u2013 ${job.agentName} Step ${job.step}`;
      setCancelTarget({ sessionId, jobTitle });
    },
    [jobs]
  );
  const handleConfirmCancel = useCallback6(async () => {
    if (!cancelTarget) return;
    const res = await getPlatform().restFetch(`/api/jobs/${encodeURIComponent(cancelTarget.sessionId)}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const { sessionId } = cancelTarget;
    setCancelTarget(null);
    setTerminatingSessionIds((prev) => new Set(prev).add(sessionId));
    setTimeout(() => {
      setTerminatingSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }, 3e3);
    setToast({ message: `Ragnarok unleashed \u2014 ${sessionId} terminated`, id: Date.now() });
  }, [cancelTarget]);
  const snapshot2 = {
    jobs,
    activeSessionId,
    quote,
    theme,
    wsState,
    wsError,
    namespace,
    namespaces,
    setNamespace,
    namespaceSummaries,
    entries,
    activeJob,
    isFixture,
    isTtlExpired,
    isNodeUnreachable,
    streamError,
    isPinned: isPinned2,
    replayedFromCache,
    isConnecting,
    isPodStarting,
    onSelectSession: handleSelectSession,
    onSelectTask: handleSelectTask,
    onAvatarClick: setProfileAgent,
    onOdinClick: () => setProfileAgent("odin"),
    onTogglePin: handleTogglePin,
    onTogglePinSession: handleTogglePinForSession,
    onCancelJob: handleOpenCancelDialog,
    onSetSpeed: (speed) => {
      if (activeSessionId) {
        send({ type: "set-speed", sessionId: activeSessionId, speed });
      }
    },
    pinnedSessionIds,
    terminatingSessionIds,
    profileAgent,
    setProfileAgent,
    cancelTarget,
    setCancelTarget,
    confirmCancel: handleConfirmCancel,
    toast,
    dismissToast: () => setToast(null),
    storageWarning
  };
  useEffect4(() => {
    throneStore.publish(snapshot2);
  });
  return null;
}

// src/ui/components/ErrorBoundary.tsx
import { Component } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var ErrorBoundary = class extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return /* @__PURE__ */ jsxs(
        "div",
        {
          className: "loki-eb-tablet",
          role: "alert",
          "aria-live": "assertive",
          "aria-label": "Loki has captured a component error",
          children: [
            /* @__PURE__ */ jsx("div", { className: "loki-eb-rune-border", "aria-hidden": "true", children: "\u16DA \u16DF \u16B2 \u16C1 \xB7 \u16A0 \u16A2 \u16A6 \u16A8 \u16B1 \u16B2 \u16B7 \u16B9 \u16BA \u16BE \u16C1 \u16C3 \u16C7 \u16C8 \u16C9 \u16CA \u16CF \u16D2 \u16D6 \u16D7 \u16DA \u16DC \u16DE \u16DF \xB7 \u16DA \u16DF \u16B2 \u16C1" }),
            /* @__PURE__ */ jsxs("div", { className: "loki-eb-body", children: [
              /* @__PURE__ */ jsxs("div", { className: "loki-eb-avatar", children: [
                /* @__PURE__ */ jsx("span", { className: "loki-eb-avatar-rune", "aria-hidden": "true", children: "\u16DA\u16DF\u16B2\u16C1" }),
                /* @__PURE__ */ jsx("span", { className: "loki-eb-avatar-label", children: "Loki \xB7 The Trickster" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "loki-eb-divider", "aria-hidden": "true", children: "\u16A6 \xB7 \u16DA\u16A8\u16A2\u16B7\u16A8\u16C9 \xB7 \u16A6" }),
              /* @__PURE__ */ jsx("h3", { className: "loki-eb-heading", children: "The Trickster Has Snared This Thread" }),
              /* @__PURE__ */ jsx("p", { className: "loki-eb-subheading", children: "Loki has bound this error to the world-serpent's coils \u2014 it shall cause no further chaos" }),
              /* @__PURE__ */ jsxs("div", { className: "loki-eb-inscription", "aria-label": "Error details", children: [
                /* @__PURE__ */ jsx("span", { className: "loki-eb-inscription-label", children: "Captured Inscription (error.message)" }),
                /* @__PURE__ */ jsx("code", { className: "loki-eb-inscription-message", children: this.state.error?.message ?? "Unknown error" })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "loki-eb-seal", "aria-hidden": "true", children: [
                /* @__PURE__ */ jsx("div", { className: "loki-eb-seal-runes", children: "\u16DA\u16DF\u16B2\u16C1 \xB7 \u16B9\u16DF\u16B1\u16DA\u16DE-\u16CA\u16D6\u16B1\u16C8\u16D6\u16BE\u16CF" }),
                /* @__PURE__ */ jsx("div", { className: "loki-eb-seal-inscription", children: "\u201CEvery truth hides a lie, every build hides a flaw\u201D" }),
                /* @__PURE__ */ jsx("div", { className: "loki-eb-seal-sub", children: "\u16DA \u2014 So the trickster weaves \u2014 \u16DA" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "loki-eb-action", children: /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "loki-eb-retry-btn",
                  "aria-label": "Reweave the Thread \u2014 retry this component",
                  onClick: () => this.setState({ hasError: false, error: null }),
                  children: "Reweave the Thread"
                }
              ) })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "loki-eb-rune-border bottom", "aria-hidden": "true", children: "\u16DF \u16DE \u16DC \u16DA \u16D7 \u16D6 \u16D2 \u16CF \u16CA \u16C9 \u16C8 \u16C7 \u16C3 \u16C1 \u16BE \u16BA \u16B9 \u16B7 \u16B2 \u16B1 \u16A8 \u16A6 \u16A2 \u16A0 \xB7 \u16DA \u16DF \u16B2 \u16C1" })
          ]
        }
      );
    }
    return this.props.children;
  }
};

// src/ui/components/Sidebar.tsx
import { useState as useState11, useRef as useRef6, useEffect as useEffect7 } from "react";

// src/ui/components/ThemeSwitcher.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function ThemeSwitcher({ theme, setTheme: setTheme2 }) {
  return /* @__PURE__ */ jsxs2("div", { role: "group", "aria-label": "Choose theme", className: "theme-switcher", children: [
    /* @__PURE__ */ jsx2(
      "button",
      {
        className: "theme-btn",
        "aria-pressed": theme === "light",
        "aria-label": "Light theme",
        onClick: () => setTheme2("light"),
        children: "\u2600"
      }
    ),
    /* @__PURE__ */ jsx2(
      "button",
      {
        className: "theme-btn",
        "aria-pressed": theme === "dark",
        "aria-label": "Dark theme",
        onClick: () => setTheme2("dark"),
        children: "\u263D"
      }
    )
  ] });
}

// src/ui/components/StatusBadge.tsx
import { useCallback as useCallback7, useEffect as useEffect5, useId, useRef as useRef5, useState as useState7 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var STATE_COLORS = {
  open: "#22c55e",
  connecting: "#eab308",
  closed: "#6b7280",
  error: "#ef4444"
};
var WOLF_VOICE = {
  open: "The thread holds. Fenrir watches.",
  connecting: "The Norns weave. Hold fast.",
  closed: "The chain is broken. Fenrir stirs.",
  error: "The chain is broken. Fenrir stirs."
};
var ARIA_LABEL = {
  open: "WebSocket connected \u2014 the thread holds",
  connecting: "WebSocket reconnecting \u2014 the Norns weave",
  closed: "WebSocket closed \u2014 the chain is broken",
  error: "WebSocket error \u2014 the chain is broken"
};
function roleForState(state) {
  return state === "closed" || state === "error" ? "alert" : "status";
}
function WssIcon({ color }) {
  return /* @__PURE__ */ jsxs3(
    "svg",
    {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx3("rect", { x: "6", y: "8", width: "4", height: "5", rx: "1", fill: color }),
        /* @__PURE__ */ jsx3("rect", { x: "5", y: "6", width: "1.5", height: "3", rx: "0.5", fill: color }),
        /* @__PURE__ */ jsx3("rect", { x: "9.5", y: "6", width: "1.5", height: "3", rx: "0.5", fill: color }),
        /* @__PURE__ */ jsx3("rect", { x: "4.5", y: "3", width: "7", height: "4", rx: "1.5", fill: color }),
        /* @__PURE__ */ jsx3(
          "path",
          {
            d: "M2.5 2.5 C2.5 2.5 1 4.5 1 8 C1 11.5 2.5 13.5 2.5 13.5",
            stroke: color,
            strokeWidth: "1.2",
            strokeLinecap: "round",
            fill: "none",
            opacity: "0.5"
          }
        ),
        /* @__PURE__ */ jsx3(
          "path",
          {
            d: "M13.5 2.5 C13.5 2.5 15 4.5 15 8 C15 11.5 13.5 13.5 13.5 13.5",
            stroke: color,
            strokeWidth: "1.2",
            strokeLinecap: "round",
            fill: "none",
            opacity: "0.5"
          }
        )
      ]
    }
  );
}
function StatusBadge({ state }) {
  const color = STATE_COLORS[state];
  const tooltipId = useId();
  const [visible, setVisible] = useState7(false);
  const showTimerRef = useRef5(null);
  const hideTimerRef = useRef5(null);
  const mobileDismissRef = useRef5(null);
  const clearTimers = useCallback7(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);
  const show = useCallback7(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setVisible(true);
  }, []);
  const hide = useCallback7(() => {
    clearTimers();
    setVisible(false);
  }, [clearTimers]);
  useEffect5(() => {
    hide();
  }, [state]);
  const handleMouseEnter = useCallback7(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    showTimerRef.current = setTimeout(() => {
      showTimerRef.current = null;
      show();
    }, 300);
  }, [show]);
  const handleMouseLeave = useCallback7(() => {
    if (showTimerRef.current !== null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      hide();
    }, 100);
  }, [hide]);
  const handleFocus = useCallback7(() => {
    clearTimers();
    show();
  }, [clearTimers, show]);
  const handleBlur = useCallback7(() => {
    hide();
  }, [hide]);
  const handleKeyDown = useCallback7(
    (e) => {
      if (e.key === "Escape" && visible) {
        e.preventDefault();
        hide();
      }
    },
    [visible, hide]
  );
  const handleClick = useCallback7(() => {
    if (visible) {
      if (mobileDismissRef.current !== null) {
        clearTimeout(mobileDismissRef.current);
        mobileDismissRef.current = null;
      }
      setVisible(false);
    } else {
      setVisible(true);
      mobileDismissRef.current = setTimeout(() => {
        mobileDismissRef.current = null;
        setVisible(false);
      }, 3e3);
    }
  }, [visible]);
  useEffect5(() => {
    return () => {
      clearTimers();
      if (mobileDismissRef.current !== null) {
        clearTimeout(mobileDismissRef.current);
      }
    };
  }, [clearTimers]);
  const role = roleForState(state);
  const ariaLive = role === "alert" ? "assertive" : "polite";
  return /* @__PURE__ */ jsxs3("span", { className: "wss-tooltip-wrapper", children: [
    /* @__PURE__ */ jsx3(
      "span",
      {
        className: `ws-badge ws-badge-icon ${state}`,
        "aria-label": ARIA_LABEL[state],
        "aria-describedby": tooltipId,
        "aria-live": ariaLive,
        role,
        tabIndex: 0,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        onClick: handleClick,
        children: /* @__PURE__ */ jsx3(WssIcon, { color })
      }
    ),
    /* @__PURE__ */ jsx3(
      "span",
      {
        id: tooltipId,
        role: "tooltip",
        className: `wss-tooltip${visible ? " wss-tooltip--visible" : ""}`,
        children: WOLF_VOICE[state]
      }
    )
  ] });
}

// src/ui/components/NamespaceTree.tsx
import { useState as useState10 } from "react";

// src/ui/lib/namespaceIcons.ts
var ICON_BASE = "https://www.shanaghy.com/assets/icons/";
var ICON_POOL = [
  "raven.png",
  "scroll.png",
  "horn.png",
  "moon.png",
  "ring.png",
  "hammer.png",
  "cauldron.png",
  "dice.png",
  "octopi.png",
  "wolf-coins.png",
  "fianna-watch.png",
  "fionn-salmon.png",
  "gleipnir.png",
  "moss-quiet.png",
  "mossiah.png",
  "moinin.png",
  "sean-chai.png",
  "hal9005.png",
  "the-daykeeper.png",
  "candle.png",
  "smith-odin.png",
  "forge-logo.png",
  "webknot.png",
  "backup-keeper.png",
  "deco.png",
  "zigbee2mqtt.png",
  "cyclone-vacuum.png",
  "front-doorbell.png"
];
var NAMESPACE_CURATED = {
  // Fenrir the wolf, guarder of the ledger
  "fenrir-agents": "wolf-coins.png",
  // Gjallarhorn — every say-so proclaimed aloud
  "say-so-agents": "horn.png",
  // Fionn's Salmon of Knowledge — the truth finder
  "mytruthfinder-agents": "fionn-salmon.png",
  // the knot of sites the web hands are tied with
  "shanaghy-com-agents": "webknot.png",
  // the mown moss of the goatmower's rounds
  "re-goatmower-agents": "mossiah.png"
};
function hashKey(key) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) + h + key.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}
function namespaceIcon(nsId) {
  const curated = NAMESPACE_CURATED[nsId];
  if (curated) return ICON_BASE + curated;
  return ICON_BASE + ICON_POOL[hashKey(nsId) % ICON_POOL.length];
}
var NAMESPACE_ICON_FALLBACK = "\u{1F310}";

// src/ui/components/TreeIcon.tsx
import { useState as useState8 } from "react";
import { jsx as jsx4 } from "react/jsx-runtime";
function TreeIcon({ src, fallback, size = "ns" }) {
  const [failed, setFailed] = useState8(false);
  if (failed) {
    return /* @__PURE__ */ jsx4(
      "span",
      {
        className: size === "task" ? "ns-tree__icon ns-tree__icon--task ns-tree__icon--fallback" : "ns-tree__icon ns-tree__icon--fallback",
        "aria-hidden": "true",
        "data-icon-fallback": fallback,
        children: fallback
      }
    );
  }
  return /* @__PURE__ */ jsx4(
    "img",
    {
      className: size === "task" ? "ns-tree__icon ns-tree__icon--task" : "ns-tree__icon",
      src,
      alt: "",
      "aria-hidden": "true",
      loading: "lazy",
      onError: () => setFailed(true)
    }
  );
}

// src/ui/components/JobCard.tsx
import { useState as useState9, useEffect as useEffect6 } from "react";

// src/ui/components/StatusIcon.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function StatusIconSvg({ status }) {
  switch (status) {
    case "running":
      return /* @__PURE__ */ jsx5(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 16 16",
          fill: "none",
          "aria-hidden": "true",
          className: "status-svg-spin",
          children: /* @__PURE__ */ jsx5(
            "circle",
            {
              cx: "8",
              cy: "8",
              r: "5.5",
              stroke: "currentColor",
              strokeWidth: "2.2",
              fill: "none",
              strokeDasharray: "22 12",
              strokeLinecap: "round"
            }
          )
        }
      );
    case "succeeded":
      return /* @__PURE__ */ jsx5(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 16 16",
          fill: "none",
          "aria-hidden": "true",
          children: /* @__PURE__ */ jsx5(
            "polyline",
            {
              points: "3,9 6.5,13 13,4",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          )
        }
      );
    case "failed":
      return /* @__PURE__ */ jsxs4(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 16 16",
          fill: "none",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx5(
              "line",
              {
                x1: "4",
                y1: "4",
                x2: "12",
                y2: "12",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round"
              }
            ),
            /* @__PURE__ */ jsx5(
              "line",
              {
                x1: "12",
                y1: "4",
                x2: "4",
                y2: "12",
                stroke: "currentColor",
                strokeWidth: "2",
                strokeLinecap: "round"
              }
            )
          ]
        }
      );
    case "pending":
      return /* @__PURE__ */ jsxs4(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 16 16",
          fill: "none",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx5(
              "path",
              {
                d: "M4 2h8M4 14h8",
                stroke: "currentColor",
                strokeWidth: "1.8",
                strokeLinecap: "round"
              }
            ),
            /* @__PURE__ */ jsx5(
              "path",
              {
                d: "M5 2v4l6 4v4M11 2v4L5 10v4",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round"
              }
            )
          ]
        }
      );
    case "purged":
      return /* @__PURE__ */ jsx5(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 16 16",
          fill: "none",
          "aria-hidden": "true",
          children: /* @__PURE__ */ jsx5(
            "circle",
            {
              cx: "8",
              cy: "8",
              r: "4.5",
              stroke: "currentColor",
              strokeWidth: "1.5",
              strokeDasharray: "4 3"
            }
          )
        }
      );
    case "cached":
      return /* @__PURE__ */ jsxs4(
        "svg",
        {
          width: "12",
          height: "12",
          viewBox: "0 0 16 16",
          fill: "none",
          "aria-hidden": "true",
          children: [
            /* @__PURE__ */ jsx5(
              "path",
              {
                d: "M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinejoin: "round"
              }
            ),
            /* @__PURE__ */ jsx5(
              "line",
              {
                x1: "5",
                y1: "11",
                x2: "2",
                y2: "14",
                stroke: "currentColor",
                strokeWidth: "1.5",
                strokeLinecap: "round"
              }
            )
          ]
        }
      );
  }
}

// src/ui/lib/resolveSessionTitle.ts
function parseBranchTitle(branch, step) {
  const stripped = branch.replace(/^[a-z-]+\//, "");
  const issueMatch = /issue-(\d+)-?/i.exec(stripped);
  if (!issueMatch) return branch;
  const issueNumber = issueMatch[1];
  const slug = stripped.replace(/^issue-\d+-?/, "").replace(/-/g, " ").trim();
  if (!slug) return `Issue #${issueNumber} \u2013 Step ${step}`;
  return `Issue #${issueNumber} \u2013 ${slug} \u2013 Step ${step}`;
}
function parseSessionIdTitle(sessionId) {
  const match = /^issue-(\d+)-step(\d+)-/i.exec(sessionId);
  if (!match) return null;
  return `Issue #${match[1]} \u2013 Step ${match[2]}`;
}
function resolveSessionTitle(job) {
  if (job.issueTitle) {
    return job.issueTitle;
  }
  if (job.branchName) {
    const fromBranch = parseBranchTitle(job.branchName, job.step);
    if (fromBranch !== job.branchName) {
      return fromBranch;
    }
  }
  const fromSessionId = parseSessionIdTitle(job.sessionId);
  if (fromSessionId) {
    return fromSessionId;
  }
  return job.branchName ?? job.sessionId;
}

// src/ui/components/JobCard.tsx
import { Fragment, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function formatElapsed(startTime, completionTime) {
  if (!startTime) return "\u2014";
  const end = completionTime ?? Date.now();
  const ms = end - startTime;
  const seconds = Math.floor(ms / 1e3);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
function formatTimestamp(ts) {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function JobCard({ job, isActive, onClick, onAvatarClick, isPinned: isPinned2 = false, onTogglePin, onCancelJob, displayMode = "normal", isTerminating = false }) {
  const { theme } = useTheme();
  const agentColor = AGENT_COLORS[job.agentKey ?? ""] || "#c9920a";
  const avatar = avatarUrl(job.agentKey ?? "", theme === "light" ? "light" : "dark");
  const statusColorMap = theme === "light" ? STATUS_COLORS_LIGHT : STATUS_COLORS;
  const sColor = statusColorMap[job.status] || (theme === "light" ? "#57534e" : "#606070");
  const sLabel = STATUS_LABELS[job.status] || job.status;
  const pulse = job.status === "running" ? " pulse" : "";
  const displayTitle = resolveSessionTitle(job);
  const secondaryMeta = job.issueTitle ? `Issue #${job.issue} \xB7 ${job.agentName} \xB7 Step ${job.step}` : null;
  if (displayMode === "compact") {
    return /* @__PURE__ */ jsxs5(
      "div",
      {
        className: `card card--minimal${isActive ? " active" : ""}${isTerminating ? " card--terminating" : ""}`,
        role: "listitem",
        "aria-label": `Job: Issue ${job.issue} \u2013 ${job.agentName} \u2013 ${sLabel}`,
        onClick,
        children: [
          /* @__PURE__ */ jsx6("span", { className: `card-status${pulse}`, style: { color: sColor }, "aria-hidden": "true", children: /* @__PURE__ */ jsx6(StatusIconSvg, { status: job.status }) }),
          /* @__PURE__ */ jsxs5("span", { className: "card-minimal-issue", "aria-label": `Issue ${job.issue}`, children: [
            "#",
            job.issue
          ] }),
          avatar ? /* @__PURE__ */ jsx6(
            "button",
            {
              className: "card-avatar-btn card-avatar-btn--minimal",
              onClick: (e) => {
                e.stopPropagation();
                onClick();
              },
              "aria-label": `Open session log for ${job.agentName} \u2013 Issue ${job.issue}`,
              children: /* @__PURE__ */ jsx6("img", { className: "card-avatar card-avatar--minimal", src: avatar, alt: job.agentName })
            }
          ) : /* @__PURE__ */ jsx6("span", { className: "card-minimal-agent-initial", style: { color: agentColor }, "aria-label": job.agentName, children: job.agentName?.[0] ?? "?" }),
          isTerminating && /* @__PURE__ */ jsx6("span", { className: "card-terminated-overlay", "aria-label": "Terminating", children: "\u2715" })
        ]
      }
    );
  }
  const isExtended = displayMode === "extended";
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      className: `card${isActive ? " active" : ""}${isTerminating ? " card--terminating" : ""}`,
      role: "listitem",
      "aria-label": `Job: ${displayTitle} \u2013 Issue ${job.issue} \u2013 ${job.agentName} \u2013 Step ${job.step} \u2013 ${sLabel}`,
      onClick,
      children: [
        /* @__PURE__ */ jsxs5("div", { className: "card-top", children: [
          avatar && /* @__PURE__ */ jsx6(
            "button",
            {
              className: "card-avatar-btn",
              onClick: (e) => {
                e.stopPropagation();
                onAvatarClick?.(job.agentKey ?? "");
              },
              "aria-label": `View ${job.agentName} profile`,
              title: `View ${job.agentName} profile`,
              children: /* @__PURE__ */ jsx6("img", { className: "card-avatar", src: avatar, alt: job.agentName })
            }
          ),
          isExtended && /* @__PURE__ */ jsxs5("span", { className: "card-extended-issue-badge", "aria-label": `Issue ${job.issue}`, children: [
            "#",
            job.issue
          ] }),
          /* @__PURE__ */ jsx6("span", { className: "card-issue-title", title: displayTitle, children: displayTitle })
        ] }),
        /* @__PURE__ */ jsx6("div", { className: "card-meta-new", children: isExtended ? /* @__PURE__ */ jsxs5(Fragment, { children: [
          job.status === "running" && onCancelJob ? /* @__PURE__ */ jsxs5(
            "button",
            {
              className: `card-extended-action-btn card-extended-action-btn--cancel${pulse}`,
              style: { color: sColor },
              title: "Invoke Ragnar\xF6k \u2014 click to cancel this job",
              "aria-label": "Cancel running job",
              onClick: (e) => {
                e.stopPropagation();
                onCancelJob(job.sessionId);
              },
              children: [
                /* @__PURE__ */ jsx6(StatusIconSvg, { status: job.status }),
                /* @__PURE__ */ jsx6("span", { children: sLabel })
              ]
            }
          ) : /* @__PURE__ */ jsxs5(
            "span",
            {
              className: `card-extended-status-label${pulse}`,
              style: { color: sColor },
              "aria-label": `Status: ${sLabel}`,
              title: sLabel,
              children: [
                /* @__PURE__ */ jsx6(StatusIconSvg, { status: job.status }),
                /* @__PURE__ */ jsx6("span", { children: sLabel })
              ]
            }
          ),
          secondaryMeta ? /* @__PURE__ */ jsxs5("span", { className: "card-secondary-meta", "aria-label": secondaryMeta, children: [
            /* @__PURE__ */ jsxs5("span", { className: "card-secondary-issue", children: [
              "Issue #",
              job.issue
            ] }),
            /* @__PURE__ */ jsx6("span", { className: "card-meta-sep", "aria-hidden": "true", children: " \xB7 " }),
            /* @__PURE__ */ jsx6("span", { className: "card-agent-badge", style: { color: agentColor }, children: job.agentName }),
            /* @__PURE__ */ jsx6("span", { className: "card-meta-sep", "aria-hidden": "true", children: " \xB7 " }),
            /* @__PURE__ */ jsxs5("span", { children: [
              "Step ",
              job.step
            ] })
          ] }) : /* @__PURE__ */ jsxs5(Fragment, { children: [
            /* @__PURE__ */ jsx6("span", { className: "card-agent-badge", style: { color: agentColor }, children: job.agentName }),
            /* @__PURE__ */ jsxs5("span", { children: [
              "Step ",
              job.step
            ] })
          ] }),
          job.fixture && /* @__PURE__ */ jsx6("span", { className: "card-fixture-badge", title: "Fixture (replayed log)", children: "\u16A0" }),
          /* @__PURE__ */ jsxs5("span", { className: "card-meta-actions", children: [
            /* @__PURE__ */ jsx6(CardCopySessionIdButton, { sessionId: job.sessionId, labeled: true }),
            onTogglePin && /* @__PURE__ */ jsx6(CardPinButtonLabeled, { isPinned: isPinned2, onTogglePin }),
            job.status === "succeeded" && /* @__PURE__ */ jsx6(CardDownloadButtonLabeled, { sessionId: job.sessionId })
          ] })
        ] }) : /* @__PURE__ */ jsxs5(Fragment, { children: [
          job.status !== "cached" && (job.status === "running" && onCancelJob ? /* @__PURE__ */ jsx6(
            "button",
            {
              className: `card-status-lead card-status-lead--cancel${pulse}`,
              style: { color: sColor },
              title: "Invoke Ragnar\xF6k \u2014 click to cancel this job",
              "aria-label": "Cancel running job",
              onClick: (e) => {
                e.stopPropagation();
                onCancelJob(job.sessionId);
              },
              children: /* @__PURE__ */ jsx6(StatusIconSvg, { status: job.status })
            }
          ) : /* @__PURE__ */ jsx6(
            "span",
            {
              className: `card-status-lead${pulse}`,
              style: { color: sColor },
              title: sLabel,
              "aria-label": `Status: ${sLabel}`,
              children: /* @__PURE__ */ jsx6(StatusIconSvg, { status: job.status })
            }
          )),
          secondaryMeta ? /* @__PURE__ */ jsxs5("span", { className: "card-secondary-meta", "aria-label": secondaryMeta, children: [
            /* @__PURE__ */ jsxs5("span", { className: "card-secondary-issue", children: [
              "Issue #",
              job.issue
            ] }),
            /* @__PURE__ */ jsx6("span", { className: "card-meta-sep", "aria-hidden": "true", children: " \xB7 " }),
            /* @__PURE__ */ jsx6("span", { className: "card-agent-badge", style: { color: agentColor }, children: job.agentName }),
            /* @__PURE__ */ jsx6("span", { className: "card-meta-sep", "aria-hidden": "true", children: " \xB7 " }),
            /* @__PURE__ */ jsxs5("span", { children: [
              "Step ",
              job.step
            ] })
          ] }) : /* @__PURE__ */ jsxs5(Fragment, { children: [
            /* @__PURE__ */ jsx6("span", { className: "card-agent-badge", style: { color: agentColor }, children: job.agentName }),
            /* @__PURE__ */ jsxs5("span", { children: [
              "Step ",
              job.step
            ] })
          ] }),
          job.fixture && /* @__PURE__ */ jsx6("span", { className: "card-fixture-badge", title: "Fixture (replayed log)", children: "\u16A0" }),
          /* @__PURE__ */ jsxs5("span", { className: "card-meta-actions", children: [
            onTogglePin && /* @__PURE__ */ jsx6(CardPinButton, { isPinned: isPinned2, onTogglePin }),
            job.status === "succeeded" && /* @__PURE__ */ jsx6(CardDownloadButton, { sessionId: job.sessionId }),
            /* @__PURE__ */ jsx6(CardCopySessionIdButton, { sessionId: job.sessionId })
          ] })
        ] }) }),
        isExtended && (job.startTime || job.completionTime) && /* @__PURE__ */ jsxs5("div", { className: "card-extended-meta", children: [
          /* @__PURE__ */ jsx6("span", { className: "card-extended-elapsed", title: "Elapsed time", children: formatElapsed(job.startTime, job.completionTime) }),
          /* @__PURE__ */ jsx6("span", { className: "card-extended-timestamp", title: "Last activity", children: formatTimestamp(job.completionTime ?? job.startTime) })
        ] }),
        isTerminating && /* @__PURE__ */ jsx6("span", { className: "card-terminated-overlay", "aria-label": "Terminating", children: "TERMINATED" })
      ]
    }
  );
}
function CardPinButton({ isPinned: isPinned2, onTogglePin }) {
  const [confirming, setConfirming] = useState9(false);
  useEffect6(() => {
    setConfirming(false);
  }, [isPinned2]);
  if (confirming) {
    return /* @__PURE__ */ jsx6(
      "button",
      {
        className: "card-pin-btn confirming",
        onClick: (e) => {
          e.stopPropagation();
          onTogglePin();
          setConfirming(false);
        },
        onBlur: () => setConfirming(false),
        title: "Confirm: remove from Odin\\u2019s memory",
        "aria-label": "Confirm unpin",
        children: /* @__PURE__ */ jsx6("span", { className: "card-pin-confirm-x", "aria-hidden": "true", children: "\u2715" })
      }
    );
  }
  return /* @__PURE__ */ jsx6(
    "button",
    {
      className: `card-pin-btn${isPinned2 ? " pinned" : ""}`,
      onClick: (e) => {
        e.stopPropagation();
        if (isPinned2) {
          setConfirming(true);
        } else {
          onTogglePin();
        }
      },
      title: isPinned2 ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory",
      "aria-label": isPinned2 ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory",
      "aria-pressed": isPinned2,
      children: /* @__PURE__ */ jsx6(CardPinIcon, { filled: isPinned2 })
    }
  );
}
function CardPinButtonLabeled({ isPinned: isPinned2, onTogglePin }) {
  const [confirming, setConfirming] = useState9(false);
  useEffect6(() => {
    setConfirming(false);
  }, [isPinned2]);
  if (confirming) {
    return /* @__PURE__ */ jsx6(
      "button",
      {
        className: "card-extended-action-btn card-extended-action-btn--confirm",
        onClick: (e) => {
          e.stopPropagation();
          onTogglePin();
          setConfirming(false);
        },
        onBlur: () => setConfirming(false),
        title: "Confirm: remove from Odin\\u2019s memory",
        "aria-label": "Confirm unpin",
        children: /* @__PURE__ */ jsx6("span", { className: "card-pin-confirm-x", "aria-hidden": "true", children: "\u2715" })
      }
    );
  }
  return /* @__PURE__ */ jsxs5(
    "button",
    {
      className: `card-extended-action-btn${isPinned2 ? " card-extended-action-btn--pinned" : ""}`,
      onClick: (e) => {
        e.stopPropagation();
        if (isPinned2) {
          setConfirming(true);
        } else {
          onTogglePin();
        }
      },
      title: isPinned2 ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory",
      "aria-label": isPinned2 ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory",
      "aria-pressed": isPinned2,
      children: [
        /* @__PURE__ */ jsx6(CardPinIcon, { filled: isPinned2 }),
        /* @__PURE__ */ jsx6("span", { children: "Pin Session" })
      ]
    }
  );
}
function CardCopySessionIdButton({ sessionId, labeled }) {
  const [copied, setCopied] = useState9(false);
  async function handleCopy(e) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2e3);
    } catch {
    }
  }
  if (labeled) {
    return /* @__PURE__ */ jsxs5(
      "button",
      {
        className: `card-extended-action-btn${copied ? " card-extended-action-btn--copied" : ""}`,
        onClick: handleCopy,
        title: copied ? "Copied!" : `Copy session ID: ${sessionId}`,
        "aria-label": copied ? "Session ID copied" : "Copy Session ID",
        children: [
          copied ? /* @__PURE__ */ jsx6(CardCheckIcon, {}) : /* @__PURE__ */ jsx6(CardClipboardIcon, {}),
          /* @__PURE__ */ jsx6("span", { children: copied ? "Copied!" : "Copy Session ID" })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsx6(
    "button",
    {
      className: `copy-session-btn${copied ? " copied" : ""}`,
      onClick: handleCopy,
      title: copied ? "Copied!" : "Copy session ID",
      "aria-label": copied ? "Session ID copied" : "Copy session ID",
      children: copied ? /* @__PURE__ */ jsx6(CardCheckIcon, {}) : /* @__PURE__ */ jsx6(CardClipboardIcon, {})
    }
  );
}
function CardClipboardIcon() {
  return /* @__PURE__ */ jsxs5("svg", { width: "11", height: "11", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx6("rect", { x: "4", y: "3", width: "7", height: "9", rx: "1", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ jsx6("path", { d: "M4 4H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
    /* @__PURE__ */ jsx6("path", { d: "M6 3V2h3v1", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
  ] });
}
function CardCheckIcon() {
  return /* @__PURE__ */ jsx6("svg", { width: "11", height: "11", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ jsx6("path", { d: "M2 7l4 4 6-6", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
function CardPinIcon({ filled }) {
  return /* @__PURE__ */ jsx6("svg", { width: "11", height: "11", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: filled ? /* @__PURE__ */ jsxs5(Fragment, { children: [
    /* @__PURE__ */ jsx6("path", { d: "M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z", fill: "currentColor" }),
    /* @__PURE__ */ jsx6("line", { x1: "5", y1: "11", x2: "2", y2: "14", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
  ] }) : /* @__PURE__ */ jsxs5(Fragment, { children: [
    /* @__PURE__ */ jsx6("path", { d: "M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }),
    /* @__PURE__ */ jsx6("line", { x1: "5", y1: "11", x2: "2", y2: "14", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
  ] }) });
}
function CardDownloadIcon() {
  return /* @__PURE__ */ jsxs5("svg", { width: "11", height: "11", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx6("path", { d: "M7 2v7M4 6l3 3 3-3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ jsx6("path", { d: "M2 11h10", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
  ] });
}
function CardDownloadButton({ sessionId }) {
  return /* @__PURE__ */ jsx6(
    "button",
    {
      className: "card-pin-btn",
      onClick: (e) => {
        e.stopPropagation();
        void downloadLogFile(sessionId);
      },
      title: "Download session log",
      "aria-label": "Download session log",
      children: /* @__PURE__ */ jsx6(CardDownloadIcon, {})
    }
  );
}
function CardDownloadButtonLabeled({ sessionId }) {
  return /* @__PURE__ */ jsxs5(
    "button",
    {
      className: "card-extended-action-btn",
      onClick: (e) => {
        e.stopPropagation();
        void downloadLogFile(sessionId);
      },
      title: "Download session log",
      "aria-label": "Download session log",
      children: [
        /* @__PURE__ */ jsx6(CardDownloadIcon, {}),
        /* @__PURE__ */ jsx6("span", { children: "Download Log" })
      ]
    }
  );
}

// src/ui/components/NamespaceTree.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function initialsOf(label) {
  return label.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
function tasksOf(summaryJobs) {
  if (!summaryJobs) return [];
  return summaryJobs.filter((job) => job.status !== "purged").map(parseJob).sort(sortJobs);
}
function NamespaceTree({
  namespace,
  namespaces,
  summaries,
  onNamespaceChange,
  onSelectTask,
  activeSessionId,
  displayMode,
  onAvatarClick,
  onTogglePinSession,
  pinnedSessionIds,
  onCancelJob,
  terminatingSessionIds
}) {
  const isCompact = displayMode === "compact";
  const [expandedNs, setExpandedNs] = useState10(() => /* @__PURE__ */ new Set([namespace]));
  const [compactOpen, setCompactOpen] = useState10(false);
  const toggleExpanded = (nsId) => {
    setExpandedNs((prev) => {
      const next = new Set(prev);
      if (next.has(nsId)) next.delete(nsId);
      else next.add(nsId);
      return next;
    });
  };
  if (isCompact) {
    const active = namespaces.find((n) => n.id === namespace);
    const activeSummary = summaries[namespace];
    return /* @__PURE__ */ jsxs6("div", { className: "ns-tree ns-tree--compact", children: [
      /* @__PURE__ */ jsxs6(
        "button",
        {
          type: "button",
          className: "ns-tree__chip",
          onClick: () => setCompactOpen((v) => !v),
          "aria-expanded": compactOpen,
          title: active ? `${active.label}${activeSummary ? ` \u2014 ${summaryLine(activeSummary)}` : ""}` : namespace,
          children: [
            active ? initialsOf(active.label) : "NS",
            activeSummary ? /* @__PURE__ */ jsx7("span", { className: "ns-tree__chip-count", children: activeSummary.total }) : null
          ]
        }
      ),
      compactOpen && /* @__PURE__ */ jsx7("ul", { className: "ns-tree__list", role: "tree", "aria-label": "All namespaces", children: namespaces.map((ns) => {
        const summary = summaries[ns.id];
        return /* @__PURE__ */ jsx7(
          "li",
          {
            role: "treeitem",
            "aria-selected": ns.id === namespace,
            "data-namespace": ns.id,
            className: ns.id === namespace ? "ns-tree__item ns-tree__item--active" : "ns-tree__item",
            children: /* @__PURE__ */ jsxs6(
              "button",
              {
                type: "button",
                className: "ns-tree__row",
                title: ns.label,
                onClick: () => {
                  onNamespaceChange(ns.id);
                  setCompactOpen(false);
                },
                children: [
                  /* @__PURE__ */ jsx7(
                    TreeIcon,
                    {
                      src: namespaceIcon(ns.id),
                      fallback: NAMESPACE_ICON_FALLBACK,
                      size: "task"
                    }
                  ),
                  /* @__PURE__ */ jsx7("span", { className: "ns-tree__compact-initials", children: initialsOf(ns.label) }),
                  /* @__PURE__ */ jsx7("span", { className: "ns-tree__compact-count", children: summary?.total ?? "\u2026" })
                ]
              }
            )
          },
          ns.id
        );
      }) })
    ] });
  }
  const rootClass = displayMode === "extended" ? "ns-tree ns-tree--extended" : "ns-tree";
  return /* @__PURE__ */ jsx7("div", { className: rootClass, role: "tree", "aria-label": "Namespace tree", children: /* @__PURE__ */ jsx7("ul", { className: "ns-tree__roots", children: namespaces.map((ns) => {
    const summary = summaries[ns.id];
    const isActive = ns.id === namespace;
    const nsExpanded = expandedNs.has(ns.id);
    const line = summary ? summary.error ? "summary unavailable" : summaryLine(summary) : "\u2026";
    const tasks = nsExpanded ? tasksOf(summary?.jobs) : [];
    return /* @__PURE__ */ jsxs6(
      "li",
      {
        role: "treeitem",
        "aria-expanded": nsExpanded,
        "aria-selected": isActive,
        "data-namespace": ns.id,
        className: isActive ? "ns-tree__item ns-tree__item--active" : "ns-tree__item",
        children: [
          /* @__PURE__ */ jsxs6("div", { className: "ns-tree__row", children: [
            /* @__PURE__ */ jsx7(
              "button",
              {
                type: "button",
                className: "ns-tree__chevron-btn",
                "aria-label": nsExpanded ? `Collapse ${ns.label} tasks` : `Expand ${ns.label} tasks`,
                onClick: () => toggleExpanded(ns.id),
                tabIndex: -1,
                children: /* @__PURE__ */ jsx7(
                  "span",
                  {
                    className: nsExpanded ? "ns-tree__chevron ns-tree__chevron--open" : "ns-tree__chevron",
                    "aria-hidden": "true",
                    children: nsExpanded ? "\u25BE" : "\u25B8"
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxs6(
              "button",
              {
                type: "button",
                className: "ns-tree__select",
                title: `${ns.label} \u2014 ${line}`,
                onClick: () => {
                  onNamespaceChange(ns.id);
                  setExpandedNs((prev) => new Set(prev).add(ns.id));
                },
                children: [
                  /* @__PURE__ */ jsx7(TreeIcon, { src: namespaceIcon(ns.id), fallback: NAMESPACE_ICON_FALLBACK }),
                  /* @__PURE__ */ jsxs6("span", { className: "ns-tree__labels", children: [
                    /* @__PURE__ */ jsx7("span", { className: "ns-tree__label", children: ns.label }),
                    /* @__PURE__ */ jsx7("span", { className: summary?.error ? "ns-tree__summary ns-tree__summary--error" : "ns-tree__summary", children: line })
                  ] })
                ]
              }
            )
          ] }),
          nsExpanded && /* @__PURE__ */ jsx7("ul", { className: "ns-tree__tasks", role: "group", "aria-label": `${ns.label} tasks`, children: summary && !summary.error ? tasks.length > 0 ? tasks.map((job) => {
            const isTaskActive = job.sessionId === activeSessionId;
            return /* @__PURE__ */ jsx7(
              "li",
              {
                role: "treeitem",
                "aria-selected": isTaskActive,
                "data-session": job.sessionId,
                className: isTaskActive ? "ns-tree__task ns-tree__task--active" : "ns-tree__task",
                children: /* @__PURE__ */ jsx7(
                  JobCard,
                  {
                    job,
                    isActive: isTaskActive,
                    onClick: () => onSelectTask(ns.id, job.sessionId),
                    onAvatarClick,
                    isPinned: pinnedSessionIds?.has(job.sessionId) ?? false,
                    onTogglePin: onTogglePinSession ? () => onTogglePinSession(job.sessionId) : void 0,
                    onCancelJob,
                    displayMode,
                    isTerminating: terminatingSessionIds?.has(job.sessionId) ?? false
                  }
                )
              },
              job.sessionId
            );
          }) : /* @__PURE__ */ jsx7("li", { className: "ns-tree__task ns-tree__task--empty", children: "no tasks in this world" }) : /* @__PURE__ */ jsx7("li", { className: "ns-tree__task ns-tree__task--empty", children: summary ? "summary unavailable" : "loading\u2026" }) })
        ]
      },
      ns.id
    );
  }) }) });
}

// src/ui/components/Sidebar.tsx
import { Fragment as Fragment2, jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var DEFAULT_WIDTH = 300;
function getDisplayMode(width) {
  if (width < 240) return "compact";
  if (width <= 400) return "normal";
  return "extended";
}
function Sidebar({ jobs, activeSessionId, quote, wsState, onSelectSession, onAvatarClick, onOdinClick, onTogglePinSession, pinnedSessionIds, onCancelJob, terminatingSessionIds, namespace, namespaces, onNamespaceChange, namespaceSummaries, onSelectTask }) {
  const { theme, setTheme: setTheme2 } = useTheme();
  const [width, setWidth] = useState11(DEFAULT_WIDTH);
  const navRef = useRef6(null);
  useEffect7(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);
  const displayMode = getDisplayMode(width);
  const isCompact = displayMode === "compact";
  return /* @__PURE__ */ jsx8(
    "nav",
    {
      ref: navRef,
      className: "sidebar",
      "aria-label": "Agent sessions",
      style: { width: "100%", height: "100%" },
      children: /* @__PURE__ */ jsxs7("div", { className: "sidebar-header", children: [
        /* @__PURE__ */ jsxs7("div", { className: "brand", children: [
          /* @__PURE__ */ jsx8(
            "button",
            {
              className: "odin-avatar-btn",
              onClick: onOdinClick,
              "aria-label": "View Odin profile",
              title: "View Odin profile",
              children: /* @__PURE__ */ jsx8(
                "img",
                {
                  src: avatarUrl("odin", theme === "light" ? "light" : "dark") ?? "",
                  alt: "Odin"
                }
              )
            }
          ),
          !isCompact && /* @__PURE__ */ jsx8("h1", { children: "Hlidskjalf" }),
          !isCompact && /* @__PURE__ */ jsx8("span", { className: "brand-wss-badge", children: /* @__PURE__ */ jsx8(StatusBadge, { state: wsState }) })
        ] }),
        !isCompact && /* @__PURE__ */ jsxs7(Fragment2, { children: [
          /* @__PURE__ */ jsxs7("div", { className: "quote", role: "note", children: [
            "\u201C",
            quote,
            "\u201D"
          ] }),
          /* @__PURE__ */ jsxs7("div", { className: "count-row", children: [
            /* @__PURE__ */ jsxs7("div", { className: "count", "aria-live": "polite", children: [
              jobs.length,
              " session",
              jobs.length !== 1 ? "s" : ""
            ] }),
            /* @__PURE__ */ jsx8(ThemeSwitcher, { theme, setTheme: setTheme2 })
          ] })
        ] }),
        /* @__PURE__ */ jsx8(
          NamespaceTree,
          {
            namespace,
            namespaces,
            summaries: namespaceSummaries,
            onNamespaceChange,
            onSelectTask,
            activeSessionId,
            displayMode,
            onAvatarClick,
            onTogglePinSession,
            pinnedSessionIds,
            onCancelJob,
            terminatingSessionIds
          }
        )
      ] })
    }
  );
}

// src/ui/components/LogViewer.tsx
import { useEffect as useEffect8, useRef as useRef7, useState as useState14, useCallback as useCallback8, useMemo as useMemo2 } from "react";

// src/ui/components/ToolBlock.tsx
import { useState as useState12 } from "react";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function ToolBlock({ entry, collapseCount }) {
  const [open, setOpen] = useState12(false);
  const cls = toolBadgeClass(entry.toolName || "");
  let parsedInput;
  try {
    parsedInput = entry.toolInput ? JSON.parse(entry.toolInput) : void 0;
  } catch {
  }
  const preview = entry.toolName ? toolPreview(entry.toolName, parsedInput) : "";
  return /* @__PURE__ */ jsxs8("div", { className: `ev-tool${open ? " open" : ""}${entry.toolIsError ? " ev-tool-error" : ""}`, children: [
    /* @__PURE__ */ jsxs8("div", { className: "ev-tool-header", onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsx9("span", { className: `ev-tool-badge ${cls}`, children: entry.toolName }),
      collapseCount != null && collapseCount > 1 && /* @__PURE__ */ jsxs8("span", { className: "ev-collapse-count", title: `${collapseCount} consecutive identical calls collapsed`, children: [
        "\xD7",
        collapseCount
      ] }),
      /* @__PURE__ */ jsx9("span", { className: "ev-tool-preview", children: preview }),
      /* @__PURE__ */ jsx9("span", { className: "ev-tool-chevron", children: "\u203A" })
    ] }),
    /* @__PURE__ */ jsx9("div", { className: "ev-tool-body-wrap", children: /* @__PURE__ */ jsxs8("div", { className: "ev-tool-body", children: [
      /* @__PURE__ */ jsx9("div", { className: "ev-tool-input", children: entry.toolInput }),
      entry.toolResult != null && /* @__PURE__ */ jsx9("div", { className: "ev-tool-result", children: entry.toolResult })
    ] }) })
  ] });
}

// src/ui/components/NorseErrorTablet.tsx
import { Fragment as Fragment3, jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
var RUNE_ROW_TOP = "\u16A0 \u16A2 \u16A6 \u16A8 \u16B1 \u16B2 \u16B7 \u16B9 \u16BA \u16BE \u16C1 \u16C3 \u16C7 \u16C8 \u16C9 \u16CA \u16CF \u16D2 \u16D6 \u16D7 \u16DA \u16DC \u16DE \u16DF";
var RUNE_ROW_BTM = "\u16DF \u16DE \u16DC \u16DA \u16D7 \u16D6 \u16D2 \u16CF \u16CA \u16C9 \u16C8 \u16C7 \u16C3 \u16C1 \u16BE \u16BA \u16B9 \u16B7 \u16B2 \u16B1 \u16A8 \u16A6 \u16A2 \u16A0";
var RUNE_GLYPH = "\u16A6";
var VARIANT_CONTENT = {
  "ttl-expired": {
    ariaLabel: "Session error: pod TTL expired",
    heading: "The Eternal Halls Are Sealed",
    subheading: /* @__PURE__ */ jsxs9(Fragment3, { children: [
      "This vessel has departed",
      " ",
      /* @__PURE__ */ jsx10(
        "a",
        {
          className: "wiki-link",
          href: WIKI_LINKS["Yggdrasil"],
          target: "_blank",
          rel: "noopener noreferrer",
          "aria-label": "Yggdrasil on Wikipedia, opens in new tab",
          children: "Yggdrasil"
        }
      )
    ] })
  },
  "node-unreachable": {
    ariaLabel: "Session error: node unreachable",
    heading: "The Bifr\xF6st Has Fallen",
    subheading: /* @__PURE__ */ jsxs9(Fragment3, { children: [
      "The node that bore this vessel is beyond reach \u2014 the",
      " ",
      /* @__PURE__ */ jsx10(
        "a",
        {
          className: "wiki-link",
          href: WIKI_LINKS["Bifr\xF6st"],
          target: "_blank",
          rel: "noopener noreferrer",
          "aria-label": "Bifr\xF6st on Wikipedia, opens in new tab",
          children: "Bifr\xF6st"
        }
      ),
      " ",
      "bridge is severed"
    ] })
  }
};
function NorseErrorTablet({ sessionId, message, variant = "ttl-expired" }) {
  const { ariaLabel, heading, subheading } = VARIANT_CONTENT[variant];
  const seal = ERROR_TABLET_SEALS[variant];
  return /* @__PURE__ */ jsxs9(
    "div",
    {
      className: "norse-error-tablet",
      role: "alert",
      "aria-label": ariaLabel,
      "aria-live": "assertive",
      children: [
        /* @__PURE__ */ jsx10("div", { className: "net-rune-border", "aria-hidden": "true", children: RUNE_ROW_TOP }),
        /* @__PURE__ */ jsx10("div", { className: "net-glyph", "aria-hidden": "true", children: RUNE_GLYPH }),
        /* @__PURE__ */ jsx10("h1", { className: "net-heading", children: heading }),
        /* @__PURE__ */ jsx10("p", { className: "net-subheading", children: subheading }),
        /* @__PURE__ */ jsx10("div", { className: "net-divider", "aria-hidden": "true", children: "\u16A0 \u16A2 \u16A6 \u16DF \u16DE \u16DC \u16DA \u16DF \u16A6 \u16A2 \u16A0" }),
        /* @__PURE__ */ jsx10("p", { className: "net-body", children: message }),
        /* @__PURE__ */ jsxs9("div", { className: "net-session", "aria-label": `Session ID: ${sessionId}`, children: [
          /* @__PURE__ */ jsx10("span", { className: "net-session-label", children: "Session" }),
          /* @__PURE__ */ jsx10("span", { className: "net-session-value", children: sessionId })
        ] }),
        /* @__PURE__ */ jsxs9("div", { className: "net-seal-epic", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsx10("div", { className: "net-seal-rune-row", children: seal.runes }),
          /* @__PURE__ */ jsx10("div", { className: "net-seal-inscription", children: seal.inscription }),
          /* @__PURE__ */ jsx10("div", { className: "net-seal-sub", children: seal.sub })
        ] }),
        /* @__PURE__ */ jsx10("div", { className: "net-rune-border", "aria-hidden": "true", children: RUNE_ROW_BTM })
      ]
    }
  );
}

// src/ui/components/NorseVerdictInscription.tsx
import { jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
var RUNE_ROW_TOP2 = "\u16A0 \u16A2 \u16A6 \u16A8 \u16B1 \u16B2 \u16B7 \u16B9 \u16BA \u16BE \u16C1 \u16C3 \u16C7 \u16C8 \u16C9 \u16CA \u16CF \u16D2 \u16D6 \u16D7 \u16DA \u16DC \u16DE \u16DF";
var RUNE_ROW_BTM2 = "\u16DF \u16DE \u16DC \u16DA \u16D7 \u16D6 \u16D2 \u16CF \u16CA \u16C9 \u16C8 \u16C7 \u16C3 \u16C1 \u16BE \u16BA \u16B9 \u16B7 \u16B2 \u16B1 \u16A8 \u16A6 \u16A2 \u16A0";
var AGENT_VERDICT_CONFIG = {
  "fireman-decko": {
    rune: "\u16B2",
    runeName: "Kenaz",
    runeMeaning: "The Forge",
    accentToken: "var(--agent-accent-fireman)",
    archTitle: "The Forge Has Spoken",
    roleLabel: "Principal Engineer",
    pledge: "The forge cools. What was broken is reforged. I lay this work before the All-Father\u2019s throne upon Hli\xF0skj\xE1lf.",
    pledgeLinks: {
      "Hli\xF0skj\xE1lf": "https://en.wikipedia.org/wiki/Hli%C3%B0skj%C3%A1lf"
    }
  },
  loki: {
    rune: "\u16BE",
    runeName: "Naudhiz",
    runeMeaning: "Need / Trickery",
    accentToken: "var(--agent-accent-loki)",
    archTitle: "The Trickster Finds No Flaw",
    roleLabel: "QA Tester",
    pledge: "Every thread tested, every seam inspected. The Trickster finds no flaw worthy of Ragnar\xF6k. I present this verdict to Odin, Lord of Asgard.",
    pledgeLinks: {
      "Ragnar\xF6k": "https://en.wikipedia.org/wiki/Ragnar%C3%B6k",
      Asgard: "https://en.wikipedia.org/wiki/Asgard"
    }
  },
  luna: {
    rune: "\u16DA",
    runeName: "Laguz",
    runeMeaning: "Water / Moon",
    accentToken: "var(--agent-accent-luna)",
    archTitle: "The Moonpath Is Drawn",
    roleLabel: "UX Designer",
    pledge: "By moonlight I have drawn the path through the branches of Yggdrasil. These wireframes carry the vision of Freyja\u2019s hall. Odin, receive this design.",
    pledgeLinks: {
      Yggdrasil: "https://en.wikipedia.org/wiki/Yggdrasil",
      Freyja: "https://en.wikipedia.org/wiki/Freyja"
    }
  },
  heimdall: {
    rune: "\u16CF",
    runeName: "Tiwaz",
    runeMeaning: "Justice / Watchman",
    accentToken: "var(--agent-accent-heimdall)",
    archTitle: "The Bifr\xF6st Stands Unwavering",
    roleLabel: "Security Specialist",
    pledge: "From the Bifr\xF6st I have watched. No shadow passes unchallenged. This audit is sworn before Odin\u2019s one remaining eye.",
    pledgeLinks: {
      "Bifr\xF6st": "https://en.wikipedia.org/wiki/Bifr%C3%B6st"
    }
  },
  freya: {
    rune: "\u16A0",
    runeName: "Fehu",
    runeMeaning: "Abundance / Wisdom",
    accentToken: "var(--agent-accent-freya)",
    archTitle: "The V\xF6lva Has Spoken",
    roleLabel: "Product Owner",
    pledge: "The V\xF6lva has spoken. What was foretold is now revealed. I deliver this wisdom to the throne of Valhalla.",
    pledgeLinks: {
      "V\xF6lva": "https://en.wikipedia.org/wiki/V%C3%B6lva",
      Valhalla: "https://en.wikipedia.org/wiki/Valhalla"
    }
  },
  generic: {
    rune: "\u16DF",
    runeName: "Othalan",
    runeMeaning: "Heritage / Estate",
    accentToken: "var(--gold)",
    archTitle: "The Inscription Is Complete",
    roleLabel: "Agent",
    pledge: "What was tasked is now complete. This work is laid before the All-Father. Let the runes bear witness.",
    pledgeLinks: {}
  }
};
var VERDICT_HEADING_RE = /^#{1,2}\s+[^\n]*(Handoff|QA Verdict)/m;
var AGENT_NAME_RE = /(FiremanDecko|Loki|Luna|Heimdall|Freya)/i;
function isVerdictMessage(text) {
  return VERDICT_HEADING_RE.test(text);
}
function normaliseAgentKey(raw) {
  const k = raw.toLowerCase().replace(/[-_\s]/g, "");
  if (k === "firemandecko" || k === "fireman") return "fireman-decko";
  if (k === "loki") return "loki";
  if (k === "luna") return "luna";
  if (k === "heimdall") return "heimdall";
  if (k === "freya") return "freya";
  return "generic";
}
function detectAgent(sessionAgentKey, headingText) {
  if (sessionAgentKey) return normaliseAgentKey(sessionAgentKey);
  const match = AGENT_NAME_RE.exec(headingText);
  if (match?.[1]) return normaliseAgentKey(match[1]);
  return "generic";
}
function detectVerdictType(headingText) {
  return headingText.toLowerCase().includes("qa verdict") ? "qa-verdict" : "handoff";
}
function extractHeadingText(text) {
  const match = VERDICT_HEADING_RE.exec(text);
  if (!match) return "";
  const lineStart = text.lastIndexOf("\n", match.index) + 1;
  const lineEnd = text.indexOf("\n", match.index);
  return text.slice(lineStart, lineEnd === -1 ? void 0 : lineEnd).replace(/^#+\s*/, "");
}
function renderPledgeWithLinks(pledge, links) {
  if (Object.keys(links).length === 0) return pledge;
  const terms = Object.keys(links).sort((a, b) => b.length - a.length);
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = pledge.split(regex);
  return parts.map(
    (part, i) => links[part] ? /* @__PURE__ */ jsx11(
      "a",
      {
        href: links[part],
        target: "_blank",
        rel: "noopener noreferrer",
        className: "nvi-norse-link",
        "aria-label": `${part} (opens Wikipedia in new tab)`,
        children: part
      },
      i
    ) : part
  );
}
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return /* @__PURE__ */ jsx11("strong", { children: part.slice(2, -2) }, i);
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return /* @__PURE__ */ jsx11("code", { className: "nvi-md-inline-code", children: part.slice(1, -1) }, i);
    }
    return part;
  });
}
function renderMarkdown(text) {
  const lines = text.split("\n");
  const nodes = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      nodes.push(
        /* @__PURE__ */ jsx11("pre", { className: "nvi-md-code", children: /* @__PURE__ */ jsx11("code", { children: codeLines.join("\n") }) }, `code-${i}`)
      );
      i++;
      continue;
    }
    if (/^# /.test(line)) {
      nodes.push(
        /* @__PURE__ */ jsx11("h1", { className: "nvi-md-h1", children: renderInline(line.slice(2)) }, `h1-${i}`)
      );
      i++;
      continue;
    }
    if (/^## /.test(line)) {
      nodes.push(
        /* @__PURE__ */ jsx11("h2", { className: "nvi-md-h2", children: renderInline(line.slice(3)) }, `h2-${i}`)
      );
      i++;
      continue;
    }
    if (/^### /.test(line)) {
      nodes.push(
        /* @__PURE__ */ jsx11("h3", { className: "nvi-md-h3", children: renderInline(line.slice(4)) }, `h3-${i}`)
      );
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      nodes.push(/* @__PURE__ */ jsx11("hr", { className: "nvi-md-hr", "aria-hidden": "true" }, `hr-${i}`));
      i++;
      continue;
    }
    if (/^- \[[ xX]\] /.test(line)) {
      const items = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(lines[i] ?? "")) {
        const l = lines[i] ?? "";
        const checked = /^- \[[xX]\] /.test(l);
        items.push({ checked, text: l.replace(/^- \[[ xX]\] /, "") });
        i++;
      }
      nodes.push(
        /* @__PURE__ */ jsx11("ul", { className: "nvi-md-ul nvi-md-checklist", children: items.map(({ checked, text: text2 }, j) => /* @__PURE__ */ jsx11("li", { className: checked ? "nvi-md-checked" : "nvi-md-unchecked", children: renderInline(text2) }, j)) }, `check-${i}`)
      );
      continue;
    }
    if (/^[-*+] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+] /.test(lines[i] ?? "") && !/^- \[[ xX]\] /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*+] /, ""));
        i++;
      }
      nodes.push(
        /* @__PURE__ */ jsx11("ul", { className: "nvi-md-ul", children: items.map((item, j) => /* @__PURE__ */ jsx11("li", { children: renderInline(item) }, j)) }, `ul-${i}`)
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\. /, ""));
        i++;
      }
      nodes.push(
        /* @__PURE__ */ jsx11("ol", { className: "nvi-md-ol", children: items.map((item, j) => /* @__PURE__ */ jsx11("li", { children: renderInline(item) }, j)) }, `ol-${i}`)
      );
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const paraLines = [];
    while (i < lines.length && (lines[i] ?? "").trim() && !/^#{1,3} /.test(lines[i] ?? "") && !(lines[i] ?? "").startsWith("```") && !/^[-*+] /.test(lines[i] ?? "") && !/^\d+\. /.test(lines[i] ?? "") && !/^---+$/.test((lines[i] ?? "").trim())) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(
        /* @__PURE__ */ jsx11("p", { className: "nvi-md-p", children: renderInline(paraLines.join(" ")) }, `p-${i}`)
      );
    }
  }
  return nodes;
}
function NorseVerdictInscription({ text, agentKey, agentName }) {
  const headingText = extractHeadingText(text);
  const resolvedAgentKey = detectAgent(agentKey ?? agentName, headingText);
  const verdictType = detectVerdictType(headingText);
  const config = AGENT_VERDICT_CONFIG[resolvedAgentKey];
  const subtitle = verdictType === "qa-verdict" ? `${config.roleLabel} \u2014 QA Verdict Delivered` : `${config.roleLabel} \u2014 Handoff Complete`;
  const bodyNodes = renderMarkdown(text);
  return /* @__PURE__ */ jsxs10(
    "article",
    {
      className: "nvi-shell",
      role: "article",
      "aria-label": `Agent verdict: ${headingText}`,
      style: { "--agent-accent": config.accentToken },
      children: [
        /* @__PURE__ */ jsxs10("div", { className: "nvi-rune-band-top", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsx11("div", { className: "nvi-rune-row", children: RUNE_ROW_TOP2 }),
          /* @__PURE__ */ jsx11("div", { className: "nvi-rune-row", children: RUNE_ROW_BTM2 })
        ] }),
        /* @__PURE__ */ jsxs10("div", { className: "nvi-agent-header", children: [
          /* @__PURE__ */ jsx11(
            "div",
            {
              className: "nvi-glyph",
              role: "img",
              "aria-label": `${config.runeName} rune \u2014 ${config.runeMeaning}`,
              children: config.rune
            }
          ),
          /* @__PURE__ */ jsxs10("div", { className: "nvi-agent-identity", children: [
            /* @__PURE__ */ jsx11("span", { className: "nvi-agent-name", children: config.runeName }),
            /* @__PURE__ */ jsx11("span", { className: "nvi-arch-title", children: config.archTitle }),
            /* @__PURE__ */ jsx11("span", { className: "nvi-arch-subtitle", children: subtitle })
          ] })
        ] }),
        /* @__PURE__ */ jsx11("div", { className: "nvi-divider", "aria-hidden": "true", children: "\u16A0 \u16A2 \u16A6 \u16DF \u16DE \u16DC \u16DA \u16DF \u16A6 \u16A2 \u16A0" }),
        /* @__PURE__ */ jsx11("div", { className: "nvi-body", children: bodyNodes }),
        /* @__PURE__ */ jsxs10("div", { className: "nvi-seal", children: [
          /* @__PURE__ */ jsxs10("p", { className: "nvi-seal-pledge", "aria-label": "Agent pledge", children: [
            "\u201C",
            renderPledgeWithLinks(config.pledge, config.pledgeLinks),
            "\u201D"
          ] }),
          /* @__PURE__ */ jsxs10("p", { className: "nvi-seal-futhark", "aria-hidden": "true", children: [
            "\u16A0\u16A2\u16A6 \u2014 ",
            config.runeMeaning,
            " \u2014 \u16A6\u16A2\u16A0"
          ] })
        ] }),
        /* @__PURE__ */ jsxs10("div", { className: "nvi-rune-band-bottom", "aria-hidden": "true", children: [
          /* @__PURE__ */ jsx11("div", { className: "nvi-rune-row", children: RUNE_ROW_BTM2 }),
          /* @__PURE__ */ jsx11("div", { className: "nvi-rune-row", children: RUNE_ROW_TOP2 })
        ] })
      ]
    }
  );
}

// src/ui/components/DecreeBlock.tsx
import { useState as useState13 } from "react";
import { Fragment as Fragment4, jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
var DECREE_START_RE = /᛭᛭᛭\s*DECREE COMPLETE\s*᛭᛭᛭/;
var DECREE_END_RE = /᛭᛭᛭\s*END DECREE\s*᛭᛭᛭/;
function isDecreeBlock(text) {
  if (DECREE_START_RE.test(text) && DECREE_END_RE.test(text)) return true;
  if (/╔/.test(text) && /DECREE/i.test(text)) return true;
  if (/(Decree|DECREE)/i.test(text) && /(VERDICT|Verdict|ISSUE|Issue)/i.test(text)) return true;
  return false;
}
function stripEmoji(s) {
  return s.replace(/[❌✅🔴🟢⚠️🚫✔️❎]/g, "").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();
}
function normaliseVerdict(raw) {
  const cleaned = stripEmoji(raw).toUpperCase().trim();
  if (cleaned === "COMPLETE" || cleaned === "SUCCESS") return "DONE";
  return cleaned;
}
function extractAgentFromBoxTitle(text) {
  const m = text.match(/(?:FIREMAN\s*DECKO|FIREMANDECKO)/i);
  if (m) return "firemandecko";
  if (/\bLOKI\b/i.test(text)) return "loki";
  if (/\bLUNA\b/i.test(text)) return "luna";
  if (/\bHEIMDALL\b/i.test(text)) return "heimdall";
  if (/\bFREYA\b/i.test(text)) return "freya";
  return "";
}
function parseCheckLines(text) {
  const checks = [];
  const checkRe = /\b(tsc|build|vitest|playwright|owasp|requireauth|secrets|wireframes|interactions|accessibility|product-brief|acceptance-criteria|backlog)\b[:\s]+([^\n║╝╚╣]+)/gi;
  let m;
  while ((m = checkRe.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    let rawVal = m[2].trim();
    rawVal = rawVal.replace(/[║╝╚╣═╗╔╠╬╩╦╟─│┌┐└┘├┤┬┴┼]+/g, "").trim();
    rawVal = rawVal.replace(/✅/g, "PASS").replace(/❌/g, "FAIL").trim();
    if (rawVal) checks.push({ name, value: rawVal });
  }
  return checks;
}
function parseBoxDrawingDecree(text) {
  if (!/╔/.test(text) || !/DECREE/i.test(text)) return null;
  let issue = "";
  let verdict = "";
  let pr = null;
  const summary = [];
  const seal = "";
  const signoff = "";
  const issueM = text.match(/Issue:?\s*#?(\d+)/i);
  if (issueM) issue = `#${issueM[1]}`;
  const verdictM = text.match(/Verdict:?\s*([\w❌✅🔴🟢 ]+)/i);
  if (verdictM) verdict = normaliseVerdict(verdictM[1] ?? "");
  const prM = text.match(/PR:?\s*(https:\/\/\S+|#\d+)/i);
  if (prM) pr = prM[1] ?? null;
  const agentKey = extractAgentFromBoxTitle(text);
  const checks = parseCheckLines(text);
  if (!issue && !verdict) return null;
  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey, format: "box-drawing" };
}
function parseFreeformDecree(text) {
  if (!/(Decree|DECREE)/i.test(text)) return null;
  if (!/(VERDICT|Verdict|ISSUE|Issue)/i.test(text)) return null;
  let issue = "";
  let verdict = "";
  let pr = null;
  const summary = [];
  const seal = "";
  const signoff = "";
  const issueM = text.match(/(?:ISSUE|Issue):?\s*#?(\d+)/i);
  if (issueM) issue = `#${issueM[1]}`;
  const verdictM = text.match(/(?:VERDICT|Verdict|STATUS|Status):?\s*\*{0,2}([\w❌✅🔴🟢 ]+)\*{0,2}/i);
  if (verdictM) verdict = normaliseVerdict(verdictM[1] ?? "");
  const prM = text.match(/PR:?\s*(https:\/\/\S+|#\d+)/i);
  if (prM) pr = prM[1] ?? null;
  const agentKey = extractAgentFromBoxTitle(text);
  const checks = parseCheckLines(text);
  if (!issue && !verdict) return null;
  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey, format: "freeform" };
}
function parseCanonicalDecree(text) {
  const startMatch = DECREE_START_RE.exec(text);
  const endMatch = DECREE_END_RE.exec(text);
  if (!startMatch || !endMatch) return null;
  const content = text.slice(startMatch.index + startMatch[0].length, endMatch.index).trim();
  const normalized = content.replace(/([^\n])(?=(?:ISSUE|VERDICT|PR|SUMMARY|CHECKS|SEAL|SIGNOFF):)/g, "$1\n").replace(/^(SUMMARY:|CHECKS:)(?=- )/gm, "$1\n");
  const lines = normalized.split("\n");
  let issue = "";
  let verdict = "";
  let pr = null;
  const summary = [];
  const checks = [];
  let seal = "";
  let signoff = "";
  let inSection = "none";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("ISSUE:")) {
      issue = trimmed.replace(/^ISSUE:\s*/, "").trim();
      inSection = "none";
    } else if (trimmed.startsWith("VERDICT:")) {
      verdict = trimmed.replace(/^VERDICT:\s*/, "").trim();
      inSection = "none";
    } else if (trimmed.startsWith("PR:")) {
      const raw = trimmed.replace(/^PR:\s*/, "").trim();
      pr = raw === "N/A" || raw === "n/a" ? null : raw;
      inSection = "none";
    } else if (trimmed === "SUMMARY:") {
      inSection = "summary";
    } else if (trimmed === "CHECKS:") {
      inSection = "checks";
    } else if (trimmed.startsWith("SEAL:")) {
      seal = trimmed.replace(/^SEAL:\s*/, "").trim();
      inSection = "none";
    } else if (trimmed.startsWith("SIGNOFF:")) {
      signoff = trimmed.replace(/^SIGNOFF:\s*/, "").trim();
      inSection = "none";
    } else if (inSection === "summary" && trimmed.startsWith("-")) {
      summary.push(trimmed.replace(/^-\s*/, ""));
    } else if (inSection === "checks" && trimmed.startsWith("-")) {
      const checkLine = trimmed.replace(/^-\s*/, "");
      const colon = checkLine.indexOf(":");
      if (colon !== -1) {
        checks.push({ name: checkLine.slice(0, colon).trim(), value: checkLine.slice(colon + 1).trim() });
      } else {
        checks.push({ name: checkLine, value: "" });
      }
    }
  }
  const agentNameMatch = /^(\w+)/.exec(seal);
  const agentKey = agentNameMatch?.[1]?.toLowerCase() ?? "";
  return { issue, verdict, pr, summary, checks, seal, signoff, agentKey, format: "canonical" };
}
function parseDecree(text) {
  const canonical = parseCanonicalDecree(text);
  if (canonical) return canonical;
  const boxDrawing = parseBoxDrawingDecree(text);
  if (boxDrawing) return boxDrawing;
  const freeform = parseFreeformDecree(text);
  if (freeform) return freeform;
  return { issue: "", verdict: "", pr: null, summary: [], checks: [], seal: "", signoff: "", agentKey: "", format: "freeform" };
}
var keyframes = `
@keyframes decree-gold-glow {
  0%, 100% { box-shadow: 0 0 8px 0 rgba(201,146,10,0.30), 0 0 24px 0 rgba(201,146,10,0.12); }
  50%       { box-shadow: 0 0 16px 2px rgba(240,180,41,0.50), 0 0 40px 4px rgba(240,180,41,0.18); }
}
@keyframes decree-red-glow {
  0%, 100% { box-shadow: 0 0 8px 0 rgba(239,68,68,0.30), 0 0 24px 0 rgba(239,68,68,0.12); }
  50%       { box-shadow: 0 0 16px 2px rgba(239,68,68,0.55), 0 0 40px 4px rgba(239,68,68,0.20); }
}
@keyframes decree-shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-4px); }
  30%       { transform: translateX(4px); }
  45%       { transform: translateX(-3px); }
  60%       { transform: translateX(3px); }
  75%       { transform: translateX(-2px); }
  90%       { transform: translateX(2px); }
}
`;
function DecreeBlock({ text, agentKey: jobAgentKey, onAvatarClick }) {
  const { theme } = useTheme();
  const decree = parseDecree(text);
  const agentKey = decree.agentKey || jobAgentKey || "";
  const agentName = AGENT_NAMES[agentKey] ?? decree.agentKey ?? "Agent";
  const agentTitle = AGENT_TITLES[agentKey] ?? "";
  const agentRunes = AGENT_RUNE_NAMES[agentKey] ?? "";
  const agentColor = AGENT_COLORS[agentKey] ?? "#c9920a";
  const avatar = avatarUrl(agentKey, theme === "light" ? "light" : "dark");
  const [summaryOpen, setSummaryOpen] = useState13(true);
  const [checksOpen, setChecksOpen] = useState13(true);
  const isPass = /^(PASS|DONE|DELIVERED|APPROVED|SECURED)$/i.test(decree.verdict);
  const isFail = /^FAIL$/i.test(decree.verdict);
  const verdictColor = isFail ? "var(--error-strong)" : isPass ? "var(--gold-bright)" : "var(--text-rune)";
  const glowAnimation = isFail ? "decree-red-glow 2.5s ease-in-out infinite" : isPass ? "decree-gold-glow 3s ease-in-out infinite" : "none";
  const shakeAnimation = isFail ? "decree-shake 0.6s ease-out 0.1s 1" : "none";
  const borderColor = isFail ? "var(--error-strong)" : agentColor;
  const isFallback = decree.format !== "canonical";
  return /* @__PURE__ */ jsxs11(Fragment4, { children: [
    /* @__PURE__ */ jsx12("style", { children: keyframes }),
    /* @__PURE__ */ jsxs11(
      "div",
      {
        className: "decree-card",
        style: {
          borderLeftColor: borderColor,
          borderLeftWidth: "3px",
          animation: `${glowAnimation}, ${shakeAnimation}`,
          position: "relative"
        },
        "aria-label": `Decree from ${agentName}: verdict ${decree.verdict}`,
        children: [
          isFallback && /* @__PURE__ */ jsx12(
            "div",
            {
              style: {
                position: "absolute",
                top: "6px",
                right: "8px",
                fontSize: "9px",
                color: "var(--text-void)",
                background: theme === "light" ? "rgba(100, 80, 45, 0.12)" : "rgba(42,42,62,0.6)",
                padding: "1px 5px",
                borderRadius: "3px",
                fontFamily: "monospace",
                letterSpacing: "0.5px"
              },
              "aria-label": `Decree format: ${decree.format} (fallback parsed)`,
              children: decree.format
            }
          ),
          /* @__PURE__ */ jsxs11("div", { className: "decree-card-header", children: [
            /* @__PURE__ */ jsxs11("div", { className: "decree-card-identity", children: [
              avatar && /* @__PURE__ */ jsx12(
                "button",
                {
                  className: "decree-card-avatar-btn",
                  onClick: () => onAvatarClick?.(agentKey),
                  "aria-label": `View ${agentName} profile`,
                  title: `View ${agentName} profile`,
                  children: /* @__PURE__ */ jsx12(
                    "img",
                    {
                      className: "decree-card-avatar",
                      src: avatar,
                      alt: agentName,
                      style: { borderColor: agentColor }
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxs11("div", { className: "decree-card-agent-info", children: [
                /* @__PURE__ */ jsx12("span", { className: "decree-card-agent-name", style: { color: agentColor }, children: agentName }),
                agentTitle && /* @__PURE__ */ jsx12("span", { className: "decree-card-agent-title", children: agentTitle }),
                agentRunes && /* @__PURE__ */ jsx12(
                  "span",
                  {
                    className: "decree-card-agent-runes",
                    "aria-hidden": "true",
                    style: {
                      fontSize: "11px",
                      color: agentColor,
                      opacity: 0.75,
                      letterSpacing: "2px"
                    },
                    children: agentRunes
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs11("div", { className: "decree-card-meta", children: [
              /* @__PURE__ */ jsxs11("div", { className: "decree-card-title", children: [
                /* @__PURE__ */ jsx12("span", { className: "decree-card-rune-delim", "aria-hidden": "true", children: "\u16ED\u16ED\u16ED" }),
                " ",
                "DECREE COMPLETE",
                " ",
                /* @__PURE__ */ jsx12("span", { className: "decree-card-rune-delim", "aria-hidden": "true", children: "\u16ED\u16ED\u16ED" })
              ] }),
              decree.issue && /* @__PURE__ */ jsxs11("span", { className: "decree-card-issue", "aria-label": `Issue ${decree.issue}`, children: [
                "Issue ",
                decree.issue
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs11(
            "div",
            {
              className: "decree-card-verdict-row",
              "aria-label": `Verdict: ${decree.verdict}`,
              style: {
                borderTop: `1px solid ${isFail ? "rgba(239,68,68,0.25)" : "rgba(201,146,10,0.20)"}`,
                borderBottom: `1px solid ${isFail ? "rgba(239,68,68,0.25)" : "rgba(201,146,10,0.20)"}`,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: isFail ? "rgba(239,68,68,0.06)" : "rgba(201,146,10,0.04)"
              },
              children: [
                /* @__PURE__ */ jsx12("span", { className: "decree-card-verdict-label", style: { fontSize: "10px", letterSpacing: "1.5px", color: "var(--text-void)", textTransform: "uppercase" }, children: "VERDICT" }),
                /* @__PURE__ */ jsx12(
                  "span",
                  {
                    className: "decree-card-verdict-value",
                    style: {
                      color: verdictColor,
                      fontSize: "22px",
                      fontWeight: 700,
                      letterSpacing: "2px",
                      textShadow: isFail ? "0 0 12px rgba(239,68,68,0.6)" : isPass ? "0 0 12px rgba(240,180,41,0.5)" : "none"
                    },
                    children: decree.verdict
                  }
                ),
                decree.pr && /* @__PURE__ */ jsx12(
                  "a",
                  {
                    className: "decree-card-pr-link",
                    href: decree.pr,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    "aria-label": `Pull request: ${decree.pr}`,
                    style: { marginLeft: "auto" },
                    children: "PR \u2197"
                  }
                )
              ]
            }
          ),
          decree.summary.length > 0 && /* @__PURE__ */ jsxs11("div", { className: `decree-card-section${summaryOpen ? " open" : ""}`, children: [
            /* @__PURE__ */ jsxs11(
              "button",
              {
                className: "decree-card-section-header",
                onClick: () => setSummaryOpen((o) => !o),
                "aria-expanded": summaryOpen,
                children: [
                  /* @__PURE__ */ jsx12("span", { className: "decree-card-section-glyph", "aria-hidden": "true", children: "\u16CA" }),
                  /* @__PURE__ */ jsx12("span", { className: "decree-card-section-title", children: "SUMMARY" }),
                  /* @__PURE__ */ jsx12("span", { className: "ep-group-chevron", "aria-hidden": "true", children: "\u203A" })
                ]
              }
            ),
            summaryOpen && /* @__PURE__ */ jsx12("ul", { className: "decree-card-list", "aria-label": "Decree summary", children: decree.summary.map((item, i) => /* @__PURE__ */ jsx12("li", { className: "decree-card-list-item", children: item }, i)) })
          ] }),
          decree.checks.length > 0 && /* @__PURE__ */ jsxs11("div", { className: `decree-card-section${checksOpen ? " open" : ""}`, children: [
            /* @__PURE__ */ jsxs11(
              "button",
              {
                className: "decree-card-section-header",
                onClick: () => setChecksOpen((o) => !o),
                "aria-expanded": checksOpen,
                children: [
                  /* @__PURE__ */ jsx12("span", { className: "decree-card-section-glyph", "aria-hidden": "true", children: "\u16CF" }),
                  /* @__PURE__ */ jsx12("span", { className: "decree-card-section-title", children: "CHECKS" }),
                  /* @__PURE__ */ jsx12("span", { className: "ep-group-chevron", "aria-hidden": "true", children: "\u203A" })
                ]
              }
            ),
            checksOpen && /* @__PURE__ */ jsx12("ul", { className: "decree-card-list decree-card-checks", "aria-label": "Decree checks", children: decree.checks.map((check, i) => {
              const isCheckPass = /^(PASS|COMPLETE|SECURED|DELIVERED|APPROVED|DONE)/i.test(check.value);
              const isCheckFail = /^(FAIL|FINDINGS)/i.test(check.value);
              const checkColor = isCheckFail ? "var(--error-strong)" : isCheckPass ? "var(--success-strong)" : "var(--text-rune)";
              const badgeBg = isCheckFail ? "rgba(239,68,68,0.15)" : isCheckPass ? "rgba(34,197,94,0.12)" : "rgba(96,96,112,0.15)";
              return /* @__PURE__ */ jsxs11("li", { className: "decree-card-check-item", children: [
                /* @__PURE__ */ jsx12("span", { className: "decree-card-check-name", style: { fontFamily: "monospace", fontSize: "12px" }, children: check.name }),
                /* @__PURE__ */ jsx12(
                  "span",
                  {
                    className: "decree-card-check-value",
                    style: {
                      color: checkColor,
                      background: badgeBg,
                      padding: "1px 7px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.8px"
                    },
                    children: check.value
                  }
                )
              ] }, i);
            }) })
          ] }),
          /* @__PURE__ */ jsxs11(
            "div",
            {
              className: "decree-card-footer",
              "aria-label": "Decree seal and signoff",
              style: {
                borderTop: `1px solid rgba(201,146,10,0.20)`,
                marginTop: "4px",
                paddingTop: "10px"
              },
              children: [
                /* @__PURE__ */ jsx12(
                  "div",
                  {
                    className: "decree-card-seal-band",
                    "aria-hidden": "true",
                    style: { color: agentColor, opacity: 0.5, letterSpacing: "4px", fontSize: "12px", textAlign: "center" },
                    children: "\u16ED \xB7 \u16ED \xB7 \u16ED"
                  }
                ),
                decree.seal && /* @__PURE__ */ jsx12(
                  "div",
                  {
                    className: "decree-card-seal",
                    style: {
                      fontStyle: "italic",
                      fontSize: "12px",
                      color: "var(--gold-bright)",
                      textAlign: "center",
                      padding: "4px 0",
                      letterSpacing: "0.5px"
                    },
                    children: decree.seal
                  }
                ),
                decree.signoff && /* @__PURE__ */ jsxs11(
                  "div",
                  {
                    className: "decree-card-signoff",
                    style: {
                      fontStyle: "italic",
                      fontSize: "11px",
                      color: "var(--text-rune)",
                      textAlign: "center",
                      padding: "2px 0 4px"
                    },
                    children: [
                      "\u201C",
                      decree.signoff,
                      "\u201D"
                    ]
                  }
                ),
                /* @__PURE__ */ jsx12(
                  "div",
                  {
                    className: "decree-card-seal-band",
                    "aria-hidden": "true",
                    style: { color: agentColor, opacity: 0.5, letterSpacing: "4px", fontSize: "12px", textAlign: "center" },
                    children: "\u16ED \xB7 \u16ED \xB7 \u16ED"
                  }
                )
              ]
            }
          )
        ]
      }
    )
  ] });
}

// src/ui/components/LogViewer.tsx
import { Fragment as Fragment5, jsx as jsx13, jsxs as jsxs12 } from "react/jsx-runtime";
function collapseKey(entry) {
  if (entry.type === "tool-use" && entry.toolName) {
    return `tool-use:${entry.toolName}`;
  }
  if (entry.type === "system" && entry.detail) {
    return `system:${entry.detail}`;
  }
  return null;
}
function groupConsecutiveEntries(entries) {
  const result = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.type === "entrypoint-header" && /^Starting (Claude Code|Hermes Agent)$/.test(entry.text ?? "")) {
      const metaEntries = [];
      let k = i + 1;
      while (k < entries.length) {
        const next = entries[k];
        if (next.type === "raw" && /^(Model|Session|Working directory|Branch):\s*/.test(next.text ?? "")) {
          metaEntries.push(next);
          k++;
        } else {
          break;
        }
      }
      result.push({ _startup: true, key: `startup-${entry.id}`, headerEntry: entry, metaEntries });
      i = k;
      continue;
    }
    const key = collapseKey(entry);
    if (!key) {
      result.push(entry);
      i++;
      continue;
    }
    let j = i + 1;
    while (j < entries.length && collapseKey(entries[j]) === key) {
      j++;
    }
    const count = j - i;
    if (count === 1) {
      result.push(entry);
    } else {
      result.push({ _collapsed: true, key, count, representative: entries[j - 1] });
    }
    i = j;
  }
  return result;
}
function SessionHeader({ job, isPinned: isPinned2 = false, onTogglePin, showPin = true, replayedFromCache = false, onCancelJob }) {
  const displayTitle = resolveSessionTitle(job);
  const [confirmingUnpin, setConfirmingUnpin] = useState14(false);
  const { theme } = useTheme();
  const statusColorMap = theme === "light" ? STATUS_COLORS_LIGHT : STATUS_COLORS;
  useEffect8(() => {
    setConfirmingUnpin(false);
  }, [isPinned2]);
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      className: "content-header",
      "aria-label": `Active session: ${displayTitle}`,
      children: [
        /* @__PURE__ */ jsxs12("div", { className: "session-title-block", children: [
          /* @__PURE__ */ jsx13(
            "span",
            {
              className: "session-title-primary",
              title: displayTitle,
              children: displayTitle
            }
          ),
          /* @__PURE__ */ jsxs12("div", { className: "session-meta-row", children: [
            /* @__PURE__ */ jsx13(
              "span",
              {
                className: "session-agent-badge",
                "aria-label": `Agent: ${job.agentName}`,
                children: job.agentName
              }
            ),
            /* @__PURE__ */ jsxs12("span", { className: "session-step-tag", children: [
              "Step ",
              job.step
            ] }),
            /* @__PURE__ */ jsxs12(
              "span",
              {
                className: "session-id-chip",
                title: job.sessionId,
                role: "text",
                "aria-label": `Session ID: ${job.sessionId}`,
                children: [
                  /* @__PURE__ */ jsx13("span", { className: "session-id-label", children: "Session:" }),
                  " ",
                  job.sessionId
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs12("span", { className: "header-badges", children: [
          job.status === "running" && onCancelJob ? /* @__PURE__ */ jsxs12(
            "button",
            {
              className: `header-action-btn header-action-btn--cancel${job.status === "running" ? " pulse" : ""}`,
              title: "Click to cancel this job",
              "aria-label": "Cancel running job",
              onClick: () => onCancelJob(job.sessionId),
              children: [
                /* @__PURE__ */ jsx13(StatusIconSvg, { status: job.status }),
                /* @__PURE__ */ jsx13("span", { children: "Cancel" })
              ]
            }
          ) : /* @__PURE__ */ jsx13(
            "span",
            {
              className: `job-status-icon-btn${job.status === "running" ? " pulse" : ""}`,
              style: { color: statusColorMap[job.status] },
              title: `Job status: ${STATUS_LABELS[job.status]}`,
              "aria-label": `Job status: ${STATUS_LABELS[job.status]}`,
              children: /* @__PURE__ */ jsx13(StatusIconSvg, { status: job.status })
            }
          ),
          replayedFromCache && /* @__PURE__ */ jsx13(
            "span",
            {
              className: "header-action-btn replayed-cache",
              title: "Pod cleaned up \u2014 showing cached logs",
              "aria-label": "Replayed from cache",
              children: "\u16D7 Cached"
            }
          ),
          /* @__PURE__ */ jsx13(CopySessionIdButton, { sessionId: job.sessionId }),
          showPin && onTogglePin && (confirmingUnpin ? /* @__PURE__ */ jsxs12(
            "button",
            {
              className: "header-action-btn header-action-btn--confirm",
              onClick: () => {
                onTogglePin();
                setConfirmingUnpin(false);
              },
              onBlur: () => setConfirmingUnpin(false),
              title: "Confirm: remove from Odin\\u2019s memory",
              "aria-label": "Confirm unpin",
              children: [
                /* @__PURE__ */ jsx13("span", { children: "\u2715" }),
                /* @__PURE__ */ jsx13("span", { children: "Unpin" })
              ]
            }
          ) : /* @__PURE__ */ jsxs12(
            "button",
            {
              className: `header-action-btn${isPinned2 ? " header-action-btn--pinned" : ""}`,
              onClick: () => {
                if (isPinned2) {
                  setConfirmingUnpin(true);
                } else {
                  onTogglePin();
                }
              },
              title: isPinned2 ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory",
              "aria-label": isPinned2 ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory",
              "aria-pressed": isPinned2,
              children: [
                /* @__PURE__ */ jsx13(PinIcon, { filled: isPinned2 }),
                /* @__PURE__ */ jsx13("span", { children: isPinned2 ? "Pinned" : "Pin" })
              ]
            }
          )),
          job.status === "succeeded" && /* @__PURE__ */ jsx13(DownloadSessionButton, { sessionId: job.sessionId })
        ] })
      ]
    }
  );
}
function LogViewer({ entries, activeJob, isFixture, isTtlExpired, isNodeUnreachable, streamError, onSetSpeed, isPinned: isPinned2, onTogglePin, onAvatarClick, replayedFromCache, isConnecting, isPodStarting, onCancelJob }) {
  const termRef = useRef7(null);
  const [fixtureSpeed, setFixtureSpeed] = useState14(1);
  const [fixturePaused, setFixturePaused] = useState14(false);
  const [autoScroll, setAutoScroll] = useState14(true);
  const programmaticScrollRef = useRef7(false);
  const lastEntryId = entries[entries.length - 1]?.id;
  useEffect8(() => {
    if (autoScroll && termRef.current) {
      programmaticScrollRef.current = true;
      requestAnimationFrame(() => {
        if (termRef.current) {
          termRef.current.scrollTop = termRef.current.scrollHeight;
        }
      });
    }
  }, [entries.length, lastEntryId, autoScroll]);
  useEffect8(() => {
    setAutoScroll(true);
    programmaticScrollRef.current = false;
  }, [activeJob?.sessionId]);
  const handleScroll = useCallback8(() => {
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }
    const el = termRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
  }, []);
  const toggleAutoScroll = useCallback8(() => {
    setAutoScroll((prev) => {
      if (!prev && termRef.current) {
        programmaticScrollRef.current = true;
        termRef.current.scrollTop = termRef.current.scrollHeight;
      }
      return !prev;
    });
  }, []);
  const lastAssistantTextId = useMemo2(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e && e.type === "assistant-text" && e.detail !== "thinking") {
        return e.id;
      }
    }
    return null;
  }, [entries]);
  const lastToolBatchId = useMemo2(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.type === "tool-batch") return entries[i].id;
    }
    return null;
  }, [entries]);
  const displayEntries = useMemo2(() => groupConsecutiveEntries(entries), [entries]);
  if (!activeJob) {
    return /* @__PURE__ */ jsx13("main", { className: "content", "aria-label": "Log viewer", children: /* @__PURE__ */ jsxs12("div", { className: "empty-state", "aria-label": "No session selected", children: [
      /* @__PURE__ */ jsx13("div", { className: "empty-title", children: "All Nine Worlds await" }),
      /* @__PURE__ */ jsx13("div", { className: "empty-sub", children: "Select an agent session to stream its logs" })
    ] }) });
  }
  if (isTtlExpired && streamError && !replayedFromCache && !isConnecting) {
    return /* @__PURE__ */ jsxs12("main", { className: "content", "aria-label": "Log viewer", children: [
      /* @__PURE__ */ jsx13(
        SessionHeader,
        {
          job: activeJob,
          isPinned: isPinned2,
          onTogglePin,
          onCancelJob
        }
      ),
      /* @__PURE__ */ jsx13(NorseErrorTablet, { sessionId: activeJob.sessionId, message: streamError })
    ] });
  }
  if (isNodeUnreachable && streamError && !replayedFromCache && !isConnecting) {
    return /* @__PURE__ */ jsxs12("main", { className: "content", "aria-label": "Log viewer", children: [
      /* @__PURE__ */ jsx13(
        SessionHeader,
        {
          job: activeJob,
          isPinned: isPinned2,
          onTogglePin,
          showPin: false,
          onCancelJob
        }
      ),
      /* @__PURE__ */ jsx13(NorseErrorTablet, { sessionId: activeJob.sessionId, message: streamError, variant: "node-unreachable" })
    ] });
  }
  return /* @__PURE__ */ jsxs12("main", { className: "content", "aria-label": "Log viewer", style: { position: "relative" }, children: [
    /* @__PURE__ */ jsx13(
      SessionHeader,
      {
        job: activeJob,
        isPinned: isPinned2,
        onTogglePin,
        replayedFromCache,
        onCancelJob
      }
    ),
    /* @__PURE__ */ jsxs12(
      "div",
      {
        className: "log-terminal",
        ref: termRef,
        role: "log",
        "aria-live": "polite",
        "aria-label": "Session logs",
        onScroll: handleScroll,
        children: [
          isConnecting && entries.length === 0 && /* @__PURE__ */ jsxs12(
            "div",
            {
              className: `session-connecting${isPodStarting ? " pod-starting" : ""}`,
              "aria-label": isPodStarting ? "Agent is starting up" : "Connecting to session",
              "aria-live": "polite",
              children: [
                /* @__PURE__ */ jsx13("span", { className: isPodStarting ? "pod-starting-rune" : "connecting-spinner", "aria-hidden": "true", children: isPodStarting ? "\u16C8" : "" }),
                /* @__PURE__ */ jsx13("span", { children: isPodStarting ? "\u23F3 Agent is starting up \u2014 logs will appear shortly\u2026" : "Awaiting the Norns\u2026" })
              ]
            }
          ),
          displayEntries.map((item) => {
            if ("_startup" in item) {
              return /* @__PURE__ */ jsx13(StartupBlock, { group: item }, item.key);
            }
            if ("_collapsed" in item) {
              return /* @__PURE__ */ jsx13(
                LogLine,
                {
                  entry: item.representative,
                  ...activeJob?.agentKey ? { agentKey: activeJob.agentKey } : {},
                  ...activeJob?.agentName ? { agentName: activeJob.agentName } : {},
                  isLastAssistantText: false,
                  autoScroll,
                  isLatestBatch: item.representative.type === "tool-batch" && item.representative.id === lastToolBatchId,
                  onAvatarClick,
                  collapseCount: item.count
                },
                item.representative.id
              );
            }
            return /* @__PURE__ */ jsx13(
              LogLine,
              {
                entry: item,
                ...activeJob?.agentKey ? { agentKey: activeJob.agentKey } : {},
                ...activeJob?.agentName ? { agentName: activeJob.agentName } : {},
                isLastAssistantText: item.id === lastAssistantTextId,
                autoScroll,
                isLatestBatch: item.type === "tool-batch" && item.id === lastToolBatchId,
                onAvatarClick
              },
              item.id
            );
          })
        ]
      }
    ),
    /* @__PURE__ */ jsxs12("div", { className: "log-controls", children: [
      isFixture && /* @__PURE__ */ jsxs12("div", { className: "speed-controls", children: [
        /* @__PURE__ */ jsx13(
          "button",
          {
            className: `speed-btn ${fixturePaused ? "active" : ""}`,
            onClick: () => {
              const next = !fixturePaused;
              setFixturePaused(next);
              onSetSpeed?.(next ? 0 : fixtureSpeed);
            },
            title: fixturePaused ? "Resume" : "Pause",
            children: fixturePaused ? "\u25B6" : "\u23F8"
          }
        ),
        [1, 2, 3, 5].map((s) => /* @__PURE__ */ jsxs12(
          "button",
          {
            className: `speed-btn ${fixtureSpeed === s && !fixturePaused ? "active" : ""}`,
            onClick: () => {
              setFixtureSpeed(s);
              setFixturePaused(false);
              onSetSpeed?.(s);
            },
            title: `${s}x speed`,
            children: [
              s,
              "x"
            ]
          },
          s
        ))
      ] }),
      /* @__PURE__ */ jsx13(
        "button",
        {
          className: `autoscroll-fab ${autoScroll ? "active" : ""}`,
          onClick: toggleAutoScroll,
          "aria-label": autoScroll ? "Auto-scroll on (click to pause)" : "Auto-scroll off (click to resume)",
          title: autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF",
          children: autoScroll ? "\u23F8" : "\u25B6"
        }
      )
    ] })
  ] });
}
function LogLine({ entry, agentKey, agentName, isLastAssistantText, autoScroll, isLatestBatch, onAvatarClick, collapseCount }) {
  switch (entry.type) {
    case "system":
      return /* @__PURE__ */ jsxs12("div", { className: "ev-system", children: [
        /* @__PURE__ */ jsx13("span", { className: "ev-label", children: "system" }),
        collapseCount != null && collapseCount > 1 && /* @__PURE__ */ jsxs12("span", { className: "ev-collapse-count", title: `${collapseCount} consecutive identical entries collapsed`, children: [
          "\xD7",
          collapseCount
        ] }),
        " ",
        entry.detail
      ] });
    case "turn-divider":
      return null;
    // legacy, unused
    case "tool-batch":
      return /* @__PURE__ */ jsx13(ToolBatchGroup, { entry, ...autoScroll !== void 0 ? { autoScroll } : {}, ...isLatestBatch !== void 0 ? { isLatestBatch } : {} });
    case "assistant-text":
      if (entry.detail === "thinking") {
        return /* @__PURE__ */ jsx13("div", { className: "ev-thinking", children: entry.text });
      }
      return /* @__PURE__ */ jsx13(
        AgentBubble,
        {
          text: entry.text ?? "",
          ...agentKey ? { agentKey } : {},
          ...agentName ? { agentName } : {},
          ...isLastAssistantText ? { isLastAssistantText } : {},
          onAvatarClick
        }
      );
    case "tool-use":
      return /* @__PURE__ */ jsx13(ToolBlock, { entry, ...collapseCount != null && collapseCount > 1 ? { collapseCount } : {} });
    case "entrypoint-group":
      return /* @__PURE__ */ jsx13(EntrypointGroup, { entry });
    case "entrypoint-header":
      return /* @__PURE__ */ jsx13("div", { className: "ep-header", children: entry.text });
    case "entrypoint-ok":
      return /* @__PURE__ */ jsxs12("div", { className: "ep-ok", children: [
        /* @__PURE__ */ jsx13("span", { className: "ep-ok-badge", children: "\u2713" }),
        " ",
        entry.text
      ] });
    case "entrypoint-info":
      return /* @__PURE__ */ jsxs12("div", { className: "ep-info", children: [
        /* @__PURE__ */ jsxs12("span", { className: "ep-info-key", children: [
          entry.detail,
          ":"
        ] }),
        " ",
        entry.text
      ] });
    case "entrypoint-fatal":
      return /* @__PURE__ */ jsxs12("div", { className: "ep-fatal", role: "alert", children: [
        /* @__PURE__ */ jsx13("span", { className: "ep-fatal-badge", children: "\u2717" }),
        " ",
        entry.text
      ] });
    case "entrypoint-task":
      return /* @__PURE__ */ jsx13(NorseTablet, { text: entry.text ?? "", ...autoScroll !== void 0 ? { autoScroll } : {} });
    case "warning":
      return /* @__PURE__ */ jsxs12("span", { className: "log-warning", children: [
        "\u26A0",
        " ",
        entry.message
      ] });
    case "error":
      return /* @__PURE__ */ jsxs12("div", { className: "log-error-box", role: "alert", "aria-label": "Log stream error", children: [
        /* @__PURE__ */ jsx13("span", { className: "log-error-icon", children: "\u26A0" }),
        /* @__PURE__ */ jsx13("span", { className: "log-error-text", children: entry.message })
      ] });
    case "stream-end":
      return /* @__PURE__ */ jsxs12("div", { className: "log-end", children: [
        "\u2014 stream ",
        entry.reason,
        " \u2014"
      ] });
    case "verdict": {
      const color = entry.verdictResult === "PASS" ? "var(--success-strong)" : "var(--error-strong)";
      return /* @__PURE__ */ jsxs12("span", { style: { color, fontWeight: "bold" }, children: [
        "\u2014 Verdict: ",
        entry.verdictResult,
        " \u2014"
      ] });
    }
    case "raw":
      return /* @__PURE__ */ jsx13("div", { className: "log-line", style: { color: "var(--text-void)" }, children: entry.text });
    default:
      return null;
  }
}
function isTemplateBoilerplate(text) {
  if (isDecreeBlock(text)) return false;
  if (/<If\s+(PASS|FAIL):/i.test(text)) return true;
  if (/\*\*Step\s+\d+[^*]*[—\-][^*]*(Chain continuation|Decree)\b/im.test(text)) return true;
  if (/\*\*Test Standards:/im.test(text)) return true;
  return false;
}
function AgentBubble({
  text,
  agentKey,
  agentName,
  isLastAssistantText,
  onAvatarClick
}) {
  if (isTemplateBoilerplate(text)) return null;
  if (isDecreeBlock(text)) {
    return /* @__PURE__ */ jsx13(
      DecreeBlock,
      {
        text,
        ...agentKey ? { agentKey } : {},
        ...agentName ? { agentName } : {},
        onAvatarClick
      }
    );
  }
  if (isLastAssistantText && isVerdictMessage(text)) {
    return /* @__PURE__ */ jsx13(
      NorseVerdictInscription,
      {
        text,
        ...agentKey ? { agentKey } : {},
        ...agentName ? { agentName } : {}
      }
    );
  }
  const { theme } = useTheme();
  const name = agentName ?? AGENT_NAMES[agentKey ?? ""] ?? "Agent";
  const title = AGENT_TITLES[agentKey ?? ""] ?? "";
  const avatar = avatarUrl(agentKey ?? "", theme === "light" ? "light" : "dark");
  const color = AGENT_COLORS[agentKey ?? ""] ?? "var(--gold)";
  return /* @__PURE__ */ jsxs12("div", { className: "agent-bubble", style: { "--agent-accent": color, borderLeftColor: color }, children: [
    /* @__PURE__ */ jsxs12("div", { className: "agent-bubble-header", children: [
      avatar && /* @__PURE__ */ jsx13(
        "button",
        {
          className: "agent-bubble-avatar-btn",
          onClick: () => onAvatarClick?.(agentKey ?? ""),
          "aria-label": `View ${name} profile`,
          title: `View ${name} profile`,
          children: /* @__PURE__ */ jsx13("img", { className: "agent-bubble-avatar", src: avatar, alt: name, style: { borderColor: color } })
        }
      ),
      /* @__PURE__ */ jsxs12("div", { className: "agent-bubble-identity", children: [
        /* @__PURE__ */ jsx13("span", { className: "agent-bubble-name", style: { color }, children: name }),
        title && /* @__PURE__ */ jsx13("span", { className: "agent-bubble-title", children: title })
      ] })
    ] }),
    /* @__PURE__ */ jsx13("div", { className: "agent-bubble-text", children: text })
  ] });
}
function ToolBatchGroup({ entry, autoScroll, isLatestBatch }) {
  const [open, setOpen] = useState14(() => !autoScroll || !!isLatestBatch);
  const hasError = entry.children?.some((c) => c.toolIsError) ?? false;
  const prevCompleteRef = useRef7(entry.complete);
  const prevIsLatestRef = useRef7(isLatestBatch);
  const prevAutoScrollRef = useRef7(autoScroll);
  useEffect8(() => {
    if (entry.complete && !prevCompleteRef.current) {
      prevCompleteRef.current = true;
      setOpen(false);
    }
  }, [entry.complete]);
  useEffect8(() => {
    const wasLatest = prevIsLatestRef.current;
    prevIsLatestRef.current = isLatestBatch;
    if (wasLatest && !isLatestBatch && autoScroll) {
      setOpen(false);
    }
  }, [isLatestBatch, autoScroll]);
  useEffect8(() => {
    const wasAutoScroll = prevAutoScrollRef.current;
    prevAutoScrollRef.current = autoScroll;
    if (!wasAutoScroll && autoScroll && !isLatestBatch) {
      setOpen(false);
    }
  }, [autoScroll, isLatestBatch]);
  return /* @__PURE__ */ jsxs12("div", { className: `ev-tool-batch ${open ? "open" : ""}${hasError ? " batch-error" : ""}${entry.complete ? " complete" : ""}`, children: [
    /* @__PURE__ */ jsxs12("div", { className: "ev-tool-batch-header", onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsx13("span", { className: "ev-tool-batch-chevron", children: "\u203A" }),
      /* @__PURE__ */ jsx13("span", { className: "ev-tool-batch-label", children: entry.text }),
      !entry.complete && /* @__PURE__ */ jsx13("span", { className: "ev-tool-batch-spinner" }),
      entry.complete && /* @__PURE__ */ jsx13("span", { className: "ev-tool-batch-done", children: "\u2713" })
    ] }),
    /* @__PURE__ */ jsx13("div", { className: "ev-tool-batch-body-wrap", children: /* @__PURE__ */ jsx13("div", { className: "ev-tool-batch-body", children: entry.children?.map((child) => /* @__PURE__ */ jsx13(LogLine, { entry: child }, child.id)) }) })
  ] });
}
function parseDecreeSections(text) {
  const SECTION_MAP = [
    { pattern: /^You are \w+/m, glyph: "\u16C1", title: "Hear Me, Agent" },
    { pattern: /SANDBOX RULES/m, glyph: "\u16BA", title: "The Sacred Ground" },
    { pattern: /\*\*Step 1/m, glyph: "\u16B2", title: "Consecrate Thy Forge" },
    { pattern: /TODO TRACKING/m, glyph: "\u16BE", title: "The Norns\u2019 Ledger" },
    { pattern: /INCREMENTAL COMMIT/m, glyph: "\u16B7", title: "The Chain of Gleipnir" },
    { pattern: /VERIFY.*tsc.*build/m, glyph: "\u16D7", title: "Trial by Fire" },
    { pattern: /STRICT SCOPE/m, glyph: "\u16CF", title: "The Gjallarhorn Boundary" },
    { pattern: /\*\*Step 2/m, glyph: "\u16B1", title: "Consult the Runes" },
    { pattern: /\*\*Issue details/m, glyph: "\u16C3", title: "The Wound in Yggdrasil", defaultOpen: true, wide: true },
    { pattern: /\*\*Step 3[^b]/m, glyph: "\u16A0", title: "Take Up Mj\xF6lnir" },
    { pattern: /\*\*Step 3b/m, glyph: "\u16CA", title: "Forge the Tests" },
    { pattern: /\*\*Step 4/m, glyph: "\u16D2", title: "Walk the Bifr\xF6st" },
    { pattern: /\*\*Step 5/m, glyph: "\u16DA", title: "Align with the World Tree" },
    { pattern: /\*\*Step 6/m, glyph: "\u16D6", title: "Present Thy Offering" },
    { pattern: /\*\*Step 7/m, glyph: "\u16DE", title: "Pass the Torch" }
  ];
  const boundaries = [];
  for (const sec of SECTION_MAP) {
    const match = sec.pattern.exec(text);
    if (match) boundaries.push({ idx: match.index, glyph: sec.glyph, title: sec.title, defaultOpen: sec.defaultOpen ?? false, wide: sec.wide ?? false });
  }
  boundaries.sort((a, b) => a.idx - b.idx);
  if (boundaries.length === 0) {
    return [{ glyph: "\u16DF", title: "The Decree", body: text, defaultOpen: true, wide: false }];
  }
  const sections = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].idx;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].idx : text.length;
    sections.push({
      glyph: boundaries[i].glyph,
      title: boundaries[i].title,
      body: text.slice(start, end).trim(),
      defaultOpen: boundaries[i].defaultOpen,
      wide: boundaries[i].wide
    });
  }
  return sections;
}
function applyWikiLinksToNodes(nodes) {
  let current2 = nodes;
  let keyIdx = 0;
  for (const [term, url] of Object.entries(WIKI_LINKS)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(\\b${escaped}\\b)`, "g");
    const next = [];
    for (const node of current2) {
      if (typeof node !== "string") {
        next.push(node);
        continue;
      }
      const parts = node.split(regex);
      for (const part of parts) {
        if (part === term) {
          next.push(
            /* @__PURE__ */ jsx13(
              "a",
              {
                className: "decree-body-link",
                href: url,
                target: "_blank",
                rel: "noopener noreferrer",
                title: `Wikipedia: ${term}`,
                children: term
              },
              `wiki-${term}-${keyIdx++}`
            )
          );
        } else if (part) {
          next.push(part);
        }
      }
    }
    current2 = next;
  }
  return current2;
}
function processInline(text) {
  const btParts = text.split(/`([^`]+)`/);
  const nodes = [];
  for (let i = 0; i < btParts.length; i++) {
    const part = btParts[i] ?? "";
    if (i % 2 === 1) {
      nodes.push(/* @__PURE__ */ jsx13("code", { className: "decree-body-code", children: part }, `bc-${i}`));
    } else if (part) {
      nodes.push(part);
    }
  }
  return applyWikiLinksToNodes(nodes);
}
function DecreeSectionBody({ body }) {
  const lines = body.split("\n");
  const elements = [];
  const listBuffer = [];
  const codeBuffer = [];
  const fenceBuffer = [];
  let inFence = false;
  let fenceLang = "";
  let keyIdx = 0;
  const isCodeLine = (line) => /^(cd |git |gh |bash |npm |node )/.test(line.trimStart()) || /^ {2,}/.test(line);
  const isListLine = (line) => /^[-*] /.test(line.trimStart());
  const isHeadingLine = (line) => /^##\s+/.test(line.trimStart()) || /^\*\*/.test(line.trimStart());
  const isFenceLine = (line) => /^`{3,}/.test(line.trimStart());
  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      /* @__PURE__ */ jsx13("ul", { children: listBuffer.map((item, i) => {
        const content = item.trimStart().replace(/^[-*]\s+/, "");
        return /* @__PURE__ */ jsx13("li", { children: processInline(content) }, i);
      }) }, `ul-${keyIdx++}`)
    );
    listBuffer.length = 0;
  };
  const flushCode = () => {
    if (codeBuffer.length === 0) return;
    elements.push(
      /* @__PURE__ */ jsx13("code", { className: "decree-body-block", children: codeBuffer.join("\n") }, `blk-${keyIdx++}`)
    );
    codeBuffer.length = 0;
  };
  const flushFence = () => {
    if (fenceBuffer.length === 0 && !inFence) return;
    elements.push(
      /* @__PURE__ */ jsx13("pre", { className: "decree-body-fence", children: /* @__PURE__ */ jsx13("code", { className: fenceLang ? `language-${fenceLang}` : void 0, children: fenceBuffer.join("\n") }) }, `fence-${keyIdx++}`)
    );
    fenceBuffer.length = 0;
    inFence = false;
    fenceLang = "";
  };
  for (const line of lines) {
    if (isFenceLine(line)) {
      if (!inFence) {
        flushList();
        flushCode();
        inFence = true;
        fenceLang = line.trimStart().replace(/^`{3,}/, "").trim();
      } else {
        flushFence();
      }
      continue;
    }
    if (inFence) {
      fenceBuffer.push(line);
      continue;
    }
    if (isCodeLine(line)) {
      flushList();
      codeBuffer.push(line);
    } else if (isListLine(line)) {
      flushCode();
      listBuffer.push(line);
    } else {
      flushCode();
      flushList();
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isHeadingLine(line)) {
        const content = trimmed.replace(/^##\s+/, "").replace(/^\*\*/, "").replace(/\*\*$/, "");
        elements.push(/* @__PURE__ */ jsx13("strong", { children: processInline(content) }, `h-${keyIdx++}`));
      } else {
        elements.push(/* @__PURE__ */ jsx13("p", { children: processInline(trimmed) }, `p-${keyIdx++}`));
      }
    }
  }
  flushCode();
  flushList();
  if (inFence) flushFence();
  return /* @__PURE__ */ jsx13(Fragment5, { children: elements });
}
function DecreeSection({ glyph, title, body, defaultOpen, wide }) {
  const [open, setOpen] = useState14(defaultOpen);
  return /* @__PURE__ */ jsxs12("div", { className: `decree-section ${open ? "open" : ""}${wide ? " decree-wide" : ""}`, children: [
    /* @__PURE__ */ jsxs12(
      "div",
      {
        className: "decree-section-header",
        onClick: () => setOpen((o) => !o),
        role: "button",
        tabIndex: 0,
        "aria-expanded": open,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        },
        children: [
          /* @__PURE__ */ jsx13("span", { className: "decree-section-glyph", "aria-hidden": "true", children: glyph }),
          /* @__PURE__ */ jsx13("span", { className: "decree-section-title", children: title }),
          /* @__PURE__ */ jsx13("span", { className: "ep-group-chevron", style: { marginLeft: "auto" }, children: "\u203A" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx13("div", { className: "decree-section-body", children: /* @__PURE__ */ jsx13(DecreeSectionBody, { body }) })
  ] });
}
function NorseTablet({ text, autoScroll }) {
  const [open, setOpen] = useState14(true);
  const [hasBeenCollapsed, setHasBeenCollapsed] = useState14(false);
  const agentMatch = /^You are (\w+)/m.exec(text);
  const agent = agentMatch?.[1] ?? "Agent";
  const agentKey = agent.toLowerCase();
  const issueMatch = /#(\d+)/.exec(text);
  const issue = issueMatch?.[1] ?? "";
  const sections = parseDecreeSections(text);
  const agentRunes = AGENT_RUNE_NAMES[agentKey] ?? AGENT_RUNE_NAMES._fallback ?? "\u16A8\u16CA\u16B7\u16A8\u16B1\u16DE";
  const firstRune = [...agentRunes][0] ?? "\u16DF";
  const agentColor = AGENT_COLORS[agentKey] ?? "#888";
  const agentTitle = AGENT_TITLES[agentKey] ?? "Agent";
  const agentDisplayName = AGENT_NAMES[agentKey] ?? agent;
  useEffect8(() => {
    if (!autoScroll || hasBeenCollapsed) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setHasBeenCollapsed(true);
    }, 3e3);
    return () => clearTimeout(timer);
  }, [autoScroll, hasBeenCollapsed]);
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      className: `norse-tablet ${open ? "open" : ""}`,
      style: { borderLeft: `3px solid ${agentColor}` },
      children: [
        /* @__PURE__ */ jsxs12(
          "div",
          {
            className: "norse-tablet-header",
            onClick: () => setOpen(!open),
            role: "button",
            tabIndex: 0,
            "aria-expanded": open,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((o) => !o);
              }
            },
            children: [
              /* @__PURE__ */ jsx13("span", { className: "norse-tablet-rune", "aria-hidden": "true", children: firstRune }),
              /* @__PURE__ */ jsxs12("div", { className: "norse-tablet-title-block", children: [
                /* @__PURE__ */ jsxs12("div", { className: "norse-tablet-title", children: [
                  "THE ALL-FATHER'S DECREE UNTO ",
                  agentDisplayName.toUpperCase()
                ] }),
                /* @__PURE__ */ jsxs12("div", { className: "norse-tablet-subtitle", children: [
                  issue ? `Issue #${issue} \xB7 ` : "",
                  agentTitle,
                  agentRunes && /* @__PURE__ */ jsxs12("span", { className: "norse-tablet-rune-name", "aria-hidden": "true", children: [
                    " \\u00B7 ",
                    agentRunes
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsx13("span", { className: "norse-tablet-rune", "aria-hidden": "true", children: firstRune }),
              /* @__PURE__ */ jsx13("span", { className: "ep-group-chevron", style: { marginLeft: "auto" }, children: "\u203A" })
            ]
          }
        ),
        /* @__PURE__ */ jsx13("div", { className: "norse-tablet-body-wrap", children: /* @__PURE__ */ jsxs12("div", { className: "norse-tablet-body", children: [
          /* @__PURE__ */ jsx13("div", { className: "decree-grid", children: sections.map((sec, i) => /* @__PURE__ */ jsx13(
            DecreeSection,
            {
              glyph: sec.glyph,
              title: sec.title,
              body: sec.body,
              defaultOpen: sec.defaultOpen,
              wide: sec.wide
            },
            i
          )) }),
          /* @__PURE__ */ jsxs12("div", { className: "decree-seal", role: "complementary", "aria-label": "Odin's royal seal", children: [
            /* @__PURE__ */ jsx13("div", { className: "decree-seal-runic-band", "aria-hidden": "true", children: "\u16DF \u16DE \u16C1 \u16BE \xB7 \u16A8 \u16DA \u16DA \u16A0 \u16A8 \u16A6 \u16D6 \u16B1 \xB7 \u16A2 \u16CF \u16B7 \u16A8 \u16B1 \u16DE" }),
            /* @__PURE__ */ jsx13("div", { className: "decree-seal-medallion", role: "img", "aria-label": "Odin's rune \u2014 Othalan", children: "\u16DF" }),
            /* @__PURE__ */ jsx13("div", { className: "decree-seal-divider", "aria-hidden": "true", children: "\u2014 \u16A8 \u2014" }),
            /* @__PURE__ */ jsxs12("div", { className: "decree-seal-command", children: [
              "\u201CBy mine eye that sees all",
              " ",
              /* @__PURE__ */ jsx13(
                "a",
                {
                  className: "wiki-link decree-body-link",
                  href: "https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: "Wikipedia: Nine Worlds",
                  "aria-label": "Wikipedia: Nine Worlds",
                  children: "Nine Realms"
                }
              ),
              " ",
              "\u2014 I command thee to this task. Fail not.",
              " ",
              /* @__PURE__ */ jsx13(
                "a",
                {
                  className: "wiki-link decree-body-link",
                  href: "https://en.wikipedia.org/wiki/Fenrir",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  title: "Wikipedia: Fenrir",
                  "aria-label": "Wikipedia: Fenrir",
                  children: "Fenrir"
                }
              ),
              " ",
              "hungers.\u201D"
            ] }),
            /* @__PURE__ */ jsx13("div", { className: "decree-seal-attribution", children: "Odin \xB7 All-Father" }),
            /* @__PURE__ */ jsx13("div", { className: "decree-seal-title-runes", "aria-hidden": "true", children: "\u16DF\u16DE\u16C1\u16BE \u16A8\u16DA\u16DA\u16A0\u16A8\u16A6\u16D6\u16B1" })
          ] })
        ] }) })
      ]
    }
  );
}
function PinIcon({ filled }) {
  return /* @__PURE__ */ jsx13("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: filled ? (
    // Filled tack (pinned state — gold)
    /* @__PURE__ */ jsxs12(Fragment5, { children: [
      /* @__PURE__ */ jsx13("path", { d: "M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z", fill: "currentColor" }),
      /* @__PURE__ */ jsx13("line", { x1: "5", y1: "11", x2: "2", y2: "14", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
    ] })
  ) : (
    // Hollow tack (unpinned state — dim)
    /* @__PURE__ */ jsxs12(Fragment5, { children: [
      /* @__PURE__ */ jsx13("path", { d: "M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }),
      /* @__PURE__ */ jsx13("line", { x1: "5", y1: "11", x2: "2", y2: "14", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
    ] })
  ) });
}
function ClipboardIcon() {
  return /* @__PURE__ */ jsxs12("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx13("rect", { x: "4", y: "3", width: "7", height: "9", rx: "1", stroke: "currentColor", strokeWidth: "1.5" }),
    /* @__PURE__ */ jsx13("path", { d: "M4 4H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
    /* @__PURE__ */ jsx13("path", { d: "M6 3V2h3v1", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })
  ] });
}
function CheckIcon() {
  return /* @__PURE__ */ jsx13("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ jsx13("path", { d: "M2 7l4 4 6-6", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
}
function CopySessionIdButton({ sessionId }) {
  const [copied, setCopied] = useState14(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2e3);
    } catch {
    }
  }
  return /* @__PURE__ */ jsxs12(
    "button",
    {
      className: `header-action-btn${copied ? " header-action-btn--copied" : ""}`,
      onClick: handleCopy,
      title: copied ? "Copied!" : "Copy session ID",
      "aria-label": copied ? "Session ID copied" : "Copy session ID",
      children: [
        copied ? /* @__PURE__ */ jsx13(CheckIcon, {}) : /* @__PURE__ */ jsx13(ClipboardIcon, {}),
        /* @__PURE__ */ jsx13("span", { children: copied ? "Copied" : "Copy" })
      ]
    }
  );
}
function DownloadIcon() {
  return /* @__PURE__ */ jsxs12("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx13("path", { d: "M7 2v7M4 6l3 3 3-3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }),
    /* @__PURE__ */ jsx13("path", { d: "M2 11h10", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
  ] });
}
function DownloadSessionButton({ sessionId }) {
  return /* @__PURE__ */ jsx13(
    "button",
    {
      className: "copy-session-btn",
      onClick: () => void downloadLogFile(sessionId),
      title: "Download session log",
      "aria-label": "Download session log",
      children: /* @__PURE__ */ jsx13(DownloadIcon, {})
    }
  );
}
function StartupBlock({ group }) {
  const [open, setOpen] = useState14(false);
  const modelEntry = group.metaEntries.find((e) => /^Model:\s*/.test(e.text ?? ""));
  const sessionEntry = group.metaEntries.find((e) => /^Session:\s*/.test(e.text ?? ""));
  const model = modelEntry?.text?.replace(/^Model:\s*/, "").trim() ?? "";
  const session = sessionEntry?.text?.replace(/^Session:\s*/, "").trim() ?? "";
  return /* @__PURE__ */ jsxs12("div", { className: `ep-group ${open ? "open" : ""}`, children: [
    /* @__PURE__ */ jsxs12("div", { className: "ep-group-header", onClick: () => setOpen(!open), role: "button", tabIndex: 0, "aria-expanded": open, onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }, children: [
      /* @__PURE__ */ jsx13("span", { className: "ep-group-chevron", children: "\u203A" }),
      /* @__PURE__ */ jsx13("span", { className: "ep-group-title", children: group.headerEntry.text }),
      /* @__PURE__ */ jsxs12("span", { className: "ep-group-meta", children: [
        model && /* @__PURE__ */ jsxs12("span", { className: "ep-group-meta-item", children: [
          /* @__PURE__ */ jsx13("span", { className: "ep-group-meta-key", children: "Model:" }),
          " ",
          model
        ] }),
        session && /* @__PURE__ */ jsxs12("span", { className: "ep-group-meta-item", children: [
          /* @__PURE__ */ jsx13("span", { className: "ep-group-meta-key", children: "Session:" }),
          " ",
          session
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx13("div", { className: "ep-group-body-wrap", children: /* @__PURE__ */ jsx13("div", { className: "ep-group-body", children: /* @__PURE__ */ jsx13("div", { className: "ep-info-card", children: group.metaEntries.map((e) => {
      const kvMatch = /^([^:]+):\s*(.+)$/.exec(e.text ?? "");
      return /* @__PURE__ */ jsx13("div", { className: "ep-info", children: kvMatch ? /* @__PURE__ */ jsxs12(Fragment5, { children: [
        /* @__PURE__ */ jsxs12("span", { className: "ep-info-key", children: [
          kvMatch[1],
          ":"
        ] }),
        " ",
        kvMatch[2]
      ] }) : e.text }, e.id);
    }) }) }) })
  ] });
}
function EntrypointGroup({ entry }) {
  const [open, setOpen] = useState14(false);
  const [noiseOpen, setNoiseOpen] = useState14(false);
  const children = entry.children ?? [];
  const infoItems = children.filter((c) => c.type === "entrypoint-info");
  const okItems = children.filter((c) => c.type === "entrypoint-ok");
  const fatalItems = children.filter((c) => c.type === "entrypoint-fatal");
  const noiseItems = children.filter((c) => c.type === "raw" || c.type === "warning");
  const hasFatal = fatalItems.length > 0;
  return /* @__PURE__ */ jsxs12("div", { className: `ep-group ${open ? "open" : ""}${hasFatal ? " ep-group-error" : ""}`, children: [
    /* @__PURE__ */ jsxs12("div", { className: "ep-group-header", onClick: () => setOpen(!open), children: [
      /* @__PURE__ */ jsx13("span", { className: "ep-group-chevron", children: "\u203A" }),
      /* @__PURE__ */ jsx13("span", { className: "ep-group-title", children: entry.text }),
      infoItems.length > 0 && /* @__PURE__ */ jsx13("span", { className: "ep-group-meta", children: infoItems.map((i) => /* @__PURE__ */ jsxs12("span", { className: "ep-group-meta-item", children: [
        /* @__PURE__ */ jsxs12("span", { className: "ep-group-meta-key", children: [
          i.detail,
          ":"
        ] }),
        " ",
        i.text
      ] }, i.id)) }),
      /* @__PURE__ */ jsx13("span", { className: "ep-group-summary", children: hasFatal ? "\u26A0 setup failed" : `${okItems.length} steps \u2713` })
    ] }),
    /* @__PURE__ */ jsx13("div", { className: "ep-group-body-wrap", children: /* @__PURE__ */ jsxs12("div", { className: "ep-group-body", children: [
      infoItems.length > 0 && /* @__PURE__ */ jsx13("div", { className: "ep-info-card", children: infoItems.map((i) => /* @__PURE__ */ jsxs12("div", { className: "ep-info", children: [
        /* @__PURE__ */ jsxs12("span", { className: "ep-info-key", children: [
          i.detail,
          ":"
        ] }),
        " ",
        i.text
      ] }, i.id)) }),
      fatalItems.map((c) => /* @__PURE__ */ jsx13(LogLine, { entry: c }, c.id)),
      okItems.map((c) => /* @__PURE__ */ jsx13(LogLine, { entry: c }, c.id)),
      noiseItems.length > 0 && /* @__PURE__ */ jsxs12("div", { className: `ep-noise-group ${noiseOpen ? "open" : ""}`, children: [
        /* @__PURE__ */ jsxs12("div", { className: "ep-noise-header", onClick: (e) => {
          e.stopPropagation();
          setNoiseOpen((v) => !v);
        }, children: [
          /* @__PURE__ */ jsx13("span", { className: "ep-group-chevron", children: "\u203A" }),
          /* @__PURE__ */ jsx13("span", { className: "ep-noise-title", children: "Setup details" }),
          /* @__PURE__ */ jsxs12("span", { className: "ep-group-summary", children: [
            noiseItems.length,
            " lines"
          ] })
        ] }),
        /* @__PURE__ */ jsx13("div", { className: "ep-group-body-wrap", children: /* @__PURE__ */ jsx13("div", { className: "ep-group-body", children: noiseItems.map((c) => /* @__PURE__ */ jsx13(LogLine, { entry: c }, c.id)) }) })
      ] })
    ] }) })
  ] });
}

// src/ui/components/AgentProfileModal.tsx
import { useEffect as useEffect9, useRef as useRef8 } from "react";
import { jsx as jsx14, jsxs as jsxs13 } from "react/jsx-runtime";
var ELDER_FUTHARK = "\u16A0 \u16A2 \u16A6 \u16A8 \u16B1 \u16B2 \u16B7 \u16B9 \u16BA \u16BE \u16C1 \u16C3 \u16C7 \u16C8 \u16C9 \u16CA \u16CF \u16D2 \u16D6 \u16D7 \u16DA \u16DC \u16DE \u16DF";
function AgentProfileModal({ agentKey, theme, onClose }) {
  const closeButtonRef = useRef8(null);
  const backdropRef = useRef8(null);
  const name = AGENT_NAMES[agentKey] ?? agentKey;
  const title = AGENT_TITLES[agentKey] ?? "";
  const runes = AGENT_RUNE_NAMES[agentKey] ?? AGENT_RUNE_NAMES._fallback ?? "";
  const quote = AGENT_QUOTES[agentKey] ?? AGENT_QUOTES._fallback ?? "";
  const description = AGENT_DESCRIPTIONS[agentKey] ?? "";
  const accent = AGENT_COLORS[agentKey] ?? "var(--gold)";
  const primaryVariant = theme === "light" ? "light" : "dark";
  const portrait = avatarUrl(agentKey, primaryVariant) ?? avatarUrl(agentKey, primaryVariant === "light" ? "dark" : "light");
  useEffect9(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  useEffect9(() => {
    closeButtonRef.current?.focus();
  }, []);
  useEffect9(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose();
  }
  function handleModalKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      closeButtonRef.current?.focus();
    }
  }
  return /* @__PURE__ */ jsx14(
    "div",
    {
      className: "apm-backdrop",
      ref: backdropRef,
      onClick: handleBackdropClick,
      "aria-label": "Agent profile backdrop",
      children: /* @__PURE__ */ jsxs13(
        "div",
        {
          className: "apm-shell",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "apm-agent-name",
          onKeyDown: handleModalKeyDown,
          style: { "--agent-accent": accent },
          children: [
            /* @__PURE__ */ jsx14(
              "button",
              {
                ref: closeButtonRef,
                className: "apm-close",
                "aria-label": "Close agent profile",
                onClick: onClose,
                children: "\u2715"
              }
            ),
            /* @__PURE__ */ jsxs13("div", { className: "apm-body", children: [
              /* @__PURE__ */ jsx14("div", { className: "apm-rune-band", "aria-hidden": "true", children: ELDER_FUTHARK }),
              /* @__PURE__ */ jsx14("div", { className: "apm-portrait-zone", children: portrait ? /* @__PURE__ */ jsx14(
                "img",
                {
                  className: "apm-portrait",
                  src: portrait,
                  alt: name
                }
              ) : /* @__PURE__ */ jsx14("div", { className: "apm-portrait apm-portrait-placeholder", "aria-label": name, children: name.charAt(0) }) }),
              /* @__PURE__ */ jsxs13("div", { className: "apm-identity", children: [
                /* @__PURE__ */ jsx14(
                  "div",
                  {
                    className: "apm-agent-name",
                    id: "apm-agent-name",
                    style: { color: accent },
                    children: name
                  }
                ),
                /* @__PURE__ */ jsx14("div", { className: "apm-agent-title", children: title }),
                runes && /* @__PURE__ */ jsx14(
                  "div",
                  {
                    className: "apm-rune-sig",
                    "aria-label": `Rune signature: ${name}`,
                    children: runes
                  }
                )
              ] }),
              quote && /* @__PURE__ */ jsx14("div", { className: "apm-quote", children: /* @__PURE__ */ jsxs13("p", { children: [
                "\u201C",
                quote,
                "\u201D"
              ] }) }),
              description && /* @__PURE__ */ jsx14("div", { className: "apm-description", children: /* @__PURE__ */ jsx14("p", { children: description }) }),
              /* @__PURE__ */ jsx14("div", { className: "apm-rune-band apm-rune-band--bottom", "aria-hidden": "true", children: ELDER_FUTHARK })
            ] })
          ]
        }
      )
    }
  );
}

// src/ui/components/RagnarokDialog.tsx
import { useEffect as useEffect10, useRef as useRef9, useState as useState15 } from "react";
import { jsx as jsx15, jsxs as jsxs14 } from "react/jsx-runtime";
function RagnarokDialog({ sessionId, jobTitle, onConfirm, onCancel }) {
  const [isLoading, setIsLoading] = useState15(false);
  const [error, setError] = useState15(null);
  const confirmRef = useRef9(null);
  const cancelRef = useRef9(null);
  useEffect10(() => {
    cancelRef.current?.focus();
  }, []);
  useEffect10(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !isLoading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLoading, onCancel]);
  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setIsLoading(false);
    }
  };
  return /* @__PURE__ */ jsx15(
    "div",
    {
      className: "rdk-backdrop",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "rdk-title",
      "aria-describedby": "rdk-body",
      onClick: (e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      },
      children: /* @__PURE__ */ jsxs14("div", { className: "rdk-shell", children: [
        /* @__PURE__ */ jsx15("div", { className: "rdk-rune-band", "aria-hidden": "true", children: "\u16B1\u16A8\u16B7\u16BE\u16A8\u16B1\u16DF\u16B2 \u16CA\u16A2\u16D7\u16D7\u16A2\u16BE\u16CA \u16C1\u16CA \u16BE\u16C1\u16B7\u16BA" }),
        /* @__PURE__ */ jsxs14("div", { className: "rdk-header", children: [
          /* @__PURE__ */ jsx15("span", { className: "rdk-sword-icon", "aria-hidden": "true", children: "\u2694\uFE0F" }),
          /* @__PURE__ */ jsx15("h2", { id: "rdk-title", className: "rdk-title", children: "Invoke Ragnar\xF6k?" })
        ] }),
        /* @__PURE__ */ jsxs14("div", { className: "rdk-body", id: "rdk-body", children: [
          /* @__PURE__ */ jsx15("p", { className: "rdk-body-text", children: "You are about to sever this thread from the Nornir's loom. This agent's saga will end \u2014 no Valhalla awaits a cancelled job. This cannot be undone." }),
          /* @__PURE__ */ jsxs14("div", { className: "rdk-job-label", "aria-label": "Job to be cancelled", children: [
            /* @__PURE__ */ jsx15("span", { className: "rdk-job-label-icon", "aria-hidden": "true", children: "\u263D" }),
            /* @__PURE__ */ jsx15("span", { className: "rdk-job-label-text", children: jobTitle })
          ] }),
          /* @__PURE__ */ jsx15("div", { className: "rdk-session-id", "aria-label": "Session ID", children: sessionId })
        ] }),
        error && /* @__PURE__ */ jsxs14("div", { className: "rdk-error", role: "alert", children: [
          /* @__PURE__ */ jsx15("span", { "aria-hidden": "true", children: "\u2715" }),
          " ",
          error
        ] }),
        /* @__PURE__ */ jsxs14("div", { className: "rdk-actions", children: [
          /* @__PURE__ */ jsx15(
            "button",
            {
              ref: cancelRef,
              className: "rdk-btn rdk-btn--cancel",
              onClick: onCancel,
              disabled: isLoading,
              "aria-label": "Stay the Hand of Fate \u2014 keep job running",
              children: "Stay the Hand of Fate"
            }
          ),
          /* @__PURE__ */ jsx15(
            "button",
            {
              ref: confirmRef,
              className: "rdk-btn rdk-btn--confirm",
              onClick: handleConfirm,
              disabled: isLoading,
              "aria-label": "Unleash Ragnar\xF6k \u2014 permanently cancel this job",
              children: isLoading ? /* @__PURE__ */ jsxs14("span", { className: "rdk-loading-text", children: [
                /* @__PURE__ */ jsx15("span", { className: "rdk-spinner", "aria-hidden": "true" }),
                "Severing the thread\u2026"
              ] }) : "Unleash Ragnar\xF6k"
            }
          )
        ] }),
        /* @__PURE__ */ jsx15("div", { className: "rdk-rune-band rdk-rune-band--bottom", "aria-hidden": "true", children: "\u16A0\u16D6\u16BE\u16B1\u16C1\u16B1 \u16B9\u16A8\u16CF\u16B2\u16BA\u16D6\u16CA \u16A6\u16D6 \u16B9\u16DF\u16DA\u16A0 \u16B9\u16A8\u16CF\u16B2\u16BA\u16D6\u16CA" })
      ] })
    }
  );
}

// src/ui/components/Toast.tsx
import { useEffect as useEffect11, useState as useState16 } from "react";
import { jsx as jsx16, jsxs as jsxs15 } from "react/jsx-runtime";
function Toast({ message, onDismiss, duration = 4e3 }) {
  const [exiting, setExiting] = useState16(false);
  useEffect11(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration - 400);
    const dismissTimer = setTimeout(onDismiss, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);
  return /* @__PURE__ */ jsxs15(
    "div",
    {
      className: `toast${exiting ? " toast--exit" : ""}`,
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
      children: [
        /* @__PURE__ */ jsx16("span", { className: "toast-rune", "aria-hidden": "true", children: "\u2694\uFE0F" }),
        /* @__PURE__ */ jsx16("span", { className: "toast-message", children: message }),
        /* @__PURE__ */ jsx16(
          "button",
          {
            className: "toast-close",
            onClick: () => {
              setExiting(true);
              setTimeout(onDismiss, 400);
            },
            "aria-label": "Dismiss notification",
            children: "\u2715"
          }
        )
      ]
    }
  );
}

// src/ui/components/ErrorBanner.tsx
import { jsxs as jsxs16 } from "react/jsx-runtime";
function ErrorBanner({ message }) {
  if (!message) return null;
  return /* @__PURE__ */ jsxs16("div", { className: `error-banner visible`, role: "alert", "aria-live": "assertive", children: [
    "\u26A0",
    " ",
    message
  ] });
}

// src/ui/components/Overlays.tsx
import { Fragment as Fragment6, jsx as jsx17, jsxs as jsxs17 } from "react/jsx-runtime";
function ThroneOverlays() {
  const snap = useThrone();
  if (!snap) return null;
  return /* @__PURE__ */ jsxs17(Fragment6, { children: [
    /* @__PURE__ */ jsx17(ErrorBanner, { message: snap.wsError }),
    snap.storageWarning && /* @__PURE__ */ jsx17(ErrorBanner, { message: snap.storageWarning }),
    snap.profileAgent && /* @__PURE__ */ jsx17(
      AgentProfileModal,
      {
        agentKey: snap.profileAgent,
        theme: snap.theme,
        onClose: () => snap.setProfileAgent(null)
      }
    ),
    snap.cancelTarget && /* @__PURE__ */ jsx17(
      RagnarokDialog,
      {
        sessionId: snap.cancelTarget.sessionId,
        jobTitle: snap.cancelTarget.jobTitle,
        onConfirm: snap.confirmCancel,
        onCancel: () => snap.setCancelTarget(null)
      }
    ),
    snap.toast && /* @__PURE__ */ jsx17(
      Toast,
      {
        message: snap.toast.message,
        onDismiss: snap.dismissToast
      },
      snap.toast.id
    )
  ] });
}

// src/targets/web/AppShell.tsx
import { jsx as jsx18, jsxs as jsxs18 } from "react/jsx-runtime";
function SidebarSurface() {
  const snap = useThrone();
  return /* @__PURE__ */ jsx18(
    Sidebar,
    {
      jobs: snap.jobs,
      activeSessionId: snap.activeSessionId,
      quote: snap.quote,
      wsState: snap.wsState,
      onSelectSession: snap.onSelectSession,
      onAvatarClick: snap.onAvatarClick,
      onOdinClick: snap.onOdinClick,
      onTogglePinSession: snap.onTogglePinSession,
      pinnedSessionIds: snap.pinnedSessionIds,
      onCancelJob: snap.onCancelJob,
      terminatingSessionIds: snap.terminatingSessionIds,
      namespace: snap.namespace,
      namespaces: snap.namespaces,
      onNamespaceChange: snap.setNamespace,
      namespaceSummaries: snap.namespaceSummaries,
      onSelectTask: snap.onSelectTask
    }
  );
}
function LogViewerSurface() {
  const snap = useThrone();
  return /* @__PURE__ */ jsx18(
    LogViewer,
    {
      entries: snap.entries,
      activeJob: snap.activeJob,
      isFixture: snap.isFixture,
      isTtlExpired: snap.isTtlExpired,
      isNodeUnreachable: snap.isNodeUnreachable,
      streamError: snap.streamError,
      isPinned: snap.isPinned,
      onTogglePin: snap.onTogglePin,
      onAvatarClick: snap.onAvatarClick,
      replayedFromCache: snap.replayedFromCache,
      isConnecting: snap.isConnecting,
      isPodStarting: snap.isPodStarting,
      onCancelJob: snap.onCancelJob,
      onSetSpeed: snap.onSetSpeed
    }
  );
}
function AppShell() {
  const snap = useThrone();
  const bridge = useMemo3(() => /* @__PURE__ */ jsx18(App, {}), []);
  return /* @__PURE__ */ jsxs18(
    "div",
    {
      className: "odins-throne-root",
      style: { width: "100vw", height: "100vh", display: "flex", flexDirection: "column" },
      children: [
        bridge,
        snap ? /* @__PURE__ */ jsxs18("div", { className: "layout", children: [
          /* @__PURE__ */ jsx18(ErrorBoundary, { children: /* @__PURE__ */ jsx18(SidebarSurface, {}) }),
          /* @__PURE__ */ jsx18(ErrorBoundary, { children: /* @__PURE__ */ jsx18(LogViewerSurface, {}) })
        ] }) : /* @__PURE__ */ jsx18(
          "div",
          {
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-rune)",
              fontStyle: "italic",
              fontSize: "0.8rem",
              padding: "1rem"
            },
            children: "Awakening the Allfather\u2026"
          }
        ),
        /* @__PURE__ */ jsx18(ThroneOverlays, {})
      ]
    }
  );
}

// src/targets/web/main.tsx
import { jsx as jsx19 } from "react/jsx-runtime";
setPlatform(webPlatform);
webPlatform.applyTheme(currentTheme());
var rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(/* @__PURE__ */ jsx19(AppShell, {}));
}
