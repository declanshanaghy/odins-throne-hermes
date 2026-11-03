# Test Rules — Shared Between FiremanDecko and Loki

## Assertion Style (UNBREAKABLE)

This repo's tests are plain-node `.mjs` suites in `test/`, run via
`npm test` (`node --import ./test/register.mjs test/<suite>.mjs`). They use:

- `import assert from "node:assert/strict"` — no test framework, no jest-dom
- `jsdom` for DOM rendering, with the Hermes desktop app's own React
  (kept a singleton across plugin and renderer via `test/loader.mjs`)
- The BUILT artifact `desktop/plugin.js` — tests drive the same bytes the
  desktop app loads (build first: `npm run build`)

Follow the existing suites (`test/smoke.mjs`, `test/hermes-stream.mjs`) for
harness patterns: stub ctx, register, render, assert.

## Banned Test Categories (UNBREAKABLE)

Do NOT write tests for:
- GitHub Actions workflows, Helm charts, Terraform, Dockerfiles, K8s manifests
- Markdown/docs, config files, static page copy/content
- CSS class name assertions, animation timing
- Any test that `readFileSync` a file and asserts on string content
- Any test that counts files or checks file existence
- `assert(true)` or any tautological assertion

**Rule:** If the test breaks on a config/copy edit but not on a logic bug, don't write it.

## Only Test Infra That Exists (UNBREAKABLE)

Only run test infrastructure that exists in the changed package. This repo's
unit/integration tests are the plain-node suites in `test/`. Packages/areas
without test infrastructure get typecheck + build only — never invent test
scaffolding for them.

## No Hardcoded Dates (UNBREAKABLE)

Use `new Date(Date.now() + 10 * 86_400_000).toISOString()`, never `"2026-04-02T..."`.
Hardcoded dates create time-bomb tests that fail days later.

## Mock Every Dependency (UNBREAKABLE)

Read the implementation before writing tests. If it calls `fetch()`, a host API,
or the plugin SDK, mock/stub ALL of it (see `test/sdk-stub.mjs`). Missing mocks
= a test that never tested the right thing.

## Never Check Out Main to Compare Failures (UNBREAKABLE)

Fix all test failures regardless of origin. Don't `git checkout main` to compare.

## No Infrastructure Tests (UNBREAKABLE)

Helm charts, Terraform, K8s manifests, Dockerfiles, and CI/CD workflows are not
testable via the node test runner. Validate infra changes via tsc + build only.

## Over-Tested Sources — Do Not Add Tests (UNBREAKABLE)

Files with a very high hit count are saturated. Redirect coverage to uncovered
code. Run `bash quality/scripts/loki-critique.sh --dry-run` before adding to an
existing suite — if the file is flagged, put the test somewhere uncovered instead.
