# Tree scene UI assets

First-class UI assets for the painted tree display (the "garden pattern" of
epic #7): a painted backdrop plus JSON-mapped lantern-seat overlays. Wave 0 is
issue #10 — this directory + `src/ui/lib/treeSeats.ts`.

## Files

- `tree-backdrop.jpg` — the moonlit tree-of-life painting (mossy trunk,
  boughs, hanging leaf lanterns), 896x1200 (~3:4 portrait). Extracted
  byte-identical from the approved interactive prototype
  (`design/tree-display/tree-display-prototype.html` on the
  `design-tree-display` branch — the approved contract; the prototype embeds
  this exact JPEG as a data URL).
- `README.md` — this regeneration guide.

## How the assets are wired

- The painting is imported in `src/ui/components/NamespaceTree.tsx` and
  exposed to CSS as the `--tree-backdrop` custom property on the tree root
  (esbuild inlines it as a data URL, same as the `src/assets/` portraits).
- Lantern seats live in `src/ui/lib/treeSeats.ts` as TYPED data:
  `SEAT_POOL` (the painted lantern spots, percent-of-scene, copied verbatim
  from the prototype's `SEAT_POOL`) and `CURATED_SEATS` (namespace id →
  painted seat index, the prototype's `CURATED_SEATS`). Seats are ASSIGNED at
  runtime by `assignSeats(nsIds)` over whatever the backend API returns:
  curated claims first, deterministic djb2-hash claims for unknown worlds,
  and a documented terrace stack below the boughs when a list outgrows the
  painted pool. `namespaceSeat(nsId)` is the single-id convenience.
- The consumer attaches each namespace's seat to its tree node as
  `data-seat-x` / `data-seat-y` / `data-seat-dir` attributes — no layout
  constants scattered in JSX. The lantern overlay (issue #11) pins each
  namespace's lantern to the painting with these seats.

## Regenerating the backdrop

The painting is generated with the `/imagen` generator (Gemini image
generation). The skill lives in the pack — `claude-pack/skills/imagen`,
moved there from `fenrir-ledger/.claude/skills/imagen` on 2026-11-04 — so
from any pack consumer repo:

    npx tsx .claude/skills/imagen/generate.ts "<prompt>" --size 3:4 --count 4

API key: 1Password vault item **"Gemini API"** (field `credential`), passed
inline as `GEMINI_API_KEY` — never written to a file. The generator returns
JPEG bytes under `.png` names: verify with `file <asset>` before any pixel
work. Ship at 896x1200, JPEG ~q85.

Two compositions stand:

- **Wide (the current shipped `tree-backdrop.jpg`)** — boughs across the top
  third, lanterns spread wide:
  a moonlit tree of life at night, moss-covered trunk, spreading boughs
  with leaf-shaped lanterns hanging, deep blue-greens, painterly, portrait
  3:4, no text. Keep boughs in the upper third so lantern seats stay valid.

- **Tall vertical (the v3.7 prototype contract on `design-tree-display` —
  tree in the left third, lanterns climbing the full height, cool palette)**
  — a moonlit tree of life at night, moss-covered trunk, deep blue-greens,
  painterly, portrait 3:4, no text. Cool moonlit palette: deep teal and
  indigo night sky, lanterns glowing pale cool white-blue like moonlight,
  subtle atmospheric depth, soft edges, no bold swirls, no warm orange
  light. One tall narrow tree standing in the left third of the frame,
  roots near the bottom edge, crown near the top edge. Ten pale glowing
  leaf-shaped lanterns hang from its boughs, ALL within the left 40 percent
  of the frame's width, spread across the full height from near the roots
  up to just below the crown. The middle and right of the frame are open
  starry night sky with a small moon. Keep every lantern in the left third
  so lantern seats stay valid.

After a repaint, re-map seats as below. Note for the v3.7 contract: the
prototype stores `SEAT_POOL` in PAINTING percentages and projects them per
display mode (`projectSeat()` — cover-center crop in standard, `fill` in
compact), so the interactive lanterns sit on the painted leaf-lanterns at
any panel width; the port should carry that projection over.

## Re-mapping seats after a repaint

Seats are percent-of-scene, so they survive any rendered size — but a NEW
painting moves the boughs. After any repaint:

1. Open the new painting and note each lantern's position as a percentage of
   the image box (x from left edge, y from top edge, plus hang direction).
2. Update `SEAT_POOL` (and `CURATED_SEATS` for curated bridges) in
   `src/ui/lib/treeSeats.ts`.
3. `test/tree-seats.mjs` locks the mapping to the prototype's values — update
   it in the same change when the prototype contract itself is revised.

## Light-theme variant (required by issue #7)

Dark theme ships first; a light variant must exist before #7 closes. Path:

1. Generate a daylight variant with the same composition (same prompt,
   daylight palette: warm parchment sky, lit mossy greens) so existing seat
   percentages remain valid.
2. Save as `tree-backdrop-light.jpg` in this directory — mirroring the
   `odin-dark.png` / `odin-light.png` convention in `src/assets/`.
3. Wire it theme-keyed in `NamespaceTree.tsx` (the tree root already knows
   the active theme via `useTheme`): pick the asset by theme and set
   `--tree-backdrop` accordingly.
4. Update `src/externals.d.ts` only if a new extension is added (`.jpg` is
   already declared).
