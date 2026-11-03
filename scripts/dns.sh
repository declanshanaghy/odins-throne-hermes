#!/usr/bin/env bash
# --------------------------------------------------------------------------
# Odin's Throne — Namecheap DNS A-record manager (idempotent create-or-verify)
#
# Creates (or verifies) the A record:
#   odins-throne.shanaghy.com -> <reserved global IP odins-throne-hall-ip>
#
# Idempotent: if the record already exists with the correct value — in public
# DNS or in the Namecheap zone — the script reports it and makes no API write.
# If it exists with a different value, the record is UPDATED to the target.
#
# Environment:
#   NAMECHEAP_API_USER    Namecheap API username (repo secret)
#   NAMECHEAP_API_KEY     Namecheap API key (repo secret)
#   NAMECHEAP_CLIENT_IP   Whitelisted client IP the API requires (optional;
#                         auto-detected via api.ipify.org when unset)
#   ODINS_THRONE_IP       Target IPv4 (or pass --ip)
#
# Usage:
#   scripts/dns.sh --ip <IPv4>            # create/verify for real
#   scripts/dns.sh --ip <IPv4> --dry-run  # plan only, no API writes
#
# Exit codes:
#   0  success (created, verified, or already correct)
#   1  usage / precondition error
#   2  Namecheap API error
#   3  DNS propagation verification timed out
# --------------------------------------------------------------------------
set -euo pipefail

DOMAIN_SLD="shanaghy"
DOMAIN_TLD="com"
HOST_NAME="odins-throne"
TARGET_IP="${ODINS_THRONE_IP:-}"
DRY_RUN=0
API_USER="${NAMECHEAP_API_USER:-}"
API_KEY="${NAMECHEAP_API_KEY:-}"
CLIENT_IP="${NAMECHEAP_CLIENT_IP:-}"
API_BASE="https://api.namecheap.com/xml.response"

log() { printf '[dns.sh] %s\n' "$*"; }
die() { local code="$1"; shift; printf '[dns.sh] ERROR: %s\n' "$*" >&2; exit "$code"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --ip) [ "${2:-}" ] || die 1 "--ip requires a value"; TARGET_IP="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --domain) [ "${2:-}" ] || die 1 "--domain requires sld.tld"; DOMAIN_SLD="${2%%.*}"; DOMAIN_TLD="${2##*.}"; shift 2 ;;
    --host) [ "${2:-}" ] || die 1 "--host requires a value"; HOST_NAME="$2"; shift 2 ;;
    -h|--help) sed -n '2,29p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die 1 "unknown argument: $1 (see --help)" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die 1 "curl is required but not installed"

FQDN="${HOST_NAME}.${DOMAIN_SLD}.${DOMAIN_TLD}"
[ -n "$TARGET_IP" ] || die 1 "target IP missing — pass --ip <IPv4> or set ODINS_THRONE_IP"
log "target record : A ${FQDN} -> ${TARGET_IP}"

# ---- Current public DNS state (read-only via DNS-over-HTTPS, no dig needed)
current_a_records() {
  curl -fsS --max-time 15 "https://dns.google/resolve?name=${FQDN}&type=A" 2>/dev/null \
    | tr ',' '\n' \
    | sed -n 's/.*"data":"\([0-9][0-9.]*\)".*/\1/p' \
    | sort -u \
    | tr '\n' ' ' | sed 's/ $//'
}

a_now="$(current_a_records)"
if [ -n "$a_now" ]; then
  log "current DNS   : ${a_now}"
  case " ${a_now} " in
    *" ${TARGET_IP} "*)
      log "record exists with correct value (${FQDN} -> ${TARGET_IP}) — nothing to do"
      exit 0
      ;;
  esac
else
  log "current DNS   : no A record for ${FQDN} (NXDOMAIN — clean insert)"
fi

# ---- Namecheap API helpers -------------------------------------------------
nc_call() {
  # $1 = Command, remaining args = extra query params ("key=value" strings)
  local command="$1"; shift
  [ -n "$API_USER" ] && [ -n "$API_KEY" ] \
    || die 1 "NAMECHEAP_API_USER / NAMECHEAP_API_KEY not set (repo secret NAMECHEAP_API_USER is pending)"
  if [ -z "$CLIENT_IP" ]; then
    CLIENT_IP="$(curl -fsS --max-time 10 https://api.ipify.org)" \
      || die 1 "could not auto-detect client IP for the Namecheap API (set NAMECHEAP_CLIENT_IP)"
  fi
  local -a args=(
    --data-urlencode "ApiUser=${API_USER}"
    --data-urlencode "ApiKey=${API_KEY}"
    --data-urlencode "UserName=${API_USER}"
    --data-urlencode "Command=${command}"
    --data-urlencode "ClientIp=${CLIENT_IP}"
  )
  local p
  for p in "$@"; do args+=(--data-urlencode "$p"); done
  curl -fsS --max-time 30 -G "$API_BASE" "${args[@]}"
}

# Pass Namecheap XML on stdin; exit 2 on a real API error (the always-present
# empty <Errors/> wrapper is fine; a populated <Error .../> element is not).
check_api_ok() {
  local xml
  xml="$(cat)"
  if printf '%s' "$xml" | grep -Eq '<Error[ />]'; then
    die 2 "Namecheap API error: $(printf '%s' "$xml" | grep -Eo '<Error[^>]*>' | head -3 | tr '\n' ' ')"
  fi
  printf '%s' "$xml"
}

nc_get_hosts() {
  nc_call namecheap.domains.dns.getHosts "SLD=${DOMAIN_SLD}" "TLD=${DOMAIN_TLD}" | check_api_ok
}

# ---- Decide the action from the authoritative Namecheap zone ----------------
have_creds=1
if [ -z "$API_USER" ] || [ -z "$API_KEY" ]; then
  have_creds=0
  log "Namecheap creds: MISSING — cannot query the zone (repo secret NAMECHEAP_API_USER is pending)"
  action="create/verify A ${FQDN} -> ${TARGET_IP} (zone state unknown)"
  zone_xml=""
else
  zone_xml="$(nc_get_hosts)"
  # One <Host .../> element per zone record; find ours.
  existing_addr="$(printf '%s' "$zone_xml" \
    | sed 's/</\n</g' \
    | grep -i "^<Host .*Name=\"${HOST_NAME}\"" \
    | grep -i 'RecordType="A"' \
    | sed -n 's/.*Address="\([0-9.]*\)".*/\1/p' | head -1 || true)"
  if [ "$existing_addr" = "$TARGET_IP" ]; then
    log "record exists with correct value in the Namecheap zone (awaiting propagation)"
    action="none (awaiting DNS propagation)"
  elif [ -n "$existing_addr" ]; then
    log "record exists with WRONG value (${existing_addr}) in the Namecheap zone"
    action="UPDATE A ${FQDN}: ${existing_addr} -> ${TARGET_IP}"
  else
    log "record absent from the Namecheap zone"
    action="CREATE A ${FQDN} -> ${TARGET_IP}"
  fi
fi

if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY RUN — planned action: ${action}"
  log "prereqs: NAMECHEAP_API_USER=${API_USER:+set}${API_USER:-MISSING}  NAMECHEAP_API_KEY=${API_KEY:+set}${API_KEY:-MISSING}  target IP=${TARGET_IP}"
  log "no changes made"
  exit 0
fi

[ "$have_creds" -eq 1 ] || die 1 "cannot proceed without Namecheap credentials (rerun once NAMECHEAP_API_USER is set)"

# A correct record already in the zone just needs propagation time.
[ "$action" = "none (awaiting DNS propagation)" ] && action="none"

# ---- Real write: namecheap.domains.dns.setHosts ----------------------------
# setHosts REPLACES the whole host list for the domain, so rebuild the zone
# from getHosts, inserting/updating only our record, and send everything back.
if [ "$action" != "none" ]; then
  # Flat list: name|type|address|ttl per existing zone record.
  hosts_list="$(printf '%s' "$zone_xml" \
    | sed 's/</\n</g' \
    | grep '^<Host ' \
    | sed -e 's/^<Host //' -e 's/ *\/>$//' \
    | tr ' ' '\n' \
    | awk -F'"' '
        /^Name=/       {name=$2}
        /^RecordType=/{type=$2}
        /^Address=/   {addr=$2}
        /^TTL=/       {ttl=$2; print name "|" type "|" addr "|" (ttl==""?"1800":ttl)}
      ' || true)"

  params=()
  n=0
  found=0
  while IFS='|' read -r name type addr ttl; do
    [ -n "$name" ] || continue
    n=$((n+1))
    if [ "$name" = "$HOST_NAME" ] && [ "$type" = "A" ]; then
      found=1; addr="$TARGET_IP"
    fi
    params+=("HostName${n}=${name}" "RecordType${n}=${type}" "Address${n}=${addr}" "TTL${n}=${ttl:-1800}")
  done <<EOF
$hosts_list
EOF

  if [ "$found" -eq 0 ]; then
    n=$((n+1))
    params+=("HostName${n}=${HOST_NAME}" "RecordType${n}=A" "Address${n}=${TARGET_IP}" "TTL${n}=1800")
  fi

  log "calling namecheap.domains.dns.setHosts with ${n} host records (inserting/updating ${HOST_NAME})"
  nc_call namecheap.domains.dns.setHosts "SLD=${DOMAIN_SLD}" "TLD=${DOMAIN_TLD}" "${params[@]}" | check_api_ok >/dev/null
  log "Namecheap setHosts OK"
fi

# ---- Verify propagation ----------------------------------------------------
log "waiting for public DNS to answer ${FQDN} -> ${TARGET_IP} (max 300s)"
for _ in $(seq 1 30); do
  sleep 10
  a_now="$(current_a_records)"
  case " ${a_now} " in
    *" ${TARGET_IP} "*)
      log "VERIFIED: ${FQDN} -> ${TARGET_IP} is live in public DNS"
      exit 0
      ;;
  esac
  log "  not yet propagated (saw: ${a_now:-none})"
done
die 3 "DNS verification timed out after 300s — check the Namecheap zone in the dashboard"
