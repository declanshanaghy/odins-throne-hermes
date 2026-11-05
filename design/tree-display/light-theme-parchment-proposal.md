# Proposal #2 — "Parchment & Mead Hall"

**Surface:** Odin's Throne light mode (`data-theme="light"`)
**Repo (read-only):** `src/github.com/declanshanaghy/odins-throne-hermes`
**Author:** design proposal for Odin's decree
**Deliverables:** this file, `mockup.html`, `screenshot.png`

---

## 0. The one-line thesis

Light mode is not "half-styled" — it is **token-deep and component-shallow**. The
palette block is good, the component layer barely knows it exists.

**`src/ui/styles/index.css` is 4,254 lines / 834 rule blocks. Exactly 11 selectors
in the whole file mention `[data-theme="light"]`, one of which is the token block
itself** (`:71`). Ten component overrides. Everything else — the sidebar, the
lantern tree, the vine cards, the log viewer, the workspace tooltips, the
Ragnarök dialog — was written against the dark painting with literal rgba/hex
values and never learned a second theme.

So: a competent warm-parchment palette is laid underneath a **near-black painted
tree backdrop** (`src/ui/assets/tree-backdrop.jpg`, imported at
`src/ui/components/NamespaceTree.tsx:55`) and a set of **hardcoded dark slabs**.
The result is a light *background* with dark *contents*: the reported "light mode
doesn't work".

This proposal keeps the good bones (the token names, the semantic structure) and
replaces the visual language with **aged parchment, iron-gall ink, ember and
mead-gold** — a Norse light mode, not corporate white.

---

## 1. Diagnosis — concrete defects, with evidence

All line numbers are `src/ui/styles/index.css` unless stated otherwise.

### D1 — Only ~10 component-level light overrides exist for 834 rule blocks

```
$ grep -c '\[data-theme="light"\]' src/ui/styles/index.css   →  11   (one is the token block, :71)
$ grep -c '{'                     src/ui/styles/index.css   →  834
```

The ten component overrides are `:1886–1888` (three icon colours), `:2236`,
`:2271`, `:2326`, `:2330`, `:3707`, `:3967`, `:4194`. **Nothing in the sidebar,
the tree scene, the vine cards, the log viewer, the tool-call surfaces, or the
toasts' internals is theme-aware.** This is the root structural defect: light
mode is a paint job over a dark-themed component layer.

### D2 — The primary interactive surface (the vine card) is a hardcoded black slab

```css
/* :1024 */
.jcard {
  width: 212px;
  background: linear-gradient(180deg, rgba(29, 36, 40, 0.97), rgba(10, 16, 20, 0.98));  /* :1032 */
  border: 1px solid rgba(214, 236, 240, 0.26);                                          /* :1033 */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5), 0 0 9px var(--card-glow, transparent);     /* :1040 */
}
```

No `[data-theme="light"] .jcard` rule exists. In light mode the task cards —
the thing the user clicks, pins, cancels — render as opaque near-black slabs
floating on a cream page, with a **cool** `rgba(214,236,240,…)` border that
belongs to the dark palette. This alone accounts for most of the "broken" look.

### D3 — Vine-card text is hardcoded pale slate

```css
.jcard__meta b { color: #c9d8dd; font-weight: 600; }   /* :1117 */
```

#c9d8dd on a parchment field is **1.35:1** (1.15:1 on the lighter vellum) —
effectively invisible text. The `b` element carries session/issue/agent identity
on every card.

### D4 — Card status dots bypass the token system entirely

```css
.jcard--running .jcard__dot   { background: #6fb7d8; ... }   /* :1098 */
.jcard--succeeded .jcard__dot { background: #79b356; }       /* :1099 */
.jcard--failed .jcard__dot    { background: #e07a3f; ... }   /* :1100 */
.jcard--pending .jcard__dot   { background: #8a9296; }       /* :1101 */
```

These literals duplicate `STATUS_COLORS` (`src/ui/lib/constants.ts:124–131`) in a
*third* place. Measured on vellum `#FBF5E6`: running `#6fb7d8` **2.0:1**,
succeeded `#79b356` **2.3:1**, failed `#e07a3f` **2.8:1**, pending `#8a9296`
**2.9:1** — **all four below the 3:1 minimum for a non-text status affordance**.
`STATUS_COLORS_LIGHT` map (`constants.ts:134–141`) added for the log header
(`LogViewer.tsx:106`) never reaches the cards.

### D5 — The world-title panel is frosted glass *and* dark, in violation of the decree

```css
.wtitle {                                              /* :547 */
  border: 1px solid rgba(176, 196, 201, 0.14);         /* :554 */
  border-left: 3px solid #15b8a6;                      /* :555 */
  background: rgba(6, 10, 14, 0.55);                    /* :557 */
  backdrop-filter: blur(6px);                           /* :558 */
  -webkit-backdrop-filter: blur(6px);                   /* :559 */
  opacity: 0.5;                                         /* :560 */
  pointer-events: auto;                                 /* :562 */
}
```

Two decree violations in one rule: **an interactive surface (clickable title,
`pointer-events: auto`, `:562`) at 0.55 alpha with a backdrop blur**. Over the
light fresco's sky (`#FDF7E9`) that 0.55 ink film resolves to **#757571** — a
mid-grey slab — and the title text (`rgba(176,196,201,0.9)`) lands at **2.35:1**
on it. It is also the single worst readability failure in the scene.

### D6 — The entire world-title text cluster is cool slate on what will be cream

```css
.wtitle__name      { color: rgba(176, 196, 201, 0.9); }  /* :572 */
.wtitle.is-live .wtitle__name { color: #15b8a6; }        /* :578 */
.wtitle__lore      { color: rgba(126, 148, 154, 0.9); }  /* :665  (also :600, :613) */
.wtitle__lore-link { color: #15b8a6; }                   /* :586, hover :590 */
.wtitle__kin-pill  { color: rgba(126, 148, 154, 0.9);    /* :683 */
                     border: 1px solid rgba(176, 196, 201, 0.14); }  /* :686 */
.wtitle__kin-pill::before { color: #15b8a6; }            /* :695  (hover/focus :696–697) */
```

`rgba(126,148,154,0.9)` composites over vellum to **#8A9EA2 = 2.58:1** (it
resolves to **#7E949A** ≈ 2.35:1 over the frosted panel's grey ground) — the lore
line and the kin pills ("4Na Seanchaith", "4Foxes Bow" in the screenshot) become
unreadable. Five literals plus two teal links, no theme awareness.

### D7 — The lantern tree's dim ladder is a *multiply* mask tuned for a dark painting

```css
.lseat__veil { fill: #04070a; mix-blend-mode: multiply; opacity: 0.93; }  /* :508 */
.lseat__halo { fill: #04070a; mix-blend-mode: multiply; opacity: 0; }     /* :510 */
.lseat--off   .lseat__veil { opacity: 0.75; }   /* :516 */
.lseat--empty .lseat__veil { opacity: 0.5; }    /* :520 */
.lseat--mid   .lseat__veil { opacity: 0.25; }   /* :527 */
.lseat--full  .lseat__veil { opacity: 0; }      /* :533 */
```

The four-tier "lit / dim" language (issue #97) is implemented by *multiplying
near-black over the painted lantern to darken it*. Multiply-darken is a dark-mode
idiom: over a bright fresco it does the opposite of what the design wants — the
veiled seat goes to a muddy grey-black splotch on cream, and the "glow" it is
meant to contrast against is a **screen-blend** radial
(`.lseat__glow { mix-blend-mode: screen }`, `:512`) whose screen-blend lifts
toward white — which on a light ground is *invisible*. The whole brightness
ladder inverts. This is why the stones read as smudges in light mode.

### D8 — The lantern glow colour is a hardcoded dark-mode literal

```css
.ns-tree--lanterns {                       /* :726 */
  --lg-moon:  rgba(176, 196, 201, 0.30);   /* :727 */
  --lg-teal:  rgba(21, 184, 166, 0.55);    /* :728 */
  --lg-ember: rgba(224, 122, 63, 0.42);    /* :729 */
  --lg-moss:  rgba(121, 179, 86, 0.36);    /* :730 */
  --lantern-light: rgba(255, 226, 168, 0.62);  /* :732 */
  --glabel-bg:     rgba(5, 7, 10, 0.97);   /* :737 */
}
```

The glow vars are declared *inside the dark component scope*, not in `:root` /
`[data-theme]`, so no theme can reach them. `--glabel-bg` is an **opaque black**
hover chip (`:931 background: var(--glabel-bg)`), reinforced by
`text-shadow: 0 0 2px #000` at `:925–926` — a hard-coded black halo that only
makes sense over a dark painting.

### D9 — Other hardcoded dark surfaces with no light treatment

| Selector | Line | Value | Why it breaks |
|---|---|---|---|
| `.ns-tree__note` | `:1011` | `rgba(5, 7, 10, 0.82)` + dashed `rgba(176,196,201,0.22)` | empty-realm note chip: black pill on cream |
| `.decree-body-block` | `:2299` | `rgba(7, 7, 13, 0.6)` | overridden at `:2326`, but **see D10** |
| `.decree-body-fence` | `:2312` | `rgba(7, 7, 13, 0.7)` | as above, override at `:2330` |
| `.norse-error-tablet` | `:2938` | `background: #07070d;` — comment literally says *"intentionally dark-only — see comment above"* | error state flashes a black full-panel in light mode |
| `.rdk-shell` | `:3956` dark `#07070d`, light `:3967` → `#12060a` | "light" override is a **near-black maroon** | the Ragnarök dialog has no light mode at all; the override only tweaks the hue |
| `.apm-backdrop` | `:3700` `rgba(7,7,13,0.75)`; light `:3707` → `rgba(15,20,25,0.55)` | modal scrim stays **cool near-black** while the modal shell itself is `var(--forge)` (`:3713`) | cold scrim on a warm page; the scrim is the only thing in frame that isn't parchment |

### D10 — A light-mode override references a token that does not exist

```css
[data-theme="light"] .decree-body-block { background: rgba(210,200,180,0.5); color: var(--text-primary); }  /* :2326–2329 */
[data-theme="light"] .decree-body-fence { background: rgba(240,235,220,0.7); color: var(--text-primary); }  /* :2330–2333 */
```

```
$ grep -rn -- '--text-primary:' src/    →  (no results)
```

`--text-primary` is **never defined anywhere in the repository**. Both
declarations are invalid at computed-value time, so `color` falls back to
inherited. Code blocks in decrees lose their intended ink colour and silently
adopt whatever ancestor colour happens to apply. (The *other* problem here is
that the two overrides are only 0.5/0.7-alpha — translucent fills on an
interactive-ish reading surface, against the decree.)

### D11 — Interactive tool-call surfaces are translucent in light mode

```css
--mist-tool-bg:     rgba(185, 162, 115, 0.30);   /* :106 (light block) */
--mist-tool-border: rgba(120, 95, 55, 0.25);     /* :107 */
--mist-tool-hover:  rgba(165, 142, 95, 0.50);    /* :108 */
--tool-batch-header-bg:    rgba(100, 80, 45, 0.08);  /* :110 */
```

`.ev-tool { background: var(--mist-tool-bg) }` (`:2828`) with a **clickable**
header (`.ev-tool-header { cursor: pointer }`, `:2831`; hover `:2838`). At 0.30
alpha over the parchment body this is a ghost box; at 0.50 hover it is a slightly
darker ghost. Violates the ≥0.96-opacity rule for interactive surfaces. Same for
`--tool-batch-header-bg` at 0.08.

### D12 — The "light" toast is pure white — exactly the corporate look to avoid

```css
[data-theme="light"] .toast {
  background: #ffffff;                       /* :4195 */
  border-color: var(--gold);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15), 0 0 6px rgba(143,110,14,0.15);
}
```

`#ffffff` sits on a `hsl(38,40%,89%)` page as a cold white card — measured
**1.27:1** against the parchment ground (a 1.3:1 "contrast" between two surfaces
is a visible colour break, not a texture). It is the single most visible "this
isn't a Norse theme" artefact in light mode.

### D12b — The existing light palette itself carries a systemic AA failure

```
[data-theme="light"] --gold-bright: #d97706;   /* index.css:76 */
```

`#d97706` measures **2.51:1** on `--void` parchment, and it is used as *text* in
**16** places, not as a graphic:

```
:1584  :1699  :1774  :1825  :1895  :1928  :2132  :2215  :2243  :2289
:2339  :2363  :2479  :2513  :2797  :3625   (color: var(--gold-bright))
```

That covers `.ws-badge.connecting` (`:1895`), `.log-warning` (`:1928`),
`.decree-section-body strong` (`:2243`), `.decree-body-link:hover` (`:2339`) and
the norse-tablet headers. **The current light mode therefore ships sub-AA amber
text across the decree, warning and connection surfaces** — it is not only the
hardcoded dark literals that break light mode; the token values themselves do.
Parchment & Mead Hall resolves this by splitting the role: mead `#E8B54A` is
*light* (shadow/fill only, never ink), `--gold-bright #AE6F14` is *display ink and
the graphic colour* (3.25:1 parchment / 3.8:1 vellum — AA-large and ≥3:1 as a
rule/ring anywhere), and `--gold #8A5A0B` is the *body ink* (4.7–5.4:1).

### D13 — Theme logic is scattered across at least 7 JS call sites

```
src/ui/components/LogViewer.tsx:106        theme === "light" ? STATUS_COLORS_LIGHT : STATUS_COLORS
src/ui/components/LogViewer.tsx:612        avatarUrl(..., theme === "light" ? "light" : "dark")
src/ui/components/DecreeBlock.tsx:270      avatarUrl(agentKey, theme === "light" ? "light" : "dark")
src/ui/components/DecreeBlock.tsx:320      background: theme === "light" ? "rgba(100,80,45,0.12)" : "rgba(42,42,62,0.6)"
src/ui/components/Sidebar.tsx:167          avatarUrl("odin", theme === "light" ? "light" : "dark")
src/ui/components/AgentProfileModal.tsx:31 primaryVariant = theme === "light" ? "light" : "dark"
src/ui/components/AgentProfileModal.tsx:34 avatarUrl(agentKey, primaryVariant === "light" ? "dark" : "light")
src/ui/components/ThemeSwitcher.tsx:14,25  next = theme === "light" ? "dark" : "light"
```

These are *styling* decisions expressed as inline JS — the shared rule in
SHARED.md is right that this is the second half of the root cause. `constants.ts`
holds **two parallel colour maps** (`:124`, `:134`) keyed by status: adding a new
`Job["status"]` to one map and not the other silently ships a dark-theme colour
on parchment. `DecreeBlock.tsx:320` inlines a colour ternary that no token table
can audit.

---

## 2. "Parchment & Mead Hall" — the design language

### 2.1 Concept

Light mode becomes an **illuminated manuscript laid open on a mead-hall table**:
warm vellum, iron-gall ink, bronze rules, gold leaf, and ember heat. The Norse
mythic register survives by *material*, not by darkness — the same way a real
manuscript carries the same sagas in gold and soot-black on cream.

Three rules drive every choice below:

1. **Nothing on screen is white.** The lightest surface is `#FBF5E6` (vellum).
   Pure `#fff` is banned from surfaces; it appears only in specular glow shadows.
2. **Ink, not black.** Text bottoms out at `#2B1D12` — a warm iron-gall ink. No
   `#000`, no cool greys (`#c9d8dd`, `#7E949A`, `#8a9296` all die).
3. **Glow is additive gold in `box-shadow`.** Every "lit" affordance (active
   lantern, live status dot, selected tab) gets a honeyed-mead halo *outside* its
   opaque fill — the decree's glow rule, and it is exactly how illumination works
   on parchment.

### 2.2 The tree scene: dark painting → *light fresco*

This is the heart of proposal #2. The dark `tree-backdrop.jpg` (a moonlit painted
tree over a dark glade) is **conceptually replaced** by a **gilded-fresco tree**:
the tree as it would appear in a page of an illuminated manuscript — pale sky, a
sage-and-gold canopy, and a bronze trunk — drawn in CSS gradients and SVG shapes
only (no network asset, and the mockup proves it).

The scene, described precisely as layers, bottom to top:

| # | Layer | Treatment |
|---|---|---|
| 0 | **Sky ground** | Vertical `linear-gradient`: `#FDF7E9` at the top → `#F4E7C9` mid → `#EDDCB8` at the horizon. This is the fresco's primer. |
| 1 | **Sun disc** | Radial gradient centred upper-left: `rgba(232,181,74,0.34)` core → transparent at 60%. The one warm light source; the tree's glow vocabulary hangs off it. Replaces the moon that the dark painting glowed against. |
| 2 | **Distant hills** | Two soft `radial-gradient` domes in `#DFD2AE` / `#D5C6A0` at 4–8% opacity behind the tree base — manuscript "distance haze". |
| 3 | **Canopy masses** | Six overlapping `radial-gradient` blobs in **sage/olive leaf tones** — `#A9B478`, `#94A366`, `#7E8F57` — clustered in the upper third, plus two **gold-leaf highlight** blobs `#D9A93C` at 55% opacity where the sun strikes. Each blob has a `1px` `#8A9A5F`-ish edge via a companion inner gradient so the canopy reads as drawn, not airbrushed. |
| 4 | **Trunk & limbs** | SVG paths (12 tapered strokes) in `#8A6A43` with `#6B4F2F` shadow strokes and a `#C29A63` highlight line down the sunlit side. Trunk anchors at bottom-left third; limbs fan up-left, matching the seat geometry of the current `SEAT_POOL` so the lantern positions still land on canopy. |
| 5 | **Lantern seats** | 11 seat shapes: a **teardrop silhouette** (same geometry as `LANTERN_PATH`) filled with warm glass `#F7E3B4`, `1px` `#A9873F` outline, and a `box-shadow`-style outer glow `0 0 14px rgba(232,181,74,0.55)` when lit. **Unlit seats are not darkened by multiply** (that is the D7 bug) — they are *washed out*: fill `#EADFC5`, outline `#C9B78C`, no glow. **Bright means lit; washed-out means dark.** The ladder is inverted to suit light. |
| 6 | **Vine** | A single `#7A6448` 2px bezier stroke descending from the canopy to the card anchors, with leaf ticks in `#8E9C63`. |
| 7 | **Realm stones** | Small vellum plaques (opaque `#FBF5E6`, `1px #C3A87A`, 4px radius, `0 1px 2px rgba(90,67,48,0.18)` shadow) carrying the realm rune + name. They sit *on* the fresco like pasted labels in a manuscript — opaque, per the decree. |
| 8 | **Scene frame** | `1px solid #C3A87A` with a `3px` inset `box-shadow: inset 0 0 0 3px rgba(255,255,255,0.45)` "deckled edge" + a 2-stop warm vignette (`rgba(120,90,50,0.10)` corners) so the fresco reads as a page, not a photo. |

Net effect: the sidebar goes from "black rectangle with a painting" to "warm
window of daylight with a gilded tree", and every lantern/stone/card on it is
opaque and readable.

### 2.3 Full CSS token table

Replaces `[data-theme="light"]` at `index.css:71–129`. Contrast ratios measured
with WCAG 2.1 relative luminance.

#### Base surfaces

| Token | Value | Role | Notes |
|---|---|---|---|
| `--void` | `#EFE3CC` | body bg — aged parchment | hue 38°, the anchor of the palette |
| `--forge` | `#F7EEDB` | sidebar bg — fresh vellum | 1 step lighter than body |
| `--chain` | `#E4D5B7` | hover / well | opaque: hover fills are solid warm wells |
| `--vellum-raise` | `#FBF5E6` | cards, panels, modals | *new* — the lightest surface on screen |
| `--vellum-deep` | `#F2E7D0` | inset / log surface | *new* — recessed parchment |
| `--vellum-edge` | `#C3A87A` | default border | 3.1:1 vs `--void` — a rule line, not a hairline |
| `--vellum-edge-soft` | `#D7C49B` | dividers inside cards | |
| `--parchment-vignette` | `rgba(120, 90, 50, 0.10)` | scene corner vignette | |

#### Ink

| Token | Value | Role | Contrast |
|---|---|---|---|
| `--text-saga` | `#2B1D12` | primary — iron-gall ink | **12.8:1** on `--void`, 15.0:1 on `--vellum-raise` |
| `--text-rune` | `#5A4330` | secondary | **7.3:1** / 8.5:1 |
| `--text-void` | `#6B5340` | tertiary, meta | **5.6:1** on `--void` |
| `--text-faint` | `#8A7358` | non-essential chrome (dashes, gutters) | 4.0:1 — never load-bearing text |

#### Accents — ember, bronze, mead

| Token | Value | Role |
|---|---|---|
| `--gold` | `#8A5A0B` | rune-gold, **body ink** — 5.4:1 on vellum, 4.7:1 on parchment |
| `--gold-bright` | `#AE6F14` | mead-hall gold — **display ink** (≥19px bold: 3.3:1 parchment, 3.8:1 vellum) *and* the graphic colour for rings/rules (≥3:1 on every parchment tone). Was `#d97706`. |
| `--mead` | `#E8B54A` | glow / gold leaf — **shadow and fill-of-light only, never text** |
| `--ember` | `#B4451B` | forge orange — 5.1:1 on vellum |
| `--ember-deep` | `#8C3210` | ember text on ember-tinted fills — 6.5:1 on `#F7E2D6` |
| `--bronze` | `#8B5F32` | rules, borders, seal strokes (graphic use ≥3:1) |
| `--verdigris` | `#0B6B5C` | replaces `--teal-asgard` — 5.9:1; the old `#077558` is kept only as a fill |
| `--teal-asgard` | `#0B6B5C` | token alias, no new name in the codebase |

#### Semantic

| Token | Value | Notes |
|---|---|---|
| `--error-strong` | `#A32318` | 6.9:1 on vellum |
| `--error-bg` | `#F6DCD3` | **opaque** (was `rgba(254,226,226,0.60)`) |
| `--error-border` | `#C2563F` | |
| `--error-text` | `#8E2A18` | 6.5:1 on `--error-bg` |
| `--success-strong` | `#2E6B34` | 5.9:1 |
| `--error-subtle-bg` | `#F7E2D6` | opaque ember wash |
| `--error-border-dim` | `#D9A38F` | |

#### Status palette (`src/ui/lib/constants.ts` — one map, not two)

| Status | Value | Contrast on vellum | Glow (mead halo) |
|---|---|---|---|
| `running` | `#0F6B7A` | 5.7:1 | `0 0 0 3px rgba(232,181,74,0.28)` |
| `succeeded` | `#2E6B34` | 5.9:1 | — |
| `failed` | `#A32318` | 6.9:1 | `0 0 0 3px rgba(180,69,27,0.20)` |
| `pending` | `#8A5A0B` | 5.4:1 | — |
| `purged` | `#6B5F52` | 5.7:1 | — |
| `cached` | `#8A5A0B` | 5.4:1 (gold, ringed) | |

#### Badges (opaque fills + dark ink — all ≥6.5:1)

| Badge | bg | text |
|---|---|---|
| bash | `#E4EFDC` | `#29522C` (7.6:1) |
| write | `#EDE4F7` | `#5A3A8C` (7.1:1) |
| read | `#E2E9F4` | `#2A4A76` (7.4:1) |
| gold / cached | `#F7E9C8` | `#6E4A08` (6.6:1) |
| ember / failed | `#F7E2D6` | `#8C3210` (6.5:1) |

#### Tool-call surfaces (was 0.30 alpha — now opaque)

| Token | Value |
|---|---|
| `--mist-tool-bg` | `#F4EBD7` |
| `--mist-tool-border` | `#CDB489` |
| `--mist-tool-hover` | `#EDE0C4` |
| `--tool-batch-header-bg` | `#EDE2C9` |
| `--tool-batch-header-hover` | `#E3D4B4` |
| `--bubble-header-bg` | `#EFE5CF` |

#### Glow / elevation (glow lives in `box-shadow`, never in the fill)

| Token | Value |
|---|---|
| `--glow-mead-sm` | `0 0 6px rgba(232, 181, 74, 0.45)` |
| `--glow-mead-md` | `0 0 14px rgba(232, 181, 74, 0.55)` |
| `--glow-ember` | `0 0 10px rgba(180, 69, 27, 0.35)` |
| `--elev-1` | `0 1px 2px rgba(90, 67, 48, 0.18)` |
| `--elev-2` | `0 2px 6px rgba(90, 67, 48, 0.22)` |
| `--elev-3` | `0 8px 22px rgba(90, 67, 48, 0.26)` |
| `--deviated-edge` | `inset 0 0 0 3px rgba(255, 255, 255, 0.45)` |

**Non-negotiable:** `--mead` is never a text colour; every interactive fill is
opaque; every glow is an outer `box-shadow`.

---

## 3. Component-by-component treatment

### 3.1 Sidebar shell (`--forge`)
Fresh vellum `#F7EEDB`, with a `1px solid #C3A87A` right rule and a soft
`2px` inner highlight down the edge. The wordmark **HLIDSKJALF** is
`--gold-bright (#AE6F14)` in a Cinzel-class serif with `letter-spacing: 0.18em`,
under a `2px` bronze rule that terminates in a small diamond. The lore line moves
from slate to `--text-rune`, italic.

*Was:* sidebar bg token existed (`--forge`), but every child inside it was
dark-hardcoded (D2, D8), so it read as a cream column full of black boxes.

### 3.2 Lantern tree scene — the fresco
Full layer spec in §2.2. Component-level changes:

- `.ns-tree__scene` (`:459`): border `#C3A87A`, radius `6px`, plus the
  deckled-edge inset highlight and the warm vignette.
- `.ns-tree__backdrop` (`:474`): the `<img>` of `tree-backdrop.jpg` is **not
  rendered in light mode** (`display: none`). The fresco is painted with a
  `.ns-tree__fresco` layer (CSS gradients) plus an inline SVG tree
  (`.ns-tree__fresco-tree`). Dark mode keeps the JPG byte-for-byte. The mask
  gradient at `:484–485` stays but is re-tuned to fade the fresco into
  `--forge` rather than into black.
- `.ns-tree--lanterns` (`:729`): the private glow vocabulary moves out of the
  component scope into `:root` / `[data-theme]` and gains a light set:
  `--lg-moon: rgba(160,140,100,0.35)` → replaced by `--lg-sage`,
  `--lg-sun: rgba(232,181,74,0.55)`, `--lg-ember: rgba(180,69,27,0.40)`,
  `--lg-moss: rgba(126,143,87,0.45)`, `--lantern-glass: #F7E3B4`,
  `--lantern-outline: #A9873F`.
- `.lseat__veil` / `.lseat__halo` (`:508–533`): **multiply is dropped in light
  mode.** The veil becomes a `#EFE6D2` fill at `normal` blend, and the tier
  ladder runs on *opacity of a wash*, not darkness: `off` `.55`, `empty` `.40`,
  `mid` `.18`, `full` `0`. The halo (`1.7×`, `:510`) becomes a `--mead` radial at
  12% for OFF seats. `.lseat__glow` (`:512`) switches from `screen` to `normal`
  blend with `fill: url(#lglowg-sun)` (a mead radial), opacity ladder
  `off 0 → empty 0 → mid 0.45 → full 1`. `.lseat__ring` keeps `#0B6B5C` and its
  `drop-shadow`, which is correct on light.
- **Result:** lit lanterns glow honeyed gold, unlit lanterns are pale and flat,
  and the "bright = lit" reading is preserved from dark mode.

### 3.3 Realm stones (`.ns-tree__item` / `.ns-tree__stone`)
Opaque vellum plaques: `background: #FBF5E6`, `border: 1px solid #C3A87A`,
`border-radius: 4px`, `box-shadow: var(--elev-1)`. The realm rune is drawn in
`--ember #B4451B` when the realm has running work, `--gold #8A5A0B` when seated
with succeeded work, `--text-faint #8A7358` when empty. The **selected** realm
gets `box-shadow: var(--elev-1), 0 0 0 2px rgba(232,181,74,0.55)` — a mead ring,
outside the hit-target, per the decree. Name text `--text-saga @ 10.5px/600`.
The four realms in the mockup: **fenrir-ledger, shanaghy-com,
odins-throne-hermes, re-goatmower**.

### 3.4 Vine cards (`.jcard`, `:1024`)
The most important fix.

```css
[data-theme="light"] .jcard {
  background: #FBF5E6;                       /* opaque vellum, was near-black */
  border: 1px solid #C3A87A;                 /* warm bronze, was cool slate */
  box-shadow: var(--elev-2), 0 0 9px var(--card-glow, transparent);
}
[data-theme="light"] .jcard:hover   { border-color: var(--gold-bright); box-shadow: 0 0 0 1.5px rgba(174,111,20,0.35), var(--elev-2); }
[data-theme="light"] .jcard.is-active {
  border-color: var(--ember);
  box-shadow: 0 0 0 2.5px rgba(180,69,27,0.30), var(--glow-mead-md), var(--elev-2);
}
```

- `.jcard__title` `--text-saga`, 11px/600.
- `.jcard__meta` `--text-rune`; **`.jcard__meta b` (`:1117`) becomes
  `--ember-deep #8C3210`** (was `#c9d8dd`) so session/issue/agent identity is the
  ember-stamped detail it is in dark mode.
- `.jcard__dot` (`:1098–1101`) reads from the **single** status map: running
  `#0F6B7A` + mead halo, succeeded `#2E6B34`, failed `#A32318` + ember halo,
  pending `#8A5A0B`. The four literals are deleted.
- Card action buttons (`.card-extended-action-btn`, `:1846–1847`): borders move
  to `--vellum-edge`; the hover/confirm red becomes `--error-strong #A32318` with
  an **opaque** `#F7E2D6` fill (currently `rgba(239,68,68,0.08)`, `:1846`). The
  same literal recurs at `:1708`, `:1750`, `:1755`, `:1784` and `:1867`.
- The `.is-dim` (`:1052`) and `.jcard--pending` (`:1056`) opacity values rise
  from 0.5/0.62 to 0.62/0.72 — on light ground, low opacity reads as *disabled*,
  not *de-emphasised*.
- Card status sigil bubble: `_status-color` driven, opaque `#FBF5E6` seat with a
  `2px` status ring.

### 3.5 World-title panel (`.wtitle`, `:547`) — decree compliance fix
```css
[data-theme="light"] .wtitle {
  background: #FBF5E6;                       /* was rgba(6,10,14,0.55) */
  backdrop-filter: none;                     /* was blur(6px) — decree */
  border: 1px solid #C3A87A;
  border-left: 3px solid var(--gold-bright);
  box-shadow: var(--elev-2);
  opacity: 1;
}
```
Fully opaque (the `opacity: 0.5` dim state at `:560` is replaced by desaturating
the ink: inactive panel uses `--text-rune` + `#C3A87A` rules rather than
translucency). `.wtitle__name` → `--text-saga`; `.wtitle__lore` and
`.wtitle__lore-link` → `--text-rune`; `.wtitle__kin-pill` → `#F4EBD7` fill,
`1px #CDB489`, text `--text-rune`, `::before` arrow `--bronze #8B5F32`.
The teal `#15b8a6` rules at `:555`/`:690` become `--gold-bright`.

### 3.6 Task-detail header
`--forge` bar over a `2px --gold-dim-border` rule. Session title in
`--gold #8A5A0B` Cinzel; badges: `session-agent-badge` `#F7E9C8`/`#6E4A08`,
`session-step-tag` `#E2E9F4`/`#2A4A76`, `session-id-chip` monospace on
`#F2E7D0` with `--text-rune`. Pin / copy / download icon buttons
(`:1886–1888`) already upgrade to `--text-rune`; raise them to `--text-saga` at
24px hit size, with a `1px #C3A87A` box so they read as stamped brass studs
rather than floating glyphs.

### 3.7 Log viewer (`.log-terminal`, `:1905`)
```css
[data-theme="light"] .log-terminal {
  background: #F2E7D0;                /* recessed parchment — the "page" */
  color: var(--text-saga);
  box-shadow: inset 0 0 0 1px #D7C49B; /* recess, not card */
}
```
- `.log-system` (`:1929`) `--text-faint #8A7358` italic — legible, still quiet.
- `.log-warning` (`:1928`) → `--ember-deep #8C3210` (was `--gold-bright`; amber on
  cream is the classic sub-AA trap). The **rate-limit lines** in the mockup use
  exactly this.
- `.log-error-box` (`:1913`) → opaque `#F6DCD3`, `1px #C2563F`, ink `#8E2A18`;
  the icon goes `--error-strong`. Add `border-left: 3px solid #C2563F`.
- `.log-end` (`:1930`) `--gold` with a `1px --vellum-edge` top rule.
- **Thinking / system rows** (`.ev-thinking`, `:2816`) — `--text-faint` on a
  `2px #D7C49B` left rule. These were `--text-void` before; at `#606070` on
  parchment they measured ~3.4:1.
- **Tool calls** (`.ev-tool`, `:2827`) — opaque `#F4EBD7`, `1px #CDB489`,
  radius 4px, `--elev-1`. Header hover `#EDE0C4`. Tool badge `bash`
  `#E4EFDC`/`#29522C`, `write` `#EDE4F7`/`#5A3A8C`, `read` `#E2E9F4`/`#2A4A76`.
  The expand/collapse chevron goes `--bronze`. **Every one of these was
  0.30-alpha before (D11).**
- **Heartbeat / `tool_progress` JSON** rows render in `.ev-tool` bodies at
  `--text-rune`, monospace 11px/1.6, with `"elapsed_time_seconds"` emphasised in
  `--ember-deep` — machine output, but warm and legible.
- Tooltips (`.ev-tool` portal host, `StatusBadge.tsx:114`) inherit `data-theme`
  already; add `[data-theme="light"] .wss-tooltip { background: #FBF5E6;
  border-color: #C3A87A; box-shadow: var(--elev-3); color: var(--text-saga); }`.
- The `Write` action button (`.write-btn` family) becomes opaque `--gold` on
  vellum with `--mead` glow on hover; the composer field is `#FBF5E6` with a
  `1px #C3A87A` rule and a `3px` ember left rule when focused.
- Autoscroll FAB (`.autoscroll-fab`, `:1943+`) → opaque `#FBF5E6`, `1px #C3A87A`,
  `--elev-2`, icon `--gold`.

### 3.8 Status badges (`.job-status-badge`, `:1608`)
Keep `border: 1px solid currentColor` but set both from the **single** status map.
Add `background: color-mix(in srgb, currentColor 10%, #FBF5E6)` — an opaque
tinted seat — and a `2px` `--mead` ring for `running` only. `FAILED` renders
`--error-strong` with the ember wash.

### 3.9 Modals

**Agent profile modal** (`AgentProfileModal.tsx`, `.apm-*`)
- `.apm-backdrop` (`:3700`/`:3707`): light scrim becomes **warm**: `rgba(74, 52, 30, 0.45)` over a `2px` backdrop blur *on the scrim only* (a non-interactive
  layer — the blur stays legal, the interactive shell stays opaque).
- `.apm-shell` (`:3713`) `var(--forge)` → `#FBF5E6`, `2px solid #C3A87A`,
  `box-shadow: var(--elev-3)`, plus a `4px` inset `--deviated-edge`.
- Section headers `--gold` on `#F7E9C8` bands; body ink `--text-saga`;
  secondary `--text-rune`. The 480px portrait "tablet" silhouette is kept.
- Avatar: light-mode avatar PNG variants continue to be used
  (`AgentProfileModal.tsx:31–34`) — see §4 on consolidating that choice.

**Ragnarök dialog** (`.rdk-shell`, `:3956`/`:3967`) — the light override at
`:3967` currently makes it **near-black maroon `#12060a`**. That is not a light
theme; it is a dark dialog with a tinted hue. Replace with a **blood-on-vellum
seal**:
```css
[data-theme="light"] .rdk-backdrop { background: rgba(74,52,30,0.50); }
[data-theme="light"] .rdk-shell {
  background: #FBF5E6;
  border: 2px solid #A32318;            /* the blood rule, kept */
  box-shadow: var(--elev-3), 0 0 0 1px #E7C9A8 inset;
  animation: rdkFadeIn 0.22s ease-out;  /* drop the flicker in light — it reads as a rendering bug on cream */
}
[data-theme="light"] .rdk-rune-band { border-color: #D9A38F; background: #F7E2D6; color: #8C3210; }
[data-theme="light"] .rdk-confirm {
  background: #A32318; color: #FBF5E6;   /* the one saturated red plane, opaque */
  box-shadow: 0 0 0 1px #7A1A12, 0 2px 6px rgba(90,67,48,0.3);
}
```
Ragnarök keeps its terror through **red ink on pale vellum**, which is *more*
Norse than a black box: it is a verdict stamped in blood, not a void.

`RagnarokDialog.tsx:14` ("Design: void-black (#07070d) backdrop, gold borders,
blood-red confirm button") should gain a second theme sentence in its comment.

**`.norse-error-tablet`** (`:2938`, "intentionally dark-only") — for light mode,
invert the metaphor: a **soot-scorched page**: `background: #F0E4CF` with a
`radial-gradient` char ring in `#D9C4A4`, `2px solid #A32318` top rule, ink
`--text-saga`, and the rune glyph in `--ember`.

### 3.10 Toasts (`.toast`, `:4194`)
```css
[data-theme="light"] .toast {
  background: #FBF5E6;                          /* was #ffffff */
  border: 1px solid #C3A87A;
  border-left: 3px solid var(--gold-bright);
  box-shadow: var(--elev-3), var(--glow-mead-sm);
  color: var(--text-saga);
}
[data-theme="light"] .toast--error   { border-left-color: var(--error-strong); box-shadow: var(--elev-3), var(--glow-ember); }
[data-theme="light"] .toast--success { border-left-color: var(--success-strong); }
```
A toast is a **wax-sealed note** slipped onto the table: opaque vellum, a gold
left rule, a mead halo. No white cards anywhere in the product.

### 3.11 Focus, selection, motion
- `:focus-visible` everywhere: `outline: 2px solid var(--ember); outline-offset: 2px`
  — ember is unambiguous on every parchment tone (5.1:1), which the old
  `--gold`-based rings were not on gold-tinted panels.
- `::selection`: `background: rgba(232,181,74,0.45)`.
- Scrollbars: track `--vellum-deep`, thumb `#C3A87A`, hover `--gold`.
- All existing animations keep their durations; the `rdkFlicker` (`:3962`) is
  disabled in light only (a flicker on a bright ground reads as a bug).

---

## 4. Implementation sketch

**Principle: the token layer does 80% of the work; component rules are added only
where a literal is hardcoded today.** No component is redesigned; the palette is
retargeted and the literals are evicted.

### 4.1 `src/ui/styles/index.css` (the bulk)

1. **Replace** `[data-theme="light"] { … }` (`:71–129`) with the §2.3 table.
2. **Add a light-mode scene layer.** Extend `.ns-tree__scene` (`:459`) with
   `.ns-tree__fresco` (gradients, §2.2 layers 0–3, 6) + `.ns-tree__fresco-tree`
   (inline SVG, layers 4–5, 7). `[data-theme="light"] .ns-tree__backdrop
   { display: none; }`.
3. **Move the lantern vocabulary out of the component scope.** Cut `--lg-*` /
   `--lantern-light` / `--glabel-*` from `.ns-tree--lanterns` (`:729–739`) into
   `:root` and add a `[data-theme="light"]` set. Then rewrite the four-tier
   ladder (`:508–538`) to be blend-mode-aware:
   `[data-theme="light"] .lseat__veil { fill: #EFE6D2; mix-blend-mode: normal; }`
   + the light opacity ladder from §3.2.
4. **Add light blocks (new rules, ~14 total)** for the components whose fills are
   literal today: `.jcard` (+`__title/__meta/__dot/__acts`), `.jcard.is-active`,
   `.card-extended-action-btn`, `.ns-tree__note` (`:1011`), `.ns-tree__glabel`
   (`:931`), `.wtitle` (+`__name/__lore/__kin-pill/__glabel-name`),
   `.log-terminal`, `.ev-tool`/`.ev-tool-header:hover`/`.ev-tool-badge`,
   `.wss-tooltip`, `.norse-error-tablet`, `.rdk-*`, `.apm-*`, `.toast` (replace
   `:4194`), scrollbars, `::selection`.
5. **Fix D10**: delete `color: var(--text-primary)` at `:2328` and `:2332`;
   use `var(--text-saga)`. Also raise those two fills to opaque `#F2E7D0` /
   `#F4EBD7`.
6. **Fix D11**: light `--mist-tool-*` / `--tool-batch-header-*` → the opaque
   values in §2.3.

Estimated diff: ~1 `[data-theme]` block replaced, ~90 lines of new light rules,
~20 literal deletions. **Zero dark-mode regressions** — every edit is either
inside `[data-theme="light"]` or moves a var to a scope where dark reads the same
value.

### 4.2 `src/ui/lib/constants.ts` — collapse the dual maps

```ts
export const STATUS_COLORS: Record<Job["status"], TokenName> = {
  running:   "--status-running",
  succeeded: "--status-succeeded",
  failed:    "--status-failed",
  pending:   "--status-pending",
  purged:    "--status-purged",
  cached:    "--status-cached",
};
// DELETE STATUS_COLORS_LIGHT — the theme layer owns both values.
```
Then `LogViewer.tsx:106` becomes `const statusVar = STATUS_COLORS[job.status];`
and `styles={{ color: \`var(${statusVar})\` }}`. One map, no `theme === "light"`
ternary, no silent divergence when a status is added (which is exactly what
`#79b356` / `#8a9296` are today).

### 4.3 Component ternaries → one theme primitive

Add `src/ui/lib/theme.ts`:
```ts
export function themeAsset(kind: "avatar", key: string, theme: Theme): string;
export function themed<T>(theme: Theme, light: T, dark: T): T;
```
- `LogViewer.tsx:106,612`, `DecreeBlock.tsx:270,320`, `Sidebar.tsx:167`,
  `AgentProfileModal.tsx:31,34`, `ThemeSwitcher.tsx:14,25` → call the helper.
- Prefer CSS entirely where possible: `DecreeBlock.tsx:320`'s inline
  `rgba(100,80,45,0.12)`/`rgba(42,42,62,0.6)` ternary becomes a class
  (`.decree-fallback-badge`) styled by theme in CSS. **Inline style objects are
  unauditable; tokens are.**

### 4.4 Assets / bundle

- New asset: none required. The fresco is CSS+SVG (keeps the bundle flat and
  proves out the "no network" requirement of the mockup).
- `src/ui/assets/README.md` gains a light-fresco section documenting the layer
  contract and the seat geometry, so the JPG and the SVG can't drift.
- Optional follow-up: a `tree-backdrop-light.jpg` if the painted treatment is
  preferred to the fresco later; the CSS fallback stays either way.

### 4.5 Both targets

`src/targets/web/platform.ts:34` (`data-theme` on `<html>`) and
`src/targets/plugin/pane.tsx:160` / `page.tsx:45`
(`data-theme` on the `.odins-throne-root` surfaces) need **no change** — the
design deliberately rides the existing attribute seam. The only portal that
matters, `StatusBadge.tsx:114/139`, already mirrors the attribute and is why the
tooltip rule in §3.7 works without extra plumbing.

### 4.6 Acceptance checks

1. `grep -c '\[data-theme="light"\]' src/ui/styles/index.css` ≥ 25 (from 11).
2. `grep -rn 'rgba(5, 7, 10\|rgba(7, 7, 13\|rgba(6, 10, 14\|#c9d8dd\|--text-primary\|#ffffff' src/ui/styles/index.css` → no hits outside explicit dark-scope blocks.
3. `grep -rn 'backdrop-filter' src/ui/styles/index.css` → only on
   `.apm-backdrop` / scene-vignette layers; none on `.wtitle` or `.jcard`.
4. Every interactive fill resolves to alpha ≥ 0.96 (audit the light block).
5. Contrast: all text ≥ 4.5:1, all status/graphic affordances ≥ 3:1 on their
   actual composite. (The §2.3 table is measured, not eyeballed.)
6. Both targets render identically — the token layer is the only difference
   between web and plugin.

---

## 5. What the mockup demonstrates

`screenshot.png` (1400×950) shows the whole surface in one frame:

- **HLIDSKJALF sidebar** — wordmark over a bronze rule, the lore line in warm
  secondary ink, the filter field as an inset parchment well.
- **The gilded fresco** — pale sky, sun disc, sage-and-gold canopy with gold-leaf
  highlights, bronze trunk, the vine — no image file, all gradients and SVG.
- **Four realm stones** — fenrir-ledger, shanaghy-com (selected, mead ring),
  odins-throne-hermes, re-goatmower — with the 11-seat lantern field around them.
- **Expanded vine cards** under shanaghy-com, including the session-title panel
  (opaque vellum, gold left rule) and cards for
  `#126 retell the odins-throne story`, `#120 Add an Atom feed for the
  Shanaghy.com session feed`, `#125 Convert PNG assets to WebP + wire
  build-time image optimization` — each opaque, each with an ink title, ember
  meta, and a status dot with a mead halo.
- **Task detail panel** — session `#125`, FiremanDecko / Step 1, the bash tool
  call `python3 web/scripts/optimize_images.py` in an opaque badge, the
  `rate limit: allowed (five_hour) — resets 2:30:00 AM` lines in ember on
  parchment, two `tool_progress` **heartbeat** JSON rows with
  `elapsed_time_seconds` emphasised, and `system task_notification` in quiet
  ink. Status badges as opaque tinted seats.
- **No white, no cool grey, no translucent interactive fill, no glow inside a
  fill** — the decree, visible in one image.

---

## 6. Summary of the verdict

| | |
|---|---|
| **Root cause** | 10 component-level light overrides for 834 rule blocks; a dark painted backdrop under a light palette; hardcoded dark literals across every interactive surface; one undefined token; status colours forked into two maps; theme logic spread over 8 JS ternaries. |
| **Fix shape** | Retarget the token layer, add ~14 light component rules, delete ~20 literals, collapse the status maps, funnel theme ternaries through one helper. No component redesign. |
| **Aesthetic** | Illuminated manuscript on a mead-hall table: aged parchment, iron-gall ink, bronze rules, gold leaf, ember heat — Norse by *material*, not by darkness. |
| **Decree compliance** | Every interactive surface opaque; all glow in outer `box-shadow`; every load-bearing text/ink pair measured ≥4.5:1 (graphics ≥3:1). |
| **Signature move** | The moonlit painted tree becomes a **gilded-fresco tree** in CSS gradients and SVG — the light-mode scene finally belongs to the light palette. |

---

## 7. Verification of these deliverables

Run against the real files in this directory:

- `mockup.html` — 40,818 bytes, valid: every `div/svg/span/section/aside/main/style`
  open tag has a matching close (checked with a stack parser; zero unclosed tags
  at EOF), **zero network references** (`grep -E 'https?://|@import|url\((?!\#)'`
  → none), zero `<link>/<script>/<img>/<iframe>` elements, system font stacks only
  (`Iowan Old Style` / `Palatino` / `Georgia`, `-apple-system`, `SF Mono`).
  Opens from `file://` with no server.
- `screenshot.png` — 2800×1900 PNG (1400×950 CSS viewport at DPR 2).
- Layout assertions measured in the live page: `#throne` = exactly **1400×950**;
  log pane `scrollHeight − clientHeight = 0` (nothing clipped); **zero** elements
  with `scrollWidth > clientWidth` across card titles, card meta, stone names,
  the world-title header and the heartbeat rows — i.e. no text overflows its own
  box or runs under a neighbouring control.
- The four realm stones (fenrir-ledger, shanaghy-com, odins-throne-hermes,
  re-goatmower) each render on a single line inside a 30px opaque vellum plaque.
- Rendered output was read back visually and corrected twice: the first pass had
  card titles running under the pin/cancel buttons (inline elements cannot
  ellipsize — `.jcard__title` is now `display:block` inside a
  `min-width:0;overflow:hidden` flex item) and stone names wrapping to two lines
  (plaques widened, names set `nowrap` + ellipsis).
- Every defect in §1 was re-checked against the repo at the cited line before
  submission; four citations were corrected during that pass (`:554` not `:556`;
  `:686`/`:695` not `:685`/`:690`; `:726` not `:729`; `:1846` not `:1841`).
