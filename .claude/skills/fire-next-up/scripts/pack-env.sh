#!/bin/sh
# pack-env.sh — resolve the pack orchestration environment for the current repo.
# Prints shell-evaluable lines: OWNER, REPO, PROJECT, AGENTS_NS.
# Resolution order for AGENTS_NS: $PACK_NAMESPACE > .claude/agents-namespace > <repo-name>-agents
# (a trailing "-ledger" is stripped; this repo pins its namespace via .claude/agents-namespace).
set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
SLUG="$(git remote get-url origin | sed 's#.*[/:]##;s/\.git$//')"
OWNER="$(git remote get-url origin | sed 's#.*[/:]\([^/]*/[^/]*\)\.git$#\1#;s#/.*##')"
REPO="$SLUG"
PROJECT="${REPO%-ledger}"
if [ -n "${PACK_NAMESPACE:-}" ]; then
  AGENTS_NS="$PACK_NAMESPACE"
elif [ -f "$REPO_ROOT/.claude/agents-namespace" ]; then
  AGENTS_NS="$(cat "$REPO_ROOT/.claude/agents-namespace" | head -1 | tr -d '[:space:]')"
else
  AGENTS_NS="${PROJECT}-agents"
fi
echo "OWNER=$OWNER"
echo "REPO=$REPO"
echo "PROJECT=$PROJECT"
echo "AGENTS_NS=$AGENTS_NS"
echo "PACK_NAMESPACE=$AGENTS_NS"
