# Deployment (GKE)

GKE Autopilot (fenrir-ledger-prod, us-central1). Helm chart `odin-throne` (fenrir-ledger
infrastructure/helm), namespace fenrir-monitor, 2 replicas. Image: Artifact Registry
us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/odin-throne. Ingress + global IP +
Cloud DNS A record (odins-throne.fenrirledger.com), behind oauth2-proxy with the shared
"odin-throne" Google Web client; --skip-auth-route /bot/* + /healthz; user identity via
x-forwarded-user. Secrets: ODINS_THRONE_BOT_TOKEN, ODINS_THRONE_HANDOFF_SECRET, client id/secret,
per-host cookie secret. CI: fenrir-ledger deploy.yml (fail-closed guards on both secrets).

shanaghy.com DNS is on Namecheap NS — records there are API/manual steps, not Terraform.

## Namecheap DNS — replace-all rule and setHosts safety

`namecheap.domains.dns.setHosts` **replaces the complete zone host list** in one call.
Any record absent from the call is permanently deleted. `scripts/dns.sh` performs a
merge-safe setHosts: it calls `getHosts`, parses the existing records, and rebuilds the
full list with the target record inserted or updated.

**Empty-merge guard (added 2026-11-03, issue #42):** after parsing `getHosts` XML, if
the raw response contains `<Host>` elements but the parsed list is empty, the script
aborts (exit 1) and prints the raw XML. This prevents a silent-empty-merge from sending
a one-record setHosts call that would nuke all other zone records.

### 2026-11-03 DNS incident

At 16:59:07 UTC the shanaghy.com zone was rewritten with only `odins-throne.shanaghy.com`.
`www` (CNAME → GitHub Pages) and `gke` (A → 136.81.14.206) were deleted.
Root cause: `scripts/dns.sh`'s awk host-list parser produced an empty list from the
getHosts response (likely attribute-order mismatch in the XML), so setHosts was called
with only the new record. The zone was restored out-of-band. The empty-merge guard
prevents recurrence.
