# Odin's Throne — Test Guidelines

What belongs where. Loki must follow this when writing or reviewing tests.

**See also:** [quality/README.md](README.md) · [issue-template.md](issue-template.md) · [`test/`](../test)

## Test Pyramid

```
        / E2E (QA-driven + CI)  \   <- Fewest: real desktop app, real monitor
       /  Integration (node+jsdom) \ <- Middle: plugin render, log-stream parsing
      /   Unit (plain node)        \ <- Most: pure logic, no DOM
```

### Test Ownership

| Agent | Owns | Location |
|-------|------|----------|
| FiremanDecko | unit + integration | `test/` |
| Loki | E2E/QA validation + gap-fill | `test/` |

FiremanDecko writes tests with implementation. Loki augments gaps only.

## Unit Tests (plain node)

**Location:** `test/`
**Runner:** `npm test` (`node --import ./test/register.mjs test/<suite>.mjs`)

### What belongs here

- Pure functions: utils, helpers, formatters, validators
- Log-stream parsing and entry-structuring logic
- Data transformations and serialization
- Type guards and schema validation

### What does NOT belong here

- Anything requiring a browser or DOM rendering (use the jsdom harness)
- Component rendering or interaction
- Anything requiring the real Hermes desktop app

---

## Integration Tests (node + jsdom)

**Location:** `test/`
**Runner:** `npm test` — same entrypoint; the `test/loader.mjs` resolve hook points
`@hermes/plugin-sdk` at `test/sdk-stub.mjs` and React at the Hermes desktop app's
own copies (singleton React across plugin and renderer).

**The suites drive the BUILT artifact** (`desktop/plugin.js`) — the same bytes the
desktop app loads. Run `npm run build` first.

### What belongs here

- Plugin registration against a stub ctx (both surfaces: right pane + workspace page)
- Component render: landmarks, aria-labels, structural output
- Hook state machines: log-stream parsing, store updates, connection state
- Interaction: job-card clicks, workspace tab opens, settings toggles

### What does NOT belong here

- Multi-page navigation flows
- Visual layout assertions (E2E territory)
- Anything requiring the real Hermes app or a real K8s cluster
- CSS pixel measurements or bounding box checks

### Pattern: harness usage

See `test/smoke.mjs` (render smoke: stub ctx, registers plugin, renders both
surfaces, asserts the Norse UI mounts) and `test/hermes-stream.mjs` (drives the
real `useLogStream` hook with a synthetic Hermes session). Reuse `test/sdk-stub.mjs`
and the register/loader hooks — never re-invent them.

---

## E2E / QA Validation

**Owner:** Loki, with CI. Runs against the real desktop app and monitor — not in
the plain-node harness.

### What belongs here

- User journeys: connect to monitor, open a job's log terminal, watch a stream
- Navigation flows: pane → workspace tab → log viewer
- Visual regression: page loads, key elements visible, layout correct
- Responsive layout: mobile 375px breakpoints (real viewport)
- Accessibility smoke: focus order, ARIA roles on interactive elements

### What does NOT belong here

- Landmark presence checks → integration test (component render test)
- Pure logic validation → unit test
- CSS animation timing → not testable reliably
- One-time migration/upgrade checks → delete after migration lands
- Issue-specific regression tests → merge into the feature suite once verified
- aria-label presence → integration test (component render test)

### Rules for test suites

1. **One suite per feature area**, not per issue. `log-viewer.mjs` not `issue-333.mjs`.
2. **No duplicate coverage.** If a behavior is already asserted, don't re-assert it elsewhere.
3. **Max ~10 tests per file.** If a suite grows past 15, split by sub-feature.
4. **Delete upgrade/migration suites** once the migration is confirmed stable.
5. **Issue-specific regression tests** get merged into the parent feature suite after the fix lands.
6. **No animation timing assertions.** Test that elements appear/disappear, not how fast.

---

## Anti-Patterns (DO NOT)

- **Do not create a new spec file per GitHub issue.** Find the existing suite and add tests there.
- **Do not test the same feature in two suites.** Consolidate.
- **Do not use E2E to test things that don't need a browser.** If you can test it with `assert(fn(input), output)`, it's a unit test.
- **Do not keep one-time validation suites** after the change is stable.
- **Do not test CSS animation durations.** They're flaky and provide no value.
- **Do not exceed 15 tests per file.** Split, or you're probably testing too granularly.
- **Do not test landmark presence in E2E.** Use the jsdom integration harness.

---

## Bloat Detection Rules (Loki Critique Checklist)

These rules are evaluated by `quality/scripts/loki-critique.sh` on every coverage run and
by Loki manually on every PR review. A suite that violates any of these rules is flagged as bloat.

### Consolidation Candidates

A suite is a consolidation candidate when any of the following is true:

1. **Issue-scoped file name** — file contains an issue number (e.g. `issue-333.mjs`)
   or PR-specific scope. These merge into the parent feature suite once stable.

2. **Sub-feature tested in isolation** — a tiny suite (1-3 tests) for a single
   field or badge that belongs inside a larger feature suite.

3. **Duplicate coverage** — two suites exercise the same behavior.

4. **Static content assertions** — tests that assert on exact copy text (h1/h2
   content, paragraph copy, button labels other than aria-label). They break on
   every copy edit.

5. **Layout/positioning measurements** — pixel widths, bounding boxes, computed
   CSS. These are CSS tests in disguise.

6. **Guard-clause tests** — negative visibility assertions on state that is
   never supposed to show. Minimal value, inflated count.

### Per-File Hard Limits (Enforced by loki-critique.sh)

| Limit | Threshold | Action |
|-------|-----------|--------|
| Tests per file | >10 = WARNING, >15 = BLOAT | Split or cull |
| Duplicated beforeEach setup | Same 4+ line block in 3+ tests | Extract helper |
| Static text assertions | ≥3 per file | Convert to integration test |

### Coverage Layer Assignment (Authoritative Reference)

Before writing any test, consult this table:

| What you want to verify | Layer | Runner |
|-------------------------|-------|--------|
| Pure function output | Unit | plain node |
| Component renders correct HTML | Integration | node + jsdom |
| Log-stream parsing produces entries | Integration | node + jsdom |
| ARIA role/label presence on component | Integration | node + jsdom |
| Store/StoreBridge state transitions | Integration | node + jsdom |
| User clicks job card, workspace opens | Integration (stub) / E2E (real app) | harness / QA |
| Multi-page navigation flow | E2E | QA + CI |
| Responsive layout at 375px viewport | E2E | QA + CI |
| Static page copy / markdown content | None | Skip entirely |
| CSS animation timing | None | Skip entirely |
| CSS pixel dimensions | None | Skip entirely |
