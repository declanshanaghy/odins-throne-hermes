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

**Hard-abort guard (added 2026-11-03, hardened 2026-11-04 issue #88):** after parsing
`getHosts` XML, if the raw response contains `<host>` elements (case-insensitive) but
the parsed list is empty, the script aborts (exit 1) and prints the raw XML. This
prevents a silent-empty-merge from sending a one-record setHosts call that would nuke
all other zone records.

### 2026-11-03 DNS incident

At 16:59:07 UTC the shanaghy.com zone was rewritten with only `odins-throne.shanaghy.com`.
`www` (CNAME → GitHub Pages) and `gke` (A → 136.81.14.206) were deleted.
Root cause: `scripts/dns.sh`'s getHosts parser used `grep '^<Host '` (capital H) and
`RecordType=` attribute, but the Namecheap API returns lowercase `<host>` elements with
a `Type=` attribute (not `RecordType=`). The parser produced an empty list; the
empty-merge guard also used capital-H grep so its raw count was 0 too — the guard was
blind and setHosts was called with a one-record list, deleting all other records. Zone
was restored out-of-band.

### 2026-11-04 DNS incident (recurrence)

At ~10:10 UTC during issue #86 post-merge verification, a fresh
`dns.sh --ip 136.81.14.206` run again parsed 0 hosts (same root cause: element/attribute
casing mismatch), called setHosts with 1 record, and deleted the apex A/AAAA quads,
`www`, `gke`, `mytruthfinder`, and the `_acme-challenge.mytruthfinder` CNAME. The full
zone (13 records) was restored at ~10:30 UTC.

**Root cause (corrected):** Namecheap's XML uses lowercase `<host>` elements with
`Name=`, `Type=`, `Address=` attributes. The script expected capital `<Host>` and
`RecordType=`. Both the host-list parser and the empty-merge guard grep were blind to
the real XML. Fixed in issue #88: `parse_hosts_xml()` normalises element casing and
handles both `Type=` and `RecordType=`; guard grep uses `-ci` for case-insensitive
matching.
