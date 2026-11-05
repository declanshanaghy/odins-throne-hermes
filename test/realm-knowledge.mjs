// Realm knowledge db + WorldTitle v3.16 tests (issue #99).
//
// Locks the contract for:
//   1. realm-knowledge.json: worlds have profiles matching the spec table
//   2. worldLore.ts is backed by the db (WORLDS_LORE === REALM.worlds)
//   3. linkifyLore: first-occurrence-only, longest-first, entity link hrefs
//   4. WorldTitle.tsx source: name link, lore linkify, kin pills from db
//   5. NamespaceTree.tsx: .wtitle in INTERACTIVE_SELECTORS (click immunity)
//   6. CSS: .wtitle pointer-events: auto; .wtitle__name-link; .wtitle__lore-link
//
// Run: npm test   (node --import ./test/register.mjs test/realm-knowledge.mjs)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// ── 0. imports from src via TypeScript transpile ─────────────────────────────

const { REALM } = await import("../src/ui/lib/realmKnowledge.ts");
const { WORLDS_LORE, GENERIC_WORLD_LORE } = await import("../src/ui/lib/worldLore.ts");
const { linkifyLore } = await import("../src/ui/lib/linkifyLore.ts");

// ── 1. realm-knowledge.json structure ────────────────────────────────────────

assert.ok(REALM.meta.base === "https://www.shanaghy.com", "meta.base is https://www.shanaghy.com");
assert.ok(typeof REALM.meta.version === "string", "meta.version is a string");
assert.ok(typeof REALM.linking.aliases === "object", "linking.aliases is an object");
assert.ok(typeof REALM.entities === "object", "entities is an object");
assert.ok(typeof REALM.worlds === "object", "worlds is an object");

// ── 2. worlds profiles match the spec table (issue #99 §2) ───────────────────

const EXPECTED_PROFILES = {
  "fenrir-agents":               "/sessions/fenrir-ledger/",
  "say-so-agents":               "/sites/#hall-say-so",
  "mytruthfinder-agents":        "/profiles/fionn/",
  "shanaghy-com-agents":         "/",
  "re-goatmower-agents":         "/projects/re-goatmower/",
  "odins-throne-hermes-agents":  "/projects/odins-throne/",
};

for (const [ns, expectedProfile] of Object.entries(EXPECTED_PROFILES)) {
  const world = WORLDS_LORE[ns];
  assert.ok(world, `WORLDS_LORE has entry for ${ns}`);
  assert.equal(world.profile, expectedProfile, `${ns} profile = ${expectedProfile}`);
  assert.ok(typeof world.lore === "string" && world.lore.length > 10, `${ns} lore is non-empty`);
  assert.ok(Array.isArray(world.kin), `${ns} kin is an array`);
}

// All 6 known worlds present
assert.equal(Object.keys(WORLDS_LORE).length, 6, "WORLDS_LORE has exactly 6 worlds");

// WORLDS_LORE is the same object as REALM.worlds
assert.strictEqual(WORLDS_LORE, REALM.worlds, "WORLDS_LORE === REALM.worlds (backed by db)");

// GENERIC_WORLD_LORE is defined
assert.ok(typeof GENERIC_WORLD_LORE === "string" && GENERIC_WORLD_LORE.length > 0, "GENERIC_WORLD_LORE defined");

// ── 3. kin entries use entity slugs (not namespace ids) ──────────────────────

for (const [ns, world] of Object.entries(WORLDS_LORE)) {
  for (const k of world.kin) {
    assert.ok(typeof k.slug === "string", `${ns} kin item has slug`);
    assert.ok(typeof k.why === "string", `${ns} kin item has why`);
    // slug must exist in REALM.entities
    assert.ok(
      REALM.entities[k.slug] !== undefined,
      `${ns} kin slug "${k.slug}" exists in REALM.entities`,
    );
  }
}

// ── 4. entity entries have name + path ───────────────────────────────────────

const entityCount = Object.keys(REALM.entities).length;
assert.ok(entityCount >= 36, `REALM has >= 36 entities (got ${entityCount})`);

for (const [slug, entity] of Object.entries(REALM.entities)) {
  assert.ok(typeof entity.name === "string" && entity.name.length > 0, `entity ${slug} has name`);
  assert.ok(typeof entity.path === "string" && entity.path.startsWith("/"), `entity ${slug} path starts with /`);
}

// ── 5. linkifyLore: basic behavior ───────────────────────────────────────────

// 5a. Plain text with no matches → single text span
{
  const result = linkifyLore("no entities here");
  assert.equal(result.length, 1, "no-match: single span");
  assert.equal(result[0].kind, "text", "no-match: kind=text");
  assert.equal(result[0].text, "no entities here", "no-match: text preserved");
}

// 5b. "Loki" matches entity 'loki' (entity name: "Loki")
{
  const result = linkifyLore("Loki's third cub");
  const link = result.find((s) => s.kind === "link");
  assert.ok(link !== undefined, "linkify finds Loki");
  assert.ok(link.href !== undefined && link.href.includes("/profiles/loki/"), `Loki href contains /profiles/loki/ (got ${link.href})`);
}

// 5c. First-occurrence-only: "Fenrir" appears twice — only first is linked
{
  const text = "Fenrir the wolf. The chain binds Fenrir.";
  const result = linkifyLore(text);
  const links = result.filter((s) => s.kind === "link" && s.text === "Fenrir");
  assert.equal(links.length, 1, "Fenrir: only first occurrence linked");
}

// 5d. Alias "One-Eye" → odin entity
{
  const result = linkifyLore("the One-Eye watches");
  const link = result.find((s) => s.kind === "link");
  assert.ok(link !== undefined, "One-Eye alias resolves to link");
  assert.ok(link.href !== undefined && link.href.includes("/profiles/odin/"), `One-Eye href contains /profiles/odin/ (got ${link.href})`);
}

// 5e. Alias "Mossiah" → mossy entity
{
  const result = linkifyLore("the Mossiah's mower");
  const link = result.find((s) => s.kind === "link");
  assert.ok(link !== undefined, "Mossiah alias resolves to link");
  assert.ok(link.href !== undefined && link.href.includes("/profiles/mossy/"), `Mossiah href correct (got ${link.href})`);
}

// 5f. Longest-first: "Fionn mac Cumhaill" beats "Fionn"
{
  const text = "Fionn mac Cumhaill, also known as Fionn";
  const result = linkifyLore(text);
  // The first match should be "Fionn mac Cumhaill" (longer), not just "Fionn"
  const firstLink = result.find((s) => s.kind === "link");
  assert.ok(firstLink !== undefined, "longest-first: a link found");
  assert.equal(firstLink.text, "Fionn mac Cumhaill", "longest-first: Fionn mac Cumhaill matched before Fionn");
  // "Fionn" appearing alone later should NOT be linked (same slug, already seen)
  const links = result.filter((s) => s.kind === "link");
  assert.equal(links.length, 1, "longest-first: only one Fionn link (first occurrence)");
}

// 5g. href is base + entity.path
{
  const fionn = REALM.entities["fionn"];
  assert.ok(fionn !== undefined, "fionn entity exists");
  const result = linkifyLore("Fionn");
  const link = result.find((s) => s.kind === "link");
  assert.ok(link !== undefined, "Fionn linkified");
  assert.equal(link.href, REALM.meta.base + fionn.path, "href = base + entity.path");
}

// ── 6. WorldTitle.tsx source structure ───────────────────────────────────────

const wtSrc = read("src/ui/components/WorldTitle.tsx");

// Name link pattern
assert.ok(wtSrc.includes("wtitle__name-link"), "WorldTitle has wtitle__name-link class");
assert.ok(wtSrc.includes("loreEntry.profile"), "WorldTitle uses loreEntry.profile for name link");
assert.ok(wtSrc.includes("base + loreEntry.profile"), "WorldTitle links to base + profile");
assert.ok(wtSrc.includes('target="_blank"'), "WorldTitle name link opens in new tab");

// Lore linkify
assert.ok(wtSrc.includes("renderLore"), "WorldTitle calls renderLore for lore text");
assert.ok(wtSrc.includes("linkifyLore"), "WorldTitle imports linkifyLore");
assert.ok(wtSrc.includes("wtitle__lore-link"), "WorldTitle uses wtitle__lore-link class");

// Kin pills from db entity slugs
assert.ok(wtSrc.includes("REALM.entities[k.slug]"), "WorldTitle resolves kin via REALM.entities[slug]");
assert.ok(wtSrc.includes("base + entity.path"), "WorldTitle kin pill href = base + entity.path");
assert.ok(!wtSrc.includes("onSelectWorld"), "WorldTitle no longer calls onSelectWorld from kin pills");

// Unknown namespace → plain text (no link)
assert.ok(
  wtSrc.includes("loreEntry?.profile") || wtSrc.includes("loreEntry.profile"),
  "WorldTitle guards name link on loreEntry.profile presence",
);

// ── 7. NamespaceTree.tsx: .wtitle in INTERACTIVE_SELECTORS ───────────────────

const nsSrc = read("src/ui/components/NamespaceTree.tsx");
assert.ok(
  nsSrc.includes(".wtitle"),
  "NamespaceTree INTERACTIVE_SELECTORS includes .wtitle (click immunity)",
);
assert.ok(
  !nsSrc.includes("onSelectWorld={selectWorld}"),
  "NamespaceTree does not pass onSelectWorld to WorldTitle (kin pills are links)",
);

// ── 8. CSS: .wtitle pointer-events: auto ─────────────────────────────────────

const css = read("src/ui/styles/index.css");

// .wtitle block must have pointer-events: auto (not none)
const wtitleBlock = css.match(/\.wtitle\s*\{([^}]*)\}/);
assert.ok(wtitleBlock, "CSS: .wtitle block found");
assert.ok(
  wtitleBlock[1].includes("pointer-events: auto"),
  "CSS: .wtitle has pointer-events: auto (issue #99 click immunity)",
);
assert.ok(
  !wtitleBlock[1].includes("pointer-events: none"),
  "CSS: .wtitle does NOT have pointer-events: none",
);

// .wtitle__name-link styles
assert.ok(css.includes(".wtitle__name-link"), "CSS: .wtitle__name-link defined");
assert.ok(css.includes(".wtitle__name-link::after"), "CSS: .wtitle__name-link::after (↗ cue)");

// .wtitle__lore-link styles
assert.ok(css.includes(".wtitle__lore-link"), "CSS: .wtitle__lore-link defined");
assert.ok(
  css.includes("underline dotted"),
  "CSS: .wtitle__lore-link uses dotted underline",
);

// .wtitle__kin-pill has display: inline-block + text-decoration: none (a-element support)
const kinPillBlock = css.match(/\.wtitle__kin-pill\s*\{([^}]*)\}/);
assert.ok(kinPillBlock, "CSS: .wtitle__kin-pill block found");
assert.ok(
  kinPillBlock[1].includes("display: inline-block"),
  "CSS: .wtitle__kin-pill has display: inline-block (supports <a> element)",
);
assert.ok(
  kinPillBlock[1].includes("text-decoration: none"),
  "CSS: .wtitle__kin-pill has text-decoration: none",
);

console.log(
  "realm-knowledge: db structure, worlds profiles, linkifyLore (first-hit/longest-first/aliases), " +
  "WorldTitle name link + lore + kin pills, click immunity — issue #99",
);
