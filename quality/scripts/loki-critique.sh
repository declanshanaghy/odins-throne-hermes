#!/usr/bin/env bash
# loki-critique.sh — Loki's E2E Bloat Critique
#
# Scans test/ for bloat patterns and writes findings to
# quality/quality-report.md under a "Loki QA Critique" section.
# Safe to re-run at any time — idempotent (replaces existing section).
#
# Usage:
#   bash quality/scripts/loki-critique.sh                 # full critique
#   bash quality/scripts/loki-critique.sh --dry-run       # print to stdout only
#   bash quality/scripts/loki-critique.sh --pattern-check # show duplicate-route table
#
# Exit codes:
#   0 — critique complete, no critical bloat found
#   1 — critique complete, critical bloat found (suites > hard limits)
#   2 — environment error (repo root not found)

set -uo pipefail

# ─── Bootstrap ────────────────────────────────────────────────────────────────

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S%z')] ERROR: not inside a git repo" >&2
  exit 2
}

SUITES_DIR="$REPO_ROOT/test"
REPORT_FILE="$REPO_ROOT/quality/quality-report.md"
GUIDELINES="$REPO_ROOT/quality/test-guidelines.md"
DRY_RUN=false
PATTERN_CHECK=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)       DRY_RUN=true ;;
    --pattern-check) PATTERN_CHECK=true ;;
  esac
done

TS="[$(date '+%Y-%m-%d %H:%M:%S%z')]"
echo "$TS loki-critique: scanning $SUITES_DIR"

# ─── Gather raw data ──────────────────────────────────────────────────────────

declare -a SPEC_FILES=()
while IFS= read -r f; do
  SPEC_FILES+=("$f")
done < <(find "$SUITES_DIR" \( -name "*.spec.ts" -o -name "*.mjs" \) | sort)

TOTAL_FILES=${#SPEC_FILES[@]}
TOTAL_TESTS=0
BLOAT_CRITICAL=0   # hard-limit violations
BLOAT_WARNINGS=0   # soft-limit or pattern violations

# Per-file results (parallel arrays)
declare -a FILE_NAMES=()
declare -a FILE_TESTS=()
declare -a FILE_FLAGS=()   # pipe-separated flags per file

for spec in "${SPEC_FILES[@]}"; do
  rel="${spec#"$REPO_ROOT/"}"
  count=$(grep -c "^\s*test(" "$spec" 2>/dev/null) || count=0
  # grep -c returns a plain integer; strip any trailing whitespace just in case
  count=$(printf '%s' "$count" | tr -d '[:space:]')
  [[ "$count" =~ ^[0-9]+$ ]] || count=0
  TOTAL_TESTS=$((TOTAL_TESTS + count))

  flags=""

  # Rule: >10 tests = WARNING, >15 = BLOAT
  if [ "$count" -gt 15 ]; then
    flags="${flags}OVER_LIMIT_CRITICAL|"
    BLOAT_CRITICAL=$((BLOAT_CRITICAL + 1))
  elif [ "$count" -gt 10 ]; then
    flags="${flags}OVER_LIMIT_WARNING|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  # Rule: issue-scoped or step-scoped directory name
  dir=$(basename "$(dirname "$spec")")
  if echo "$dir" | grep -qE '(issue-[0-9]+|step[0-9]+|step-[0-9]+|-step[0-9]+|back-button)'; then
    flags="${flags}ISSUE_SCOPED_DIR|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  # Rule: tiny suite (1-3 tests) in its own directory
  if [ "$count" -le 3 ] && [ "$count" -gt 0 ]; then
    flags="${flags}TINY_ISOLATED_SUITE|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  # Rule: CSS/layout measurement calls (boundingBox / computedStyle)
  if grep -qE "(boundingBox|computedStyle|getBoundingClientRect)" "$spec" 2>/dev/null; then
    flags="${flags}CSS_MEASUREMENT|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  # Rule: static text assertions (exact h1/h2/p text checks, toContainText on headings)
  # Proxy: toContainText on locator("h1") or locator("h2") or similar
  if grep -qE 'locator\("(h1|h2|p)"\).*toContainText|toContainText.*"(Prose Edda|sagas)"' "$spec" 2>/dev/null; then
    flags="${flags}STATIC_CONTENT_ASSERT|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  # Rule: excessive keyboard navigation (>3 ArrowRight/ArrowLeft/Home/End in one file)
  kbnav_count=$(grep -cE '"(ArrowRight|ArrowLeft|Home|End)"' "$spec" 2>/dev/null) || kbnav_count=0
  [[ "$kbnav_count" =~ ^[0-9]+$ ]] || kbnav_count=0
  if [ "$kbnav_count" -gt 3 ]; then
    flags="${flags}KEYBOARD_OVERSPEC|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  # Rule: not-visible guard-clause tests (negative assertions on step-1 fields)
  # Proxy: test description contains "NOT visible on Step 1" pattern
  if grep -qiE 'not.*visible.*step.?1|step.?1.*not.*visible' "$spec" 2>/dev/null; then
    flags="${flags}GUARD_CLAUSE_TEST|"
    BLOAT_WARNINGS=$((BLOAT_WARNINGS + 1))
  fi

  FILE_NAMES+=("$rel")
  FILE_TESTS+=("$count")
  FILE_FLAGS+=("${flags%|}")  # strip trailing pipe
done

# ─── Pattern check: routes navigated per suite ────────────────────────────────

if [ "$PATTERN_CHECK" = true ]; then
  echo ""
  echo "=== Route Coverage Per Suite ==="
  for spec in "${SPEC_FILES[@]}"; do
    rel="${spec#"$REPO_ROOT/"}"
    routes=$(grep -oE 'goto\("(/[^"]+)"' "$spec" 2>/dev/null | sort -u | tr '\n' ' ')
    echo "  $rel: ${routes:-(none)}"
  done
  echo ""
fi

# ─── Build report section ─────────────────────────────────────────────────────

CRITIQUE_DATE=$(date '+%Y-%m-%d %H:%M %Z')
BLOAT_PCT=0
if [ "$TOTAL_FILES" -gt 0 ]; then
  BLOAT_PCT=$(( (BLOAT_WARNINGS + BLOAT_CRITICAL) * 100 / TOTAL_FILES ))
fi

# Determine overall health
if [ "$BLOAT_CRITICAL" -gt 0 ]; then
  HEALTH="CRITICAL"
elif [ "$BLOAT_WARNINGS" -gt 5 ]; then
  HEALTH="NEEDS WORK"
elif [ "$BLOAT_WARNINGS" -gt 2 ]; then
  HEALTH="FAIR"
else
  HEALTH="HEALTHY"
fi

# Build the flagged-files table
FLAGGED_TABLE=""
for i in "${!FILE_NAMES[@]}"; do
  flags="${FILE_FLAGS[$i]}"
  if [ -n "$flags" ]; then
    count="${FILE_TESTS[$i]}"
    name="${FILE_NAMES[$i]}"
    # Human-readable flag list
    readable=$(echo "$flags" | tr '|' '\n' | while IFS= read -r flag; do
      if   [ "$flag" = "OVER_LIMIT_CRITICAL" ];   then echo "BLOAT: >15 tests in one file"
      elif [ "$flag" = "OVER_LIMIT_WARNING" ];    then echo "WARNING: >10 tests in one file"
      elif [ "$flag" = "ISSUE_SCOPED_DIR" ];      then echo "WARNING: issue/step-scoped dir, consolidate"
      elif [ "$flag" = "TINY_ISOLATED_SUITE" ];   then echo "WARNING: tiny suite (1-3 tests), merge"
      elif [ "$flag" = "CSS_MEASUREMENT" ];       then echo "WARNING: CSS measurement calls, remove"
      elif [ "$flag" = "STATIC_CONTENT_ASSERT" ]; then echo "WARNING: static text assertion, use integration test"
      elif [ "$flag" = "KEYBOARD_OVERSPEC" ];     then echo "WARNING: keyboard over-specification (>3 keys)"
      elif [ "$flag" = "GUARD_CLAUSE_TEST" ];     then echo "WARNING: guard-clause test, low value"
      fi
    done | awk '{lines[NR]=$0} END {for(i=1;i<=NR;i++) printf "%s%s", lines[i], (i<NR?", ":""); print ""}')
    FLAGGED_TABLE="${FLAGGED_TABLE}| \`${name}\` | ${count} | ${readable} |\n"
  fi
done

# Count flagged files
FLAGGED_COUNT=0
for flags in "${FILE_FLAGS[@]}"; do
  [ -n "$flags" ] && FLAGGED_COUNT=$((FLAGGED_COUNT + 1))
done

# ─── Consolidation recommendations ────────────────────────────────────────────
# Derived dynamically from flagged files found above.

RECOMMENDATIONS=""
for i in "${!FILE_NAMES[@]}"; do
  flags="${FILE_FLAGS[$i]}"
  if [ -n "$flags" ]; then
    name="${FILE_NAMES[$i]}"
    count="${FILE_TESTS[$i]}"
    if echo "$flags" | grep -q "OVER_LIMIT"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Trim \`${name}\`** — ${count} tests exceeds the per-file limit. Split by behaviour area or move lower-value assertions to Vitest.\n"
    fi
    if echo "$flags" | grep -q "ISSUE_SCOPED_DIR"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Merge \`${name}\`** — directory name is issue/step-scoped. Once the fix is confirmed stable, move tests into the parent feature suite.\n"
    fi
    if echo "$flags" | grep -q "TINY_ISOLATED_SUITE"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Merge \`${name}\`** — ${count} tests is too small for its own suite. Consolidate into the nearest feature suite.\n"
    fi
    if echo "$flags" | grep -q "CSS_MEASUREMENT"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Remove CSS measurements in \`${name}\`** — \`boundingBox\`/\`computedStyle\` calls are viewport-sensitive. Replace with \`toBeVisible\` or move to Vitest.\n"
    fi
    if echo "$flags" | grep -q "STATIC_CONTENT_ASSERT"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Replace static assertions in \`${name}\`** — heading/copy text checks break on every copy edit. Move to a Vitest component render test.\n"
    fi
    if echo "$flags" | grep -q "KEYBOARD_OVERSPEC"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Trim keyboard tests in \`${name}\`** — over-specified key sequences. Keep 1 smoke test for tab order; drop per-key-press assertions.\n"
    fi
    if echo "$flags" | grep -q "GUARD_CLAUSE_TEST"; then
      RECOMMENDATIONS="${RECOMMENDATIONS}- **Remove guard-clause tests in \`${name}\`** — negative \"not visible on step 1\" assertions are low value. Delete or replace with a positive AC.\n"
    fi
  fi
done

if [ -z "$RECOMMENDATIONS" ]; then
  RECOMMENDATIONS="_No consolidation actions required — all suites are within limits._"
fi

# ─── Assemble section ─────────────────────────────────────────────────────────

SECTION=$(cat <<SECTION
## Loki QA Critique

_Last run: ${CRITIQUE_DATE}_
_Script: \`quality/scripts/loki-critique.sh\`_

### Summary

| Metric | Value |
|--------|-------|
| Total E2E spec files | ${TOTAL_FILES} |
| Total E2E tests | ${TOTAL_TESTS} |
| Flagged files | ${FLAGGED_COUNT} |
| Critical violations (>15 tests/file) | ${BLOAT_CRITICAL} |
| Bloat warnings | ${BLOAT_WARNINGS} |
| Bloat exposure (% of files flagged) | ${BLOAT_PCT}% |
| Overall health | **${HEALTH}** |

### Flagged Files

| Suite | Tests | Finding |
|-------|-------|---------|
$(printf '%b' "$FLAGGED_TABLE")

### Consolidation Recommendations

$(printf '%b' "${RECOMMENDATIONS}")

### Rules Enforced

See \`quality/test-guidelines.md\` §"Bloat Detection Rules" for the authoritative checklist.
The thresholds evaluated by this script:

| Rule | Threshold | Severity |
|------|-----------|----------|
| Tests per file | >15 | CRITICAL |
| Tests per file | >10 | WARNING |
| Issue/step-scoped directory name | any | WARNING |
| Tiny isolated suite | 1-3 tests | WARNING |
| CSS measurement calls | any | WARNING |
| Static heading text assertions | any | WARNING |
| Keyboard nav over-specification | >3 key presses | WARNING |
| Guard-clause tests (negative step-1) | any | WARNING |

SECTION
)

# ─── Write or print ───────────────────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "$SECTION"
  echo ""
  echo "$TS loki-critique: dry-run complete (no files written), health=$HEALTH"
  exit 0
else
  # Replace or append the "Loki QA Critique" section in quality-report.md
  if [ ! -f "$REPORT_FILE" ]; then
    # Create a minimal report file with the section
    cat > "$REPORT_FILE" <<INIT
# Odin's Throne — Quality Report

<!-- This file is maintained by quality/scripts/loki-critique.sh and Loki QA verdicts. -->
<!-- The "Loki QA Critique" section is auto-generated and will be overwritten on each run. -->

INIT
  fi

  # Remove any existing "Loki QA Critique" section (from ## to next ##-level heading or EOF)
  # We use python3 for reliable multi-line replacement (available on macOS)
  python3 - "$REPORT_FILE" "$SECTION" <<'PYEOF'
import sys, re

path = sys.argv[1]
new_section = sys.argv[2]

with open(path, 'r') as f:
    content = f.read()

# Remove existing Loki QA Critique section
content = re.sub(
    r'\n## Loki QA Critique\n.*?(?=\n## |\Z)',
    '',
    content,
    flags=re.DOTALL
)

# Append new section
content = content.rstrip('\n') + '\n\n' + new_section + '\n'

with open(path, 'w') as f:
    f.write(content)
PYEOF

  echo "$TS loki-critique: wrote findings to $REPORT_FILE"
fi

# ─── Exit code ────────────────────────────────────────────────────────────────

if [ "$BLOAT_CRITICAL" -gt 0 ]; then
  echo "$TS loki-critique: CRITICAL — $BLOAT_CRITICAL file(s) exceed hard limits"
  exit 1
fi

echo "$TS loki-critique: complete — $BLOAT_WARNINGS warning(s), $BLOAT_CRITICAL critical, health=$HEALTH"
exit 0
