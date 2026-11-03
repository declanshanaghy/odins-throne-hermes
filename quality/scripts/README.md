# QA Scripts — Odin's Throne

Automation scripts for coverage collection, bloat critique, complexity analysis, and report generation. All scripts are safe to re-run (idempotent).

- [README.md](README.md) — This index.

**Parent:** [quality/README.md](../README.md)

---

## Coverage Pipeline

| Script | What it does |
|--------|-------------|
| [coverage.mjs](coverage.mjs) | Orchestrates the full coverage pipeline: runs Vitest, builds the app, starts the prod server with `NODE_V8_COVERAGE`, runs Playwright, then merges all reports. Entry point for `node quality/scripts/coverage.mjs`. |
| [coverage-combine.mjs](coverage-combine.mjs) | Merges Vitest LCOV (`quality/reports/coverage/vitest/lcov.info`) and Playwright LCOV (`quality/reports/coverage/playwright/lcov.info`) into a single combined HTML + LCOV report at `quality/reports/coverage/combined/`. |
| [coverage-index.mjs](coverage-index.mjs) | Generates the master coverage index HTML page at `quality/reports/coverage/` linking all sub-reports. |
| [collect-browser-coverage.mjs](collect-browser-coverage.mjs) | Converts Istanbul browser coverage JSON (from `window.__coverage__`) into LCOV for merging with Vitest coverage. |
| [playwright-coverage-fixture.ts](playwright-coverage-fixture.ts) — Playwright fixture that reads `window.__coverage__` after each test and writes merged coverage to `quality/.coverage-tmp/browser-coverage.json` on teardown. |

---

## Critique and Analysis

| Script | What it does |
|--------|-------------|
| [loki-critique.sh](loki-critique.sh) | Scans `test/` for bloat patterns (over-limit files, issue-scoped dirs, tiny suites, CSS measurements, static assertions, keyboard over-spec). Writes findings to `quality/quality-report.md`. Exit 0 = healthy, 1 = critical bloat, 2 = env error. |
| [complexity-analysis.mjs](complexity-analysis.mjs) | Walks `src/` (excluding tests and node_modules), computes cyclomatic complexity per function, and writes `quality/reports/complexity/complexity-report.json` + an HTML report. |

---

## Report Generation

| Script | What it does |
|--------|-------------|
| [quality-report.mjs](quality-report.mjs) | Generates `quality/reports/quality-report.md` — structured Markdown covering test quality analysis, coverage summary, and test inventory. |
| [quality-report-html.mjs](quality-report-html.mjs) | Generates `quality/reports/quality-report.html` — full Fenrir-styled HTML quality report with embedded CSS, SVG seals, and the Nordic war room aesthetic. Primary report artifact. |

---

## Templates

| File | What it does |
|------|-------------|
| [templates/decree-change-order.html](templates/decree-change-order.html) | HTML template for Loki's QA decree change orders. |
| [templates/decree-seal.html](templates/decree-seal.html) — SVG seal element used in decree HTML output. |
| [templates/decrees.json](templates/decrees.json) — JSON store of issued QA decrees. |

---

## Utility

| Script | What it does |
|--------|-------------|
| [coverage.css](coverage.css) | Custom CSS passed to `genhtml` via `--css-file` to style the combined HTML coverage report with the Fenrir theme. |

---

## Common Commands

```bash
# Run full coverage pipeline (Vitest + Playwright + merge)
node quality/scripts/coverage.mjs

# Run bloat critique (prints findings to quality/quality-report.md)
bash quality/scripts/loki-critique.sh

# Run complexity analysis
node quality/scripts/complexity-analysis.mjs

# Generate HTML quality report
node quality/scripts/quality-report-html.mjs
```
