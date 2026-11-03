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
  `WORLD_SEATS` (percent-of-scene `{ x, y, dir }` per world, copied verbatim
  from the prototype's `WORLDS` array) and `namespaceSeat(nsId)` — curated
  prototype mapping first, deterministic djb2-hash fallback for namespaces
  not yet vision-mapped (same pattern as `namespaceIcons.ts`).
- The consumer attaches each namespace's seat to its tree node as
  `data-seat-x` / `data-seat-y` / `data-seat-dir` attributes — no layout
  constants scattered in JSX. Overlay waves of #7 pin lanterns to the painting
  with `left: var(--seat-x)%`-style positioning read from these attributes.

## Regenerating the backdrop

The painting was generated with the `/imagen` generator (Gemini image
generation). API key: 1Password vault item **"Gemini API"**.

1. Retrieve the key from 1Password ("Gemini API") and authenticate with the
   generator.
2. Prompt for the dark (default) variant — the moonlit scene:
   a moonlit tree of life at night, moss-covered trunk, spreading boughs
   with leaf-shaped lanterns hanging, deep blue-greens, painterly, portrait
   3:4, no text. Keep boughs in the upper third so lantern seats stay valid.
3. Request a 3:4 portrait at ~896x1200 or larger; downscale to 896x1200 and
   export JPEG (quality ~85 — the shipped file is ~725 KB).
4. Overwrite `tree-backdrop.jpg`.

## Re-mapping seats after a repaint

Seats are percent-of-scene, so they survive any rendered size — but a NEW
painting moves the boughs. After any repaint:

1. Open the new painting and note each lantern's position as a percentage of
   the image box (x from left edge, y from top edge, plus hang direction).
2. Update `WORLD_SEATS` in `src/ui/lib/treeSeats.ts` (world ids) and extend
   `NAMESPACE_WORLD` there if a live namespace needs a curated bridge.
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
