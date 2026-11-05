# The two halls

- **Old hall** — https://odins-throne.fenrirledger.com : the monitor as a fenrir-ledger
  development app (development/odins-throne), Helm chart `odin-throne`, namespace fenrir-monitor.
  **Dead** since the exodus epic: DNS still resolves but the LB is decommissioned — connections
  fail. Panes whose upstream override still points here render every realm as
  "summary unavailable" (issue #23 fixed the default, but localStorage overrides win).
- **New hall** — https://odins-throne.shanaghy.com : the promoted first-class service living in
  this repo. The only hall; the plugin's DEFAULT_UPSTREAM_URL points here.

Duplicate-first rule: the new hall reached full parity across all five surfaces (job list, live
WS logs, pairing/handoff, report surface, botToken) before the old hall's funeral — the shared
handoff secret means pairing sessions minted against the old hall still verify here.
