# Quality Assurance — Odin's Throne

**Loki's domain.** FiremanDecko builds. Loki tears down. The shield wall holds.

- [README.md](README.md) — This index: test architecture, strategy, standards, and running tests.
- [test-guidelines.md](test-guidelines.md) — Pyramid rules, what belongs where, bloat detection thresholds.
- [issue-template.md](issue-template.md) — Canonical issue filing schema, label taxonomy, agent chain routing.
- [scripts/README.md](scripts/README.md) — Coverage, critique, complexity, and report generation scripts.

**Tests live in the repo root [`test/`](../test) directory** — plain-node `.mjs`
suites that drive the BUILT plugin artifact (`desktop/plugin.js`).

---

## Test Architecture

### Three-Layer Pyramid

| Layer | Runner | Purpose |
|-------|--------|---------|
| **Unit** | plain node (`node:assert/strict`) | Pure logic, utilities, helpers |
| **Integration** | plain node + jsdom (`test/register.mjs` harness) | Plugin render, log-stream parsing, store behavior |
| **E2E** | QA-driven (Loki) + CI | User journeys against the real desktop app / monitor |

Run `bash quality/scripts/loki-critique.sh` to generate a fresh bloat critique.

**Test documentation:** See [`test-guidelines.md`](test-guidelines.md) for the authoritative pyramid rules, what belongs where, and bloat detection thresholds.

---

## Test Strategy (FiremanDecko and Loki)

### FiremanDecko (Implementation)

**Responsibility:** Write and maintain unit + integration tests alongside implementation.

- **Only test:** log-stream parsing, store/StoreBridge behavior, pane/page render, settings, a11y gates
- **Never test:** Static content, CSS measurements, regression suites, issue-scoped directories
- **After each feature:** Create/update the suite in `test/`
- **Max ~10 tests per suite** — if you hit 15, split by sub-feature
- **Incremental commits** every 1-3 files changed: `wip: <what> — issue:<N>`
- **Verify:** `npx tsc --noEmit` + `npm run build` + `npm test` after each chunk

### Loki (Validation)

**Responsibility:** Critique and cull bloat. Validate that tests follow the pyramid.

- **Run bloat critique:** `bash quality/scripts/loki-critique.sh` after every coverage run
- **Review findings:** Check output for flagged files
- **Act on CRITICAL:** Files >15 tests = immediate consolidation issue filed
- **Act on WARNINGS:** 3+ warnings in one suite = file consolidation issue
- **Validate handoff:** Ensure all tests pass, tsc green, build green, before approving PR
- **Final QA:** PASS verdict includes new tests written and verifying acceptance criteria

---

## Running Tests

```bash
# Typecheck
npx tsc --noEmit

# Build (tests drive the BUILT artifact — always build first)
npm run build

# Unit + Integration
npm test

# Full verify (all three)
npm run verify
```

---

## QA Standards

**Every test must:**
1. Derive assertions from acceptance criteria, not from what the code currently does
2. Be idempotent — clear relevant state before running
3. Map to a user journey or integration point, not to incidental implementation details
4. Avoid CSS measurements, static text assertions, and over-specification

**Every PASS verdict requires:**
- Code review clean
- Build clean (`npm run build`)
- TypeScript clean (`npx tsc --noEmit`)
- All tests passing (`npm test`)

---

## QA Critique Pipeline

Loki runs an automated bloat critique to keep the test suite lean and mean. See [`test-guidelines.md`](test-guidelines.md) §"Rules for test suites" and §"Bloat Detection Rules" for the full checklist.

The critique script writes `quality/quality-report.md` (not committed — regenerated each session). The full structured report (with coverage data) is written to `quality/reports/quality-report.md` by `quality/scripts/quality-report.mjs`.
