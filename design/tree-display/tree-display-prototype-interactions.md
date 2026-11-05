# Odin's Throne — Tree Display Interaction Spec

**Prototype:** `tree-display-prototype.html` (v3.16) · **This file:** the behavioral contract for the port.
**Division of truth:** the HTML is the *reference implementation* — its code holds the exact values
(geometry, opacities, sizes, colors) and its inline comments are the *minimum* documentation; THIS md
sits *above* the code and states the behavior that must hold no matter the implementation. Every
change to the prototype updates the HTML, its comments, and this file in the same change. The port
(FiremanDecko) replicates from **both**: this spec for *what must be true*, the HTML for *exact numbers*.

---

## 1. The scene

- ONE painted tree per theme (896×1200 backdrops — never regenerate without re-mapping seats):
  **dark** = the moonlit tree (inline base64), **light** = the parchment tree (`backdrop-parchment.jpg`,
  sibling file, prompt beside it). The ☀ header toggle flips `data-theme="light"` on the root and swaps
  painting + seat pool (v3.16).
- **Eleven painted leaf-lanterns = eleven seats, per painting.** `SEAT_POOL` (dark) and
  `SEAT_POOL_LIGHT` (parchment) are each in painting %; seat indices are theme-stable — curated
  namespaces claim their seats first, the rest seat deterministically (djb2 hash, forward-walk past
  taken seats). The **light pool was re-calculated from the parchment painting's own amber lantern
  cores** (pixel detection cross-checked by one Gemini pass — pixels win), with re-measured bulb
  anchors (`LANTERN_ANCHOR_LIGHT`) and silhouettes (`LANTERN_SIZE_LIGHT`); the SAME `projectSeat()`
  cover LEFT-anchored crop carries both pools in both modes. Max = the pool's length; past that the
  tree is full and says so ("the tree is full — N lanterns shine"); one world over shares the last lantern.
- The whole scene (painting + light shapes + stones + vine + cards) is **one scrolling canvas** — the
  task list never detaches from its lantern while scrolling.
- Standard mode crops the painting left-anchored (`object-fit: cover`, `object-position 0% 50%`,
  `projectSeat` with `fl = 0`) — **in BOTH modes** (round 20: compact never stretches the
  painting; no `object-fit: fill` anywhere — compact changes only density, never aspect).

## 2. Lantern light states (four, lantern-shaped — the FOUR-TIER DIM LADDER)

All veils/glows/outlines trace the lantern's own teardrop silhouette (SVG path, per-seat scale from
`LANTERN_SIZE`; never a circle). FOUR states — v3.15 (round 23), the **FOUR-TIER DIM LADDER**.
Decree: *"75% dead, no namespace attached / 50% alive no tasks / 25% alive with tasks, deactivated /
0% activated, alive with tasks and actively displaying job list"* — **the veil opacity IS the
decree's dim %**, one monotonic rung per state so dead / empty-but-seated / task-bearing-but-
deactivated / active are never confusable:

| state | when | look |
|---|---|---|
| **off** | no namespace seated on that painted lantern | dark **veil** (multiply) at **75%** strength — the lantern reads unlit but its **outline stays visible**; a wider halo veil (50%) swallows the painted glow pool |
| **empty** | namespace seated with **zero tasks**, not selected (v3.15 — split out of mid) | veil at **50%** strength, no glow — alive but quiet; its **stone dims to .65 + desaturates** and it carries **no berries** (the bare half-lit lantern IS the empty signal) |
| **mid** | namespace seated with tasks, its list hidden (deactivated) | veil at **25%** strength (was 34%) + its soft cool screen-blend glow — clearly brighter than empty; stone icon **transparent** |
| **full** | the clicked world, its task list showing | veil **0** — fully lit + **teal outline** traced around the silhouette, brighter than everything; stone icon swaps to the **opaque** profile-card version (rounded corners, teal glow) |

- **The stone answers the light**: transparent icon at rest → opaque while its tasks hang open →
  transparent the instant it is deactivated.
- **Hover / keyboard focus** lifts a seated lantern toward full (light + label; the empty tier's
  hover lift stays one rung below mid's); off lanterns have no hit-target and no hover.
- Ladder (pixel-verified per the tree skill's pixel-verification recipe, overlay chrome hidden):
  **off ≈ 33 lum · empty ≈ 119 · mid ≈ 189 · full ≈ 228** — a clean four-step monotonic hierarchy.
- An empty world that gains work **climbs the ladder live**: empty → full while selected, resting
  at mid when deactivated. A world whose work drains to zero falls back to empty.

### 2b. The light theme (PARCHMENT & MEAD HALL, v3.16 round 24)

- **Toggle**: the ☀ button in the tree panel header (far-right order: count · compact · theme · status).
  Flips `data-theme="light"` on the root; in-memory persistence for the session (prototype). The button
  shows ☀ while dark, ☾ while light; `aria-pressed` = light.
- **Tokens** come from proposal #2's measured AA table (PROPOSAL.md §2.3): vellum `#FBF5E6`, iron-gall
  ink `#2B1D12` (never pure black), ember `#B4451B`, bronze rules `#C3A87A`, mead-gold `#E8B54A` accents,
  display gold `#AE6F14`, verdigris `#0B6B5C` (replaces the teal for rings/links in light), status
  palette running `#0F6B7A` / succeeded `#2E6B34` / failed `#A32318` / pending `#8A5A0B`. Nothing on
  screen is white; all interactive surfaces are OPAQUE (title box, cards, hover labels, clasps, notes,
  chips — solid vellum; the frost is struck); glow lives in box/drop-shadows only.
- **Ladder inversion (proposal #2's signature move)**: in light, **BRIGHT = lit, WASHED = dim**. The
  dark multiply veils become a warm vellum wash (`#EFE6D2`, normal blend): off `.55` (+ halo wash `.35`)
  / empty `.40` / mid `.18` (+ mead glow) / full `0` — the lit lantern is the brightest thing on the
  page. The glow flips from screen-blend moonlight (`#lglowg`) to the mead-gold sun radial
  (`#lglowg-sun`); the FULL ring is verdigris with a mead drop-shadow. Teardrop shapes, per-seat
  silhouettes, and the four-tier semantics are IDENTICAL to dark.
- **Seats**: flipping the theme swaps the backdrop (dark keeps the embedded base64; light references
  the sibling `backdrop-parchment.jpg`) and the pool — every world keeps its seat INDEX but re-seats
  onto the parchment painting's own lanterns (`SEAT_POOL_LIGHT`, painting %, same `projectSeat()`
  projection — no new math). The tree header sub-line and the tree-full note carry the active pool's
  count. Berries/anchor sigils/status chips follow the light status palette.

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
- **Known services** carry lore (the embedded **REALM knowledge db**, round 24) and **kin links** — pills that open the
  related **entity's profile page** on shanaghy.com in a new tab (`target="_blank"`, round 22 — they no longer seat
  another namespace; the throne's selection is untouched). The **world NAME** links to the world's **own page** —
  its stone if one exists (`/sessions/fenrir-ledger/`, `/projects/odins-throne/`, `/projects/re-goatmower/`), else
  its persona's profile (fionn for MyTruthFinder), else the hub itself (Shanaghy.com) — and **entity mentions inside
  the lore are linkified** from the db (entity names + aliases, longest first, first hit each). Unknown worlds get
  the generic seanchaí ringfort line, never a borrowed story, and a plain-text name.
- **Deactivation** (collapse, dead-space click, empty-world rest) → the box **fades to 50% opacity but is
  never wiped**: it keeps the last seated world's name/stats/lore ("its deeds remain") until the next
  selection repaints it and **brightens it back to 100%** with the new info.
- The pane itself **catches its own clicks** (`pointer-events: auto` + `.wtitle` in the dead-space exempt list,
  round 24): a click **anywhere in the title area never deactivates the world** — only the links inside act
  (name → the world's own page, lore mentions + kin pills → entity profiles).

## 6. Interactions

| interaction | behavior |
|---|---|
| click a seated lantern (mid or empty) | becomes **full**: selects + expands (accordion — all others retract), vine grows from the lantern, cluster hides, stone → opaque, scroller to top |
| click the full lantern | collapses: list retracts, stone → transparent, cluster returns |
| click a job card | opens its session as a tab (existing tab is focused + refreshed, never duplicated); cross-world clicks follow the job |
| pin 📌 | toggles the session pin (clasp highlights, meta shows 📌) |
| cancel ✕ | job → terminating (tremble), the card falls from the vine, its tab closes |
| hover / focus a lantern | glabel (world + stats line) + the seat's light lifts toward full |
| keyboard | lanterns are `role=treeitem` buttons: `aria-expanded`, `aria-selected`, visible `:focus-visible` teal ring (a11y, not a decorative circle) |
| «/» compact toggle | denser tree at ANY pane width (manual override): SAME painting projection as standard (cover, LEFT-anchored — no aspect change, round 20), just denser info — smaller stones, one-line cards, pitch 34; toggling off resumes standard |
| `api: new world` | a namespace the backend doesn't know takes an empty seat wearing the **? stone** — and seats at the **empty** tier (50% rung) until work arrives (until the tree is full) |
| summary fetch in flight | "fetching the world's work…" note by the lantern |
| summary unavailable | world dims, "summary unavailable" note, no vine, label shows the error |
| empty world | "no tasks in this world" note on a bare (dashed) vine — and the selection **auto-deactivates after 2 seconds** (lantern back to its **empty** resting light — the 50% rung, v3.15 — vine retracted, nothing selected; log hall notes "this world holds no work — its lantern rests"). Any click cancels the pending rest; work arriving inside the window keeps the seat (round 15) |
| live growth | running jobs advance steps, may succeed/fail; quiet selected worlds sprout new work; gold spores drift while the feed is live — **the feed always starts PAUSED at first load** (button "live growth: off", HUD "ws feed paused", spores still; one click wakes it — round 16) |
| the title box (deactivated) | **fades to 50%** over 0.6s, content unchanged ("its deeds remain") — the next selection repaints + brightens it back to 100% |
| kin link pill | opens the related **entity's profile page** on www.shanaghy.com in a new tab (round 22 — no namespace jump; the throne's selection is untouched) |
| click in dead space | the active lantern **deactivates immediately** (the title box dims with it) (vine retracted, nothing selected, hall notes "the lantern rests"); anything interactive — stone, card, clasp, sigil, cluster, note, button — **and the whole title box** are exempt (rounds 17 + 24: a click in the title area never deactivates) |
| `prefers-reduced-motion` | all animations off (vine growth, pop-ins, spores, pulses) |

## 7. Port acceptance (verify, don't trust)

- [ ] **Four-tier dim ladder** pixel-verify (overlay chrome hidden, per the tree skill's recipe): off ≈ 33 / **empty ≈ 119** / mid ≈ 189 / full ≈ 228 core luminance — four monotonic steps; off outline visible (inner ring max ≥ ~50)
- [ ] **Empty tier**: a seated taskless world renders veil **.50** + stone **.65** + **no berries**; selecting it → full for exactly 2s → rests back to **empty** (not mid); work arriving inside the window keeps the seat and the collapsed world then rests at **mid**
- [ ] Full state: teal ring traced around the silhouette + opaque stone; collapse returns the transparent stone
- [ ] Unrecognized namespace → "?" stone; pinned worlds keep moon/candle
- [ ] **First card top-left = its lantern's recorded bulb anchor** (LANTERN_ANCHOR, ± 2px) for a
      high, mid, and low lantern; cards stack straight down from the pin at pitch 57/34; first card
      top edge level with the pin's y
- [ ] Click cycles mid→full→mid and empty→full→(2s rest)→empty, hover lift, focus ring, accordion exclusivity
- [ ] Selecting a taskless world: FULL for exactly 2s, then selection deactivates itself (back to **empty** — the 50% rung — vine retracted, nothing selected); a click or a sprouted job inside the window cancels the rest
- [ ] Clicking dead space (scene/painting **outside the title box**, not any interactive element) deactivates the active lantern at once; clicking stone/card/clasp/sigil/cluster/note/button **or anywhere in the title box** never deselects
- [ ] Zero external resources when loaded from disk; icons from the local sets
- [ ] Live growth OFF at first load: button "live growth: off" (aria-pressed false), HUD "ws feed paused", no spore motion, running jobs hold their steps — one click turns it all on
- [ ] Compact mode: seats still on painted lanterns (same cover projection as standard — painting aspect ratio IDENTICAL between modes), one-line cards, no clasps
- [ ] Cluster hides on expand, returns on collapse; pip strip single-row, +N past 8
- [ ] **Title section**: active world → box 100% + teal name (a **LINK to the world's own page** on shanaghy.com — REALM db `worlds[].profile`) + per-state stats sigils + the GARDEN BAND (opaque stone in full glory in the left-25% moss bed, ringfort lore naming the world's ringfort to its right, **entity mentions linkified**) + kin entity links; deactivate → 50% fade with SAME content; next selection → back to 100% with new info; kin click opens the entity's profile page in a new tab (selection unchanged); **clicks anywhere in the title box NEVER deactivate the world** (round 24); unknown world → generic ringfort lore + plain-text name
- [ ] A11y: treeitem roles, aria-expanded/selected, focus-visible ring
- [ ] **Light theme (v3.16)**: ☀ flips `data-theme="light"` + swaps painting and seat pool; every
      stone still lands on ITS pool's lantern through the same `projectSeat()` (exp == act for all
      worlds, dark AND light, standard AND compact); light ladder is the inverted wash (off .55 /
      empty .40 / mid .18 / full 0 + mead glow + verdigris ring — verify via computed styles); every
      interactive surface opaque (wtitle, jcard, glabel, jact, branch-note); no horizontal overflow
      beyond the pre-existing hover-glabel class; dark theme + geometry byte-identical to v3.15
      behavior (regression: same seat projections, clearances, ladder opacities)

## 8. Port mapping (prototype → shipped plugin)

| prototype | plugin |
|---|---|
| SEAT_POOL / CURATED_SEATS / projectSeat | `src/ui/lib/treeSeats.ts` |
| SEAT_POOL_LIGHT / LANTERN_ANCHOR_LIGHT / LANTERN_SIZE_LIGHT / ☀ theme toggle / `[data-theme="light"]` ladder inversion (off .55 / empty .40 / mid .18 / full 0, mead `#lglowg-sun` glow, verdigris ring) | `treeSeats.ts` (second pool) + `NamespaceTree.tsx` (theme-aware pool/anchor/size) + `index.css` `[data-theme="light"]` blocks (proposal-2 tokens) |
| LANTERN_PATH / LANTERN_SIZE / lseat states (four-tier ladder: off .75 / empty .50 / mid .25 / full 0 — empty = seated world with zero tasks; stone .65 + no berries) | new light layer in `NamespaceTree.tsx` + `index.css` |
| NAMESPACE_CURATED / unknown-stone / transparent↔opaque swap | `src/ui/lib/namespaceIcons.ts` + `TreeIcon` |
| vineFor (rail join at lantern height) | `src/ui/lib/vineGeometry.ts` |
| lantern/stone/glow CSS | `src/ui/styles/index.css` (.ns-tree__lantern block) |
| WORLDS_LORE / renderWorldTitle / .wtitle CSS | new `WorldTitle` component + `src/ui/lib/worldLore.ts` (selection-dim state machine: track last seated world, opacity 1 ↔ .5) |

**Repo gates:** tsc + build + smoke (`npm test` — needs the `test/register.mjs` shim, jsdom dep).
