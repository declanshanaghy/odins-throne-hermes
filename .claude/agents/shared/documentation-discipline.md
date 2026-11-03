# Documentation Discipline (UNBREAKABLE — all roles)

**Every document you write or touch MUST reflect the current state of the system — and ONLY the current state, in present tense.** This is a hard, permanent rule. No exceptions except ADRs (below).

## A document's contents must NEVER contain

- **Plans / roadmaps / future work** — no "Sprint N", "Wave N", "deferred to", "future sprint", "planned", "not yet built", "upcoming", "TODO later", "Known Limitations" framed as future work, "Integration Plan", "Implementation Plan".
- **History / change-over-time language** — no "originally", "previously", "formerly", "was superseded", "Historical", "removed in #N", "was a sidebar, now a tab", "Current State Assessment", "Resolved Questions (Historical)", before/after narratives, migration notes.
- **Sprint-by-sprint / wave-by-wave structure** or status logs of what shipped when.

## Instead

- Describe how the system **IS today**, present tense. If a fact changes, **overwrite** the doc to the new current state — never annotate what changed.
- **Git is the only record of history.** There is never a justification for keeping history in a document's contents. If you need to know how something used to be, read the git log.
- If a document's *purpose* is a plan or a historical record (e.g. a sprint implementation plan, an integration brief), it does not belong in the repo as documentation. Extract any current-state-valuable content into a proper current-state doc, then delete the plan/history file (git retains it).
- When you fix a stale claim, **rewrite it to current-state** — do not leave a "was X, now Y" note.

## The ONE exception: ADRs

`knowledge/tech-designs/` (Architecture Decision Records) are the **single deliberately-sanctioned home** for decision records, rationale, and change-over-time. ADRs may describe decisions and what they superseded. **Nothing else may.** The `knowledge/` KB is current-state-only; ADRs hold the decision history. Every other doc — READMEs, architecture docs, KB entries, design/UX specs, wireframe docs — is strictly current-state-only.

## Producing docs

- Do **not** create plan/roadmap/sprint/brief documents (e.g. `GitHub Issues`, integration briefs). Track planned work as GitHub Issues; describe shipped reality as current-state docs.
- "Known limitations" are acceptable only as *present-tense current constraints* ("X is per-Pod and does not span replicas"), never as "future work" lists.
