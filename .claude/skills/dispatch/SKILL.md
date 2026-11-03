---
name: dispatch
description: "Dispatch agents to GKE Autopilot K8s Jobs or local worktrees for GitHub issues. Use when the user says 'dispatch', 'spawn agent', 'send to GKE', or when /fire-next-up needs to spawn an agent. Supports parallel dispatch, agent selection, branch override, and prompt customization."
---

# Dispatch — Spawn Agents for GitHub Issues

## Environment Resolution (run first)

All orchestration skills operate on the *current repo* — nothing is project-hardcoded.
Resolve once per session:

```bash
PACK_SCRIPTS="$(git rev-parse --show-toplevel)/.claude/skills/fire-next-up/scripts"
eval "$(bash "$PACK_SCRIPTS/pack-env.sh")"   # exports OWNER, REPO, PROJECT, AGENTS_NS
```

- `AGENTS_NS` (K8s namespace for agent Jobs): `$PACK_NAMESPACE` env > `.claude/agents-namespace`
  file > `<repo-name>-agents` (this repo pins `odins-throne-hermes-agents` via `.claude/agents-namespace`).
- The GitHub Project board is discovered at runtime by `pack-status.mjs` (repo-linked project
  first, then the owner's user project; override with `PACK_PROJECT_NUMBER`).


Composes a prompt from templates and spawns the agent via GKE Autopilot K8s Jobs (default) or local worktree. No intermediate files.

## Speed Rules (UNBREAKABLE)

**Minimize tool calls.** Target: 2 calls per dispatch. No narration between calls.

1. **No separate path-resolution call.** Use the known repo root directly.
2. **No separate issue fetch if caller already has the data.** When `/fire-next-up` or `--resume` invokes `/dispatch`, the issue title, body, and labels are already in context — use them directly.
3. **No separate kubectl config check.** Let `dispatch-job.sh` fail if kubectl is not configured.
4. **No separate UUID call.** Generate inline: `$(uuidgen | cut -c1-8 | tr A-Z a-z)` inside the session ID.
5. **Sandbox preamble is embedded below** — never Read `sandbox-preamble.md`.
6. **Reuse agent templates from context.** If the same agent template was already read earlier in the session, do NOT read it again.
7. **No intermediate temp files.** `dispatch-job.sh` handles Job manifest generation internally.
8. **No step-by-step narration.** Only output the final dispatch report.
9. **Board move is MANDATORY after spawn succeeds.** Append it to the spawn command with `&&`.

**Ideal flow (2 tool calls per dispatch):**
```
Call 1: Read <agent>.md           (skip if already in context)
Call 2: bash dispatch-job.sh ... && node pack-status.mjs --move N in-progress
```

If issue data + agent template are already in context, that's **1 tool call** (spawn + board move).

**Loop mode (invoked from `/fire-next-up` default queue):** All issue data AND agent templates
were pre-fetched and pre-read in Phase 1 of the Multi-Issue Review Loop. Every dispatch in
loop mode is guaranteed to be **1 tool call** — no Read, no fetch, just spawn + board move.

## Arguments

| Arg/Flag | Required | Description |
|----------|----------|-------------|
| `#N [#M ...]` | Yes | Issue number(s) |
| `--agent <name>` | No | `firemandecko`, `luna`, `loki`, `heimdall`, `freya`. Inferred from labels if omitted. |
| `--step <N>` | No | Chain step (default: 1). For resume dispatches. |
| `--branch <name>` | No | Existing branch. If omitted, built from issue. |
| `--template <name>` | No | Override template mode (e.g., `loki-bounce-back` selects Loki Mode B). |
| `--local` | No | Local worktree instead of GKE. |
| `--parallel` | No | Dispatch multiple issues simultaneously. |
| `--prompt-extra <text>` | No | Extra context injected after issue body. |
| `--harness <claude\|hermes>` | No | Agent harness (default `claude`). Passed through to `dispatch-job.sh`. See Harness Selection. |
| `--spot` | No | Use Spot nodes (cheaper but preemptible). Default is on-demand — Spot is opt-in only. |
| `--dry-run` | No | Show composed prompt without spawning. |
| `--skip-board-move` | No | Don't move to In Progress. |

---

## Agent Model Mapping

| Agent | Remote (GKE) | Local (`--local`) |
|-------|--------------|-------------------|
| Luna | `claude-sonnet-4-6` | `sonnet` |
| FiremanDecko | `claude-sonnet-4-6` | `sonnet` |
| Freya | `claude-sonnet-4-6` | `sonnet` |
| Loki | `claude-sonnet-4-6` | `sonnet` |
| Heimdall | `claude-sonnet-4-6` | `sonnet` |

## Harness Selection (per issue)

| Source | Harness |
|--------|---------|
| Explicit `--harness <claude\|hermes>` flag | That harness (always wins) |
| Issue label `harness:hermes` | `--harness hermes` |
| Neither | `claude` (today's behavior) |

- `--harness hermes` sets `AGENT_RUNTIME=hermes` in the K8s Job: it runs the Hermes Agent CLI one-shot instead of Claude Code CLI, uses the `:hermes` image tag, and needs a `hermes-openrouter-key` entry in the project K8s secret.
- Hermes dispatches take a provider-native (OpenRouter) model ID — e.g. `z-ai/glm-5.3` — not the Claude Code IDs in the table above. `--model` is optional and best omitted: the default is `z-ai/glm-5.3` (anthropic's 5-hour rate limits), and the sandbox config falls back to `anthropic/claude-sonnet-4.6` when the primary fails. Only pass `--model` to override the primary.
- Sandbox credentials: agent-sandbox images built from odins-throne-hermes commit `03c2ff65` (2026-11-03) or later persist GH_TOKEN file-based (`/workspace/.secrets/gh-token`; git helper + `gh auth login` read it). On older images hermes tool shells don't inherit PID 1's env — a decree `DONE, PR: N/A` with a "no GitHub credentials" blocker means an old image, not a reason to re-dispatch step 1.

**Harness-native composition (UNBREAKABLE):** the agent templates and sandbox
preamble are harness-agnostic — compose the SAME template for `claude` and
`hermes` dispatches. Never hand-translate or rewrite a prompt for hermes; the
preamble carries per-environment wording (todo tool, chain continuation) that
both runtimes follow as-is. In a GKE sandbox the orchestrator — not the
sandboxed agent — continues the chain when the decree lands.

## Agent Inference (when `--agent` omitted)

| Label | Step 1 | Step 2 | Step 3 |
|-------|--------|--------|--------|
| `bug` | firemandecko | loki | -- |
| `enhancement` | firemandecko | loki | -- |
| `ux` | luna | firemandecko | loki |
| `security` | heimdall | loki | -- |
| `research` | freya or firemandecko | -- | -- |
| `documentation` | *(from `--agent` flag)* | -- | -- |

**`documentation` label:** Single-agent, no chain. The agent MUST be specified via
`--agent` flag (parsed from issue body: "Agent: <name>"). There is NO Loki QA step.
The agent merges its own PR and closes the issue directly. Do NOT run chain
continuation (`/fire-next-up --resume`) for documentation issues.

If agent cannot be inferred, error and tell user to use `--agent`.

## Agent Prompt Templates

Templates live in `/fire-next-up/templates/` (shared, not duplicated):

| Agent | Template | Agent Definition (canonical rules) |
|-------|----------|------------------------------------|
| Luna | `templates/luna.md` | `.claude/agents/luna.md` |
| FiremanDecko | `templates/firemandecko.md` | `.claude/agents/fireman-decko.md` |
| Freya | `templates/freya.md` | `.claude/agents/freya.md` |
| Heimdall | `templates/heimdall.md` | `.claude/agents/heimdall.md` |
| Loki (Mode A: QA) | `templates/loki.md` | `.claude/agents/loki.md` |
| Loki (Mode B: CI bounce-back) | `templates/loki.md` | `.claude/agents/loki.md` |

**Single source of truth:** Agent definition files (`.claude/agents/*.md`) are the
canonical source for behavioral rules (test standards, implementation rules, design
principles, constraints, etc.). Templates contain only the dispatch workflow steps
and reference the agent definition for behavioral rules. Do NOT duplicate behavioral
rules in templates — add them to the agent definition file instead.

All templates use `{{SANDBOX_PREAMBLE}}` — replace with the embedded preamble below.

## Sandbox Preamble (embedded — do NOT read from file)

Substitute into `{{SANDBOX_PREAMBLE}}` in every agent prompt, replacing `<BRANCH>` and `<NUMBER>`:

```
SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo — hardcoded, no discovery needed.
- Each Bash tool call = fresh shell. ALWAYS prefix: cd /workspace/repo && <command>
- Set timeout: 600000 (10 min) on long-running commands (playwright, next build).
- The entrypoint already handled: git clone, branch checkout, package install (the repo's own manager), git identity.

**Step 1 — Verify environment (quick sanity check):**
cd /workspace/repo && git branch --show-current && node -v
If browser tests are needed, install the browser binary:
  cd /workspace/repo && npx playwright install chromium 2>/dev/null || true

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
Use TodoWrite to plan and track ALL work. Create todos at the START of the session
covering every numbered step. Update each todo to in_progress when you start it and
completed when done. This is your progress ledger — if the session dies, the todo
state shows exactly where you stopped.

INCREMENTAL COMMIT + VERIFY LOOP (UNBREAKABLE):
After every logical chunk of implementation work (~5-10 min or 1-3 files changed):
  1. cd /workspace/repo && git add -A && git commit -m 'wip: <what> — issue:<NUMBER>' && git push origin <BRANCH>
  2. Run the repo's typecheck entrypoint (justfile / package.json / Makefile).
  3. If it fails: fix immediately, commit+push, re-run.
  4. Update your todo progress.
Do NOT batch all changes into one commit at the end. Sessions can die at any time —
uncommitted work is lost work.

VERIFY (UNBREAKABLE):
First, determine which package you changed:
  cd /workspace/repo && git diff origin/main --name-only

**Detect the repo's own verify entrypoints — do not assume a layout:**
1. `just --list` (if a justfile exists), `cat package.json` scripts, or `Makefile` targets.
2. Run the repo's typecheck + build + unit-test entrypoints (e.g. `just verify`, `pnpm run verify:*`,
   `npm test`). For Python packages: `pytest` (or the repo's test recipe).
3. If the changed package has NO test infra (infra scripts, tooling packages), typecheck + build only.
4. Do NOT run E2E suites locally — unit level only. E2E runs via CI.
5. **Trust the exit code.** Exit 0 = pass. On failure: read output, fix, commit+push, re-run.

**Trust the exit code.** Exit 0 = pass. Non-zero = failures.
On failure: read output, fix, commit+push, re-run. Repeat until exit 0.
Do NOT proceed to handoff with ANY failing checks.
**All verify steps MUST run in the foreground (blocking).** NEVER use `run_in_background`
for tsc, build, or test commands. Background verify = unverified merge = bug.
**NEVER use `sleep` commands.** No sleep polling. Run foreground, check exit code.

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.

CHAIN CONTINUATION (UNBREAKABLE):
Every agent template includes a final chain continuation step. It is MANDATORY when
conditions are met (success verdict) and FORBIDDEN when they are not (failure/partial).

- **Documentation issues (label: `documentation`):** NO chain continuation. The agent
  merges its own PR and closes the issue directly:
  `gh pr merge <PR_NUMBER> --squash --delete-branch && gh issue close <NUMBER>`
  Do NOT run `/fire-next-up --resume`. There is no Loki QA step for doc-sync work.
- Non-final agents (Luna, FiremanDecko, Heimdall): run `/fire-next-up --resume #<NUMBER>`
  as the final step ONLY when all verify steps pass and the handoff comment is posted.
  This dispatches the next agent in the chain on the same branch.
- Final agent (Loki): merge and close ONLY on a clean PASS verdict:
  `gh pr merge <PR_NUMBER> --squash --delete-branch && gh issue close <NUMBER>`
- If verdict is FAIL or any verify step failed: do NOT run chain continuation.
  Stop immediately and leave the issue open for manual triage.
- Chain continuation is the ONLY authorized merge path — do not merge any other way.
- **GKE sandbox: NEVER fall back to local worktree.** If `/dispatch` fails inside a GKE job
  (e.g. dispatch-job.sh path error, kubectl error), post a comment on the issue with the
  exact error output, then stop. Do NOT spawn an Agent tool with `isolation: "worktree"`.
  The orchestrator (Odin) will re-dispatch from outside the sandbox.
```

---

## Workflow

### Phase 1 — Gather (skip what you already have)

**Only fetch the issue if its title/body/labels are NOT already in context.**
**Only Read the agent template if it was NOT already read earlier in this session.**

Read the agent template (if needed):
- `TEMPLATE_DIR/<agent-or-override>.md`

Where `TEMPLATE_DIR` = `$(git rev-parse --show-toplevel)/.claude/skills/fire-next-up/templates`.

### Phase 2 — Compose + Spawn (single Bash call per issue)

Determine agent (from `--agent` or inference table), branch (from `--branch` or `fix/issue-<N>-<kebab>`, max 50 chars), and model (from mapping table).

Substitute variables in the template:
- `{{SANDBOX_PREAMBLE}}` → content of `sandbox-preamble.md`
- `{{DECREE_TEMPLATE}}` → content of `decree-<agent>.md` (e.g. `decree-firemandecko.md`, `decree-loki.md`)
- `<NUMBER>` → issue number
- `<TITLE>` → issue title
- `<BRANCH>` → branch name
- `<FULL ISSUE BODY>` → full issue body text
- `<WIREFRAME_FILES>` → (UX chain Step 2 only) exact wireframe file paths from Luna's handoff

**UX Chain — Wireframe Extraction (Step 2 FiremanDecko only):**

When dispatching FiremanDecko as Step 2 of a UX chain, the orchestrator MUST:
1. Read the `## Luna → FiremanDecko Handoff` comment from the issue.
2. Extract the file paths listed under `**Files:**` in that comment.
3. Substitute them into the `<WIREFRAME_FILES>` placeholder as a bulleted list of exact paths.

Example substitution:
```
  Luna's wireframes are on this branch. Read EVERY file listed below BEFORE writing any code:
  - `knowledge/tech-designs/chrome/dashboard-tab-headers.html`
  - `knowledge/tech-designs/chrome/dashboard-tab-headers-interaction-spec.md`
  These are the exact wireframe files Luna produced. ...
```

If no `**Files:**` field exists in the handoff, fall back to: list ALL files changed in the PR (from `gh pr view --json files`).

If `--prompt-extra`, append after the issue body:
```
---
## Additional Context (from orchestrator)
<prompt-extra content>
```

**If `--dry-run`:** Display the composed prompt and stop. No spawn.

#### Remote (default) — GKE Autopilot K8s Job

```bash
REPO_ROOT=$(git rev-parse --show-toplevel) && \
SESSION_ID="issue-<N>-step<S>-<agent>-$(uuidgen | cut -c1-8 | tr A-Z a-z)" && \
PROMPT_FILE=$(mktemp /tmp/agent-prompt-XXXXXX.md) && \
cat > "$PROMPT_FILE" <<'AGENT_PROMPT_EOF'
<composed prompt content here>
AGENT_PROMPT_EOF
bash "$REPO_ROOT/infrastructure/k8s/agents/dispatch-job.sh" \
  --session-id "$SESSION_ID" \
  --branch "<BRANCH>" \
  --model "<MODEL>" \
  ${HARNESS:+--harness "$HARNESS"} \
  --prompt-file "$PROMPT_FILE" && \
node "$REPO_ROOT/.claude/skills/fire-next-up/scripts/pack-status.mjs" --move <N> in-progress
rm -f "$PROMPT_FILE"
```

**Key:** Write the prompt to a temp file with `cat >` and pass via `--prompt-file`. This avoids the heredoc-in-subshell pattern (`$(cat <<'DELIM'...DELIM)`) which silently truncates the prompt if the content happens to contain the delimiter word on its own line. The delimiter `AGENT_PROMPT_EOF` is chosen to be unlikely in prompt content. Single-quoted delimiter (`<<'...'`) prevents shell expansion.

**Harness:** `HARNESS` is unset for the default (`claude`); set `HARNESS=hermes` (or pass `--harness hermes` directly) per Harness Selection.

**Spot vs on-demand:** Default is **on-demand** (stable, no preemption). Pass `--spot` to opt-in to Spot nodes (cheaper but pods can be preempted). Spot is effectively deprecated for agents — too disruptive.

**Job naming:** The dispatch script generates DNS-compatible job names from the session ID.

**Fire-and-forget:** `dispatch-job.sh` applies the Job and returns immediately. The Job runs asynchronously on GKE Autopilot.

**Logs:** `kubectl logs job/agent-<session-id> -n "$AGENTS_NS" --follow`

#### Local (`--local`)

Launch via Agent tool with `isolation: "worktree"`, `run_in_background: true`, `mode: "bypassPermissions"`, using the composed prompt as the agent task.

### Phase 3 — Board Move (MANDATORY)

**ALWAYS move to In Progress after a successful spawn.** This is chained with `&&` in the
spawn command so it only runs if spawn succeeds.

Skip ONLY if `--skip-board-move` flag is explicitly passed.

The board move is embedded in the spawn command (see Phase 2). If for any reason it was
not included in the spawn command, run it separately:

```bash
node "<repo-root>/.claude/skills/fire-next-up/scripts/pack-status.mjs" --move <N> in-progress
```

**Do NOT move if spawn failed.** The `&&` chaining handles this automatically.

### Output — Dispatch Report (only output)

After spawning, query the cluster and job for details. The report MUST include:

```
**Dispatched #<N>**: <TITLE>
**Agent:** <AgentName> (Step <S>) | **Model:** <MODEL>
**Branch:** `<BRANCH>`
**Session:** `<SESSION_ID>`
**Auto-continue:** enabled — agent will run `--resume #<N>` on completion

**GKE:**
  Cluster: `<kubectl config current-context>`
  Namespace: `$AGENTS_NS`
  Job: `agent-<SESSION_ID>`
  Image: `<image from dispatch-job.sh output>`

**Links:**
  Logs: `kubectl logs job/agent-<SESSION_ID> -n $AGENTS_NS --follow`
  Logs (verbose): `kubectl logs job/agent-<SESSION_ID> -n $AGENTS_NS --all-containers --timestamps`
  Brandify: `/brandify-agent <SESSION_ID>`
  Pod status: `kubectl get pods -n "$AGENTS_NS" -l job-name=agent-<SESSION_ID>`
```

One report per issue for parallel dispatches. No step-by-step narration.

---

## Parallel Dispatch (`--parallel`)

1. Phase 1 for all issues (template reads are shared — read once, reuse).
2. Phase 2 (spawn) for all issues in parallel Bash calls.
3. Phase 3 (board moves) batched.
4. Single summary table output.

Mixed-harness parallel dispatch is supported: the harness is chosen per issue (see Harness Selection).

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Issue not found | **Error**, exit |
| Issue closed | **Warning**, exit (unless `--force`) |
| Unknown agent name | **Error** with valid list |
| Cannot infer agent | **Error**: use `--agent` |
| Template missing | **Error** |
| `kubectl` not configured | **Error**, do NOT fall back to local |
| `dispatch-job.sh` fails | **Error**, do NOT move board, do NOT fall back to local worktree |
| Running inside GKE sandbox + dispatch fails | **Error** — post GitHub comment with error details and stop. NEVER spawn local Agent tool. |
| Board move fails | **Warning** (non-fatal) |

---

## Rules

- All agent spawning goes through `/dispatch`. Never call `dispatch-job.sh` directly outside of dispatch.
- Templates are read from `fire-next-up/templates/` — no duplication.
- GKE Jobs are fire-and-forget: spawn and report, do NOT poll or wait.
- The orchestrator coordinates — never do an agent's work yourself.
- Job logs are retrievable via `kubectl logs` or Cloud Logging for debugging.
- **NEVER fall back to local worktree** when GKE dispatch fails. If `dispatch-job.sh` fails, post a GitHub comment with the exact error, then stop. Do NOT spawn an Agent tool with `isolation: "worktree"`. Local execution is ONLY used when `--local` is explicitly passed by Odin.
- **Always resolve repo root dynamically** with `REPO_ROOT=$(git rev-parse --show-toplevel)` — never hardcode or use `<repo-root>` as a literal string.
