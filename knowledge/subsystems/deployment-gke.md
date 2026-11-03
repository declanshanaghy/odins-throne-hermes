# Deployment (GKE)

GKE Autopilot (fenrir-ledger-prod, us-central1). Helm chart `odin-throne` (fenrir-ledger
infrastructure/helm), namespace fenrir-monitor, 2 replicas. Image: Artifact Registry
us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/odin-throne. Ingress + global IP +
Cloud DNS A record (odins-throne.fenrirledger.com), behind oauth2-proxy with the shared
"odin-throne" Google Web client; --skip-auth-route /bot/* + /healthz; user identity via
x-forwarded-user. Secrets: ODINS_THRONE_BOT_TOKEN, ODINS_THRONE_HANDOFF_SECRET, client id/secret,
per-host cookie secret. CI: fenrir-ledger deploy.yml (fail-closed guards on both secrets).

shanaghy.com DNS is on Namecheap NS — records there are API/manual steps, not Terraform.
