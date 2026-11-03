# The monitor service

Hono server (server/, migrated as-is from fenrir-ledger development/odins-throne/src/): index.ts (REST + static UI + pairing
page; static dir configurable via WEB_DIST, default dist-ui), k8s.ts (in-cluster Kube client: job watch, log streaming; job-name protocol
`agent-${sessionId}` + `fenrir.dev/session-id` + `fenrir/pr-title` labels — the shared cluster's
dispatch convention), ws.ts (WS hub: jobs-snapshot/jobs-updated, subscribe/log-line/verdict,
20s heartbeat vs LB 30s idle, /bot/ws via ?token=), handoff.ts (pairing keys), botToken.ts
(static bot gate), report.ts (parseJsonlLine/detectVerdict → WS verdict;
generateReportHtml is an unrouted dead export).
