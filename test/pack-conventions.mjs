// Pack conventions test — guards the bootstrap from issue #15:
// .claude/agents + .claude/skills (pruned keep-list) + quality/ templates +
// the dispatch values files. Behavioral where possible: it EXECUTES
// pack-env.sh and loki-critique.sh and asserts their output, and
// cross-checks the namespace pin against the dispatch values file.
//
// Run: npm test   (node --import ./test/register.mjs test/pack-conventions.mjs)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: "utf8" });

// ── 1. pack-env.sh resolves the orchestration environment (behavioral) ──────
{
  const out = run("bash", [".claude/skills/fire-next-up/scripts/pack-env.sh"]);
  const env = Object.fromEntries(
    out.trim().split("\n").map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
  );
  assert.equal(env.OWNER, "declanshanaghy", "pack-env.sh OWNER");
  assert.equal(env.REPO, "odins-throne-hermes", "pack-env.sh REPO");
  assert.equal(
    env.AGENTS_NS,
    "odins-throne-hermes-agents",
    "pack-env.sh AGENTS_NS — must match the pinned namespace"
  );
}

// ── 2. .claude/agents-namespace and the dispatch values file agree (behavioral) ──
{
  const pinned = readFileSync(join(REPO_ROOT, ".claude/agents-namespace"), "utf8").trim();
  assert.equal(pinned, "odins-throne-hermes-agents", ".claude/agents-namespace content");

  const valuesPath = join(REPO_ROOT, "infrastructure/k8s/odins-throne-hermes-values.env");
  assert.ok(existsSync(valuesPath), "infrastructure/k8s/odins-throne-hermes-values.env exists");

  // Parse the env file with shell semantics (source it, print the keys we pin).
  const printed = run("bash", [
    "-c",
    `set -a && source '${valuesPath}' && set +a && ` +
      'echo "NS=$PACK_NAMESPACE" && echo "PROJECT=$PACK_PROJECT" && ' +
      'echo "URL=$PACK_REPO_URL" && echo "IMG=$PACK_IMAGE" && echo "SECRET=$PACK_SECRET_NAME"',
  ]);
  const vals = Object.fromEntries(
    printed.trim().split("\n").map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
  );
  assert.equal(vals.NS, pinned, "values.env PACK_NAMESPACE matches .claude/agents-namespace");
  assert.equal(vals.PROJECT, "odins-throne-hermes", "values.env PACK_PROJECT");
  assert.equal(
    vals.URL,
    "https://github.com/declanshanaghy/odins-throne-hermes.git",
    "values.env PACK_REPO_URL"
  );
  assert.equal(
    vals.IMG,
    "us-central1-docker.pkg.dev/fenrir-ledger-prod/fenrir-images/agent-sandbox",
    "values.env PACK_IMAGE"
  );
  assert.equal(vals.SECRET, "agent-secrets", "values.env PACK_SECRET_NAME");
}

// ── 3. Pruned skills: exactly the keep-list lives in .claude/skills ─────────
{
  const KEEP = ["dispatch", "epic-manager", "file-issue", "fire-next-up", "git-commit"];
  const skills = readdirSync(join(REPO_ROOT, ".claude/skills")).sort();
  assert.deepEqual(skills, KEEP.sort(), ".claude/skills contains exactly the keep-list");
  for (const s of KEEP) {
    assert.ok(
      existsSync(join(REPO_ROOT, ".claude/skills", s, "SKILL.md")),
      `skill ${s} has a SKILL.md`
    );
  }
  // pack-status.mjs (the chain's board/status tool) ships with fire-next-up
  assert.ok(
    existsSync(join(REPO_ROOT, ".claude/skills/fire-next-up/scripts/pack-status.mjs")),
    "pack-status.mjs present under fire-next-up/scripts"
  );
}

// ── 4. Agent definitions: team present, shared norms present ─────────────────
{
  const AGENTS = ["fireman-decko", "loki", "luna", "freya", "heimdall"];
  for (const a of AGENTS) {
    assert.ok(
      existsSync(join(REPO_ROOT, ".claude/agents", `${a}.md`)),
      `agent definition ${a}.md present`
    );
  }
  for (const sh of ["decree.md", "documentation-discipline.md", "github-actions.md", "test-rules.md"]) {
    assert.ok(
      existsSync(join(REPO_ROOT, ".claude/agents/shared", sh)),
      `shared norm ${sh} present`
    );
  }
}

// ── 5. Quality templates present and the critique script runs clean ─────────
{
  for (const q of ["README.md", "issue-template.md", "test-guidelines.md", "Justfile", "scripts"]) {
    assert.ok(existsSync(join(REPO_ROOT, "quality", q)), `quality/${q} present`);
  }
  const dry = run("bash", ["quality/scripts/loki-critique.sh", "--dry-run"]);
  assert.match(dry, /health=HEALTHY/, "loki-critique.sh --dry-run reports HEALTHY");
}

// ── 6. Copied quality scripts still parse (node --check) ────────────────────
{
  const scripts = readdirSync(join(REPO_ROOT, "quality/scripts")).filter((f) => f.endsWith(".mjs"));
  assert.ok(scripts.length >= 5, "quality/scripts has the .mjs tooling");
  for (const s of scripts) {
    run("node", ["--check", join("quality/scripts", s)]);
  }
}

// ── 7. No dangling symlinks anywhere in the pack ────────────────────────────
{
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isSymbolicLink()) {
        assert.ok(existsSync(p), `symlink ${p} resolves (no dangling pack links)`);
      }
    }
  };
  walk(join(REPO_ROOT, ".claude"));
  walk(join(REPO_ROOT, "quality"));
}

console.log("[ok] pack conventions: agents, skills, quality templates, dispatch values");
