# Odin's Throne — Tree Display Interaction Spec

**Prototype:** `tree-display-prototype.html` (v3.13) · **This file:** the behavioral contract for the port.
**Division of truth:** the HTML is the *reference implementation* — its code holds the exact values
(geometry, opacities, sizes, colors) and its inline comments are the *minimum* documentation; THIS md
sits *above* the code and states the behavior that must hold no matter the implementation. Every
change to the prototype updates the HTML, its comments, and this file in the same change. The port
(FiremanDecko) replicates from **both**: this spec for *what must be true*, the HTML for *exact numbers*.

---

## 1. The scene

- One painted moonlit tree (896×1200 backdrop, inline base64 — never regenerate without re-mapping seats).
- **Eleven painted leaf-lanterns = eleven seats.** `SEAT_POOL` is in painting %, curated namespaces
  claim their seats first, the rest seat deterministically (djb2 hash, forward-walk past taken seats).
  Max 11 active namespaces — past that the tree is full and says so ("the tree is full — eleven
  lanterns shine"); a 12th world shares the last lantern.
- The whole scene (painting + light shapes + stones + vine + cards) is **one scrolling canvas** — the
  task list never detaches from its lantern while scrolling.
- Standard mode crops the painting left-anchored (`object-fit: cover`, `object-position 0% 50%`,
  `projectSeat` with `fl = 0`) — **in BOTH modes** (round 20: compact never stretches the
  painting; no `object-fit: fill` anywhere — compact changes only density, never aspect).

## 2. Lantern light states (three, lantern-shaped)

All veils/glows/outlines trace the lantern's own teardrop silhouette (SVG path, per-seat scale from
`LANTERN_SIZE`; never a circle). Three states:

| state | when | look |
|---|---|---|
| **off** | no namespace seated on that painted lantern | dark **veil** (multiply) at **75%** strength — the lantern reads unlit but its **outline stays visible**; a wider halo veil (50%) swallows the painted glow pool |
| **mid** | namespace seated with tasks, its list hidden | intermediately lit (soft cool screen-blend glow); stone icon **transparent** |
| **full** | the clicked world, its task list showing | fully lit + **teal outline** traced around the silhouette, brighter than everything; stone icon swaps to the **opaque** profile-card version (rounded corners, teal glow) |

- **The stone answers the light**: transparent icon at rest → opaque while its tasks hang open →
  transparent the instant it is deactivated.
- **Hover / keyboard focus** lifts a mid lantern toward full (light + label); off lanterns have no
  hit-target and no hover.
- Ladder (pixel-verified): off ≈ 35 lum, mid ≈ 190, full ≈ 230.

## 3. Icons

- **shanaghy.com is the source of truth**; the prototype is **self-contained and static** — it loads
  **zero** external resources. Local copies live in `icons/` (transparent overlay set =
  `/assets/icons/overlay/`) and `icons/opaque/` (profile-card set).
- **Unknown namespaces** (new services) carry the **generic "?" stone** (`icons/unknown-stone.png`) —
  never a borrowed entity's face. Known-but-uncurated worlds are pinned in `NAMESPACE_CURATED`
  (moon, candle) so their stones never change. The inline-glyph fallback is `?`.
- Task icons (hammer/dice/ring/scroll) have no transparent variant on the site yet — cut locally from
  the live opaque ones. **Site follow-up:** publish transparent task icons + `unknown-stone.png` so the
  site remains the sole source.

## 4. The vine & job list — PINNED TO ITS LANTERN'S BULB (round 13)

- Every painted lantern has a **RECORDED popup anchor** (`LANTERN_ANCHOR`, painting % — exact
  per-lantern coordinates derived from the bright-spot centroid + per-seat belly width + 12px stem
  gap; provenance comments in the code). When a world expands, its job list **pops up with its
  TOP-LEFT corner pinned to the right edge of its lantern at the bulbous part** — wherever that
  lantern hangs on the tree. The vine emerges from the lantern, ties onto the pin, and the cards
  stack **straight down from the pin** at fixed pitch (57px standard / 34px compact); the first
  card's top edge sits exactly at the pin's y. A right-edge clamp guards the panel edge for the
  rightmost seats.
- Cards: full info in standard (title, session · issue · agent meta, icon-only pin 📌 / cancel ✕
  clasps on the bottom border); compact squashes to ONE line (title + status dot, no meta, no clasps).
  Card text clears the overlaid sigil: left padding 20px standard / 17px compact (bubble rim at
  13px + breathing gap — round 18).
- Each job's **status sigil overlays its card's left edge** (slightly on top of the box, z-above it,
  following the card when clamped) — **no connecting stem line** (round 14: the stem is struck).
- Hang order: running → failed → pending → succeeded. Canvas grows with the job count; expanding a
  world scrolls the scroller to the top.
- Collapsed worlds show the **cluster** under their lantern instead: status berries + counts, one
  single-row pip strip (max 8 + "+N"), growing left→right in hang order. **Expanding hides the whole
  cluster** — the work itself hangs on the vine.

## 5. The world title section (round 21)

- A **glass panel rides ON the painting's upper sky** (`.wtitle`, absolute in the scene — the green-outlined
  region on the deployed panel, ~90% of the panel width, riding ABOVE the topmost lantern): rounded, teal
  left rim, blurred dark glass, **z-30 above vine and cards**. Its geometry is proportional (%), so compact
  never distorts it — compact only lowers its density.
- **Active world** (the one expanded vine) → box at **100% opacity**, big serif name header in teal, a state
  line ("seated — its vine hangs open"), and **the full shebang** of stats: total tasks on the vine,
  per-status counts each with its **status-color sigil dot**, agent count, and lantern seat `N of 11`.
- **The garden band** (v3.13.2, round 21 restated): beneath the stats — the world's **opaque stone in full
  glory** (32px, glowing) planted in a **moss-bed mini garden** (the band's **left 25%**, moss ground +
  moonlit sky), with the world's **ringfort lore** to its right (worlds are **ringforts** in the shanaghy.com
  tongue — every known world's lore names its ringfort).
- **Known services** carry lore (fleet table `WORLDS_LORE`) and **kin links** — pills that seat the
  related world on click (same `selectWorld` a lantern tap fires). Unknown worlds get the generic seanchaí
  ringfort line, never a borrowed story.
- **Deactivation** (collapse, dead-space click, empty-world rest) → the box **fades to 50% opacity but is
  never wiped**: it keeps the last seated world's name/stats/lore ("its deeds remain") until the next
  selection repaints it and **brightens it back to 100%** with the new info.
- The pane itself is `pointer-events: none` — clicks on it **pass through to the painting** (dead-space
  deselect still fires); only the kin buttons catch clicks.

## 6. Interactions

| interaction | behavior |
|---|---|
| click a mid lantern | becomes **full**: selects + expands (accordion — all others retract), vine grows from the lantern, cluster hides, stone → opaque, scroller to top |
| click the full lantern | collapses: list retracts, stone → transparent, cluster returns |
| click a job card | opens its session as a tab (existing tab is focused + refreshed, never duplicated); cross-world clicks follow the job |
| pin 📌 | toggles the session pin (clasp highlights, meta shows 📌) |
| cancel ✕ | job → terminating (tremble), the card falls from the vine, its tab closes |
| hover / focus a lantern | glabel (world + stats line) + the seat's light lifts toward full |
| keyboard | lanterns are `role=treeitem` buttons: `aria-expanded`, `aria-selected`, visible `:focus-visible` teal ring (a11y, not a decorative circle) |
| «/» compact toggle | denser tree at ANY pane width (manual override): SAME painting projection as standard (cover, LEFT-anchored — no aspect change, round 20), just denser info — smaller stones, one-line cards, pitch 34; toggling off resumes standard |
| `api: new world` | a namespace the backend doesn't know takes an empty seat wearing the **? stone** (until the tree is full) |
| summary fetch in flight | "fetching the world's work…" note by the lantern |
| summary unavailable | world dims, "summary unavailable" note, no vine, label shows the error |
| empty world | "no tasks in this world" note on a bare (dashed) vine — and the selection **auto-deactivates after 2 seconds** (lantern back to mid, vine retracted, nothing selected; log hall notes "this world holds no work — its lantern rests"). Any click cancels the pending rest; work arriving inside the window keeps the seat (round 15) |
| live growth | running jobs advance steps, may succeed/fail; quiet selected worlds sprout new work; gold spores drift while the feed is live — **the feed always starts PAUSED at first load** (button "live growth: off", HUD "ws feed paused", spores still; one click wakes it — round 16) |
| the title box (deactivated) | **fades to 50%** over 0.6s, content unchanged ("its deeds remain") — the next selection repaints + brightens it back to 100% |
| kin link pill | seats the related world (same as clicking its lantern): accordion swaps, box repaints at full opacity |
| click in dead space | the active lantern **deactivates immediately** (the title box dims with it) (vine retracted, nothing selected, hall notes "the lantern rests"); anything interactive — stone, card, clasp, sigil, cluster, note, button — is exempt (round 17) |
| `prefers-reduced-motion` | all animations off (vine growth, pop-ins, spores, pulses) |

## 7. Port acceptance (verify, don't trust)

- [ ] Three light states pixel-verify: off ≈ 35 / mid ≈ 190 / full ≈ 230 core luminance; off outline visible (inner ring max ≥ ~50)
- [ ] Full state: teal ring traced around the silhouette + opaque stone; collapse returns the transparent stone
- [ ] Unrecognized namespace → "?" stone; pinned worlds keep moon/candle
- [ ] **First card top-left = its lantern's recorded bulb anchor** (LANTERN_ANCHOR, ± 2px) for a
      high, mid, and low lantern; cards stack straight down from the pin at pitch 57/34; first card
      top edge level with the pin's y
- [ ] Click cycle mid→full→mid, hover lift, focus ring, accordion exclusivity
- [ ] Selecting a taskless world: FULL for exactly 2s, then selection deactivates itself (back to mid, vine retracted, nothing selected); a click or a sprouted job inside the window cancels the rest
- [ ] Clicking dead space (scene/painting, not any interactive element) deactivates the active lantern at once; clicking stone/card/clasp/sigil/cluster/note/button never deselects
- [ ] Zero external resources when loaded from disk; icons from the local sets
- [ ] Live growth OFF at first load: button "live growth: off" (aria-pressed false), HUD "ws feed paused", no spore motion, running jobs hold their steps — one click turns it all on
- [ ] Compact mode: seats still on painted lanterns (same cover projection as standard — painting aspect ratio IDENTICAL between modes), one-line cards, no clasps
- [ ] Cluster hides on expand, returns on collapse; pip strip single-row, +N past 8
- [ ] **Title section**: active world → box 100% + teal name + per-state stats sigils + the GARDEN BAND (opaque stone in full glory in the left-25% moss bed, ringfort lore naming the world's ringfort to its right) + kin pills; deactivate → 50% fade with SAME content; next selection → back to 100% with new info; kin click seats that world; pane clicks pass through (dead-space deselect); unknown world → generic ringfort lore
- [ ] A11y: treeitem roles, aria-expanded/selected, focus-visible ring

## 8. Port mapping (prototype → shipped plugin)

| prototype | plugin |
|---|---|
| SEAT_POOL / CURATED_SEATS / projectSeat | `src/ui/lib/treeSeats.ts` |
| LANTERN_PATH / LANTERN_SIZE / lseat states | new light layer in `NamespaceTree.tsx` + `index.css` |
| NAMESPACE_CURATED / unknown-stone / transparent↔opaque swap | `src/ui/lib/namespaceIcons.ts` + `TreeIcon` |
| vineFor (rail join at lantern height) | `src/ui/lib/vineGeometry.ts` |
| lantern/stone/glow CSS | `src/ui/styles/index.css` (.ns-tree__lantern block) |
| WORLDS_LORE / renderWorldTitle / .wtitle CSS | new `WorldTitle` component + `src/ui/lib/worldLore.ts` (selection-dim state machine: track last seated world, opacity 1 ↔ .5) |

**Repo gates:** tsc + build + smoke (`npm test` — needs the `test/register.mjs` shim, jsdom dep).
