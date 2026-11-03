# Sandbox Preamble — Shared Block

Compose this into every agent prompt, immediately after the role line.

```
SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo — hardcoded, no discovery needed.
- Each Bash tool call = fresh shell. ALWAYS prefix: cd /workspace/repo && <command>
- Set timeout: 600000 (10 min) on long-running commands (E2E runs, builds).
- The entrypoint already handled: git clone, branch checkout, dependency install (the repo's package manager), git identity.

**Step 1 — Verify environment (quick sanity check):**
cd /workspace/repo && git branch --show-current && node -v && ls package.json 2>/dev/null || find . -maxdepth 3 -name package.json -not -path '*/node_modules/*'

**Step 1a — Recover sandbox credentials into your shell (harness shells may not inherit PID 1's env — observed on hermes):**
Newer sandbox images wire credentials file-based (git helper + gh login read
`/workspace/.secrets/gh-token`), so this step is usually redundant — run `gh auth status`
or `git push --dry-run` first and skip ahead if auth already works.
`GH_TOKEN` is always present in the pod's PID 1 environment, but your terminal
shells may start without it. If `test -z "$GH_TOKEN"` in your shell, recover it
from PID 1 — never print it, never ask for a new one:
  cd /workspace/repo && export GH_TOKEN="$(tr '\0' '\n' < /proc/1/environ | grep '^GH_TOKEN=' | cut -d= -f2-)" && test -n "$GH_TOKEN" && echo "[ok] GH_TOKEN recovered"
Do this BEFORE the first push, PR creation, or gh command. If the recovery
fails (empty), post a comment on the issue and stop — do NOT claim DONE.
If Playwright tests are needed:
  cd /workspace/repo && npx playwright install chromium 2>/dev/null || true
  # If the repo's quality/ scripts expect the app's node_modules, symlink them per the repo's convention.

**Step 1b — Check for prior work on this branch (UNBREAKABLE):**
cd /workspace/repo && git fetch origin && git log origin/main..HEAD --oneline
If commits exist beyond main:
  - A previous agent session already did work on this branch.
  - Read ALL changed files: cd /workspace/repo && git diff origin/main --name-only
  - Read each changed file before writing a single line of new code.
  - Understand what was already implemented, then continue from where it left off.
  - DO NOT rewrite or redo work that is already committed. Pick up from the current state.
If no commits beyond main: branch is fresh, proceed with full implementation.

TODO TRACKING (UNBREAKABLE):
Track todos with your harness's todo tool (Claude Code: TodoWrite; Hermes: your
todo tools). Create todos at the START of the session covering every numbered step.
Update each todo to in_progress when you start it and completed when you're done.
This is your progress ledger — if the session dies, the todo state shows exactly
where you stopped.

INCREMENTAL COMMIT + VERIFY LOOP (UNBREAKABLE):
After every logical chunk of implementation work (~5-10 min or 1-3 files changed):
  1. cd /workspace/repo && git add -A && git commit -m 'wip: <what> — issue:<NUMBER>' && git push origin <BRANCH>
  2. cd /workspace/repo && run the repo's typecheck entrypoint (justfile / package.json scripts / Makefile)
  3. If the typecheck fails: fix immediately, commit+push, re-run.
  4. Update your todo progress.
Do NOT batch all changes into one commit at the end. Sessions can die at any time —
uncommitted work is lost work.

VERIFY — typecheck + build + unit tests (UNBREAKABLE):
All agents run typecheck, build, AND the full unit test suite before handoff.
Do NOT run E2E tests — unit/integration only. E2E runs via CI.
  cd /workspace/repo && run the repo's typecheck entrypoint (justfile / package.json scripts / Makefile)
  cd /workspace/repo && run the repo's build entrypoint (justfile / package.json scripts / Makefile)
  cd /workspace/repo && run the repo's unit test entrypoint (justfile / package.json scripts / Makefile)
On failure: fix, commit+push, re-run that step. Repeat until green.
Do NOT proceed to handoff with ANY failing tests.
**All verify steps MUST run in the foreground (blocking).** NEVER use `run_in_background`
for typecheck, build, or test commands. You MUST confirm each step passes before proceeding
to the next step or to merge/handoff. Background verify = unverified merge = bug.

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.

CHAIN CONTINUATION (UNBREAKABLE — YOUR SESSION IS NOT DONE WITHOUT THIS):
⚠️ The LAST thing you do before your session ends MUST be chain continuation handling.
⚠️ If you skip this, the next agent never fires and the issue stalls indefinitely.
⚠️ Posting the handoff comment is NOT the end — chain continuation IS the end.

Your ENVIRONMENT decides who continues the chain (harness-native, no translation):
- **GKE sandbox** (REPO_ROOT is /workspace/repo — no kubectl/cluster dispatch access):
  the ORCHESTRATOR continues the chain. Your session ends with the handoff comment
  AND the final decree block — the decree is the machine-parsed signal the
  orchestrator (and Odin's Throne) watch to dispatch the next agent.
  Do NOT attempt /fire-next-up or /dispatch from inside the sandbox.
- **Local worktree** (you have cluster access): run the fire-next-up resume flow for
  #<NUMBER> as the ABSOLUTE LAST step — Claude Code: `/fire-next-up --resume #<NUMBER>`;
  Hermes: load the fire-next-up skill and run it with `--resume #<NUMBER>`.
  This dispatches the next agent in the chain on the same branch.
- Final agent (Loki): merge and close ONLY on a clean PASS verdict:
  `gh pr merge <PR_NUMBER> --squash --delete-branch && gh issue close <NUMBER>`
  (gh + GH_TOKEN are available in every environment, including GKE sandboxes.)
- If verdict is FAIL or any verify step failed: do NOT continue the chain.
  Stop immediately and leave the issue open for manual triage.
- Chain continuation is the ONLY authorized merge path — do not merge any other way.

YOUR TODO LIST MUST INCLUDE CHAIN CONTINUATION HANDLING AS THE FINAL TODO.
Mark it in_progress when you start it, completed when done.
```
