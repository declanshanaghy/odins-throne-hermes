// linkifyLore — convert entity mentions in lore text to link spans (issue #99, v3.16).
//
// Algorithm: build candidates from entity names + aliases, longest first; one regex pass
// (?<!\p{L})(…)(?!\p{L}) u-flag; each entity's FIRST occurrence is a link; later hits plain.
// Returns LoreSpan[] (plain objects) so the caller can wrap in React nodes without a dep here.

import { REALM } from "./realmKnowledge";

export interface LoreSpan {
  kind: "text" | "link";
  text: string;
  href?: string;
  ariaLabel?: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCandidates(): { text: string; slug: string }[] {
  const candidates: { text: string; slug: string }[] = [];
  for (const [slug, entity] of Object.entries(REALM.entities)) {
    candidates.push({ text: entity.name, slug });
  }
  for (const [alias, slug] of Object.entries(REALM.linking.aliases)) {
    if (REALM.entities[slug]) {
      candidates.push({ text: alias, slug });
    }
  }
  // Longest first so "Fionn mac Cumhaill" beats "Fionn"
  return candidates.sort((a, b) => b.text.length - a.text.length);
}

const CANDIDATES = buildCandidates();

export function linkifyLore(text: string): LoreSpan[] {
  if (CANDIDATES.length === 0) return [{ kind: "text", text }];

  const base = REALM.meta.base;
  const pattern = CANDIDATES.map((c) => escapeRe(c.text)).join("|");
  const re = new RegExp(`(?<!\\p{L})(${pattern})(?!\\p{L})`, "gu");

  const seen = new Set<string>();
  const spans: LoreSpan[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const matchText = match[1];
    if (matchText === undefined) continue;
    const start = match.index;
    if (start > lastIndex) {
      spans.push({ kind: "text", text: text.slice(lastIndex, start) });
    }
    const candidate = CANDIDATES.find((c) => c.text === matchText);
    if (candidate !== undefined && !seen.has(candidate.slug)) {
      seen.add(candidate.slug);
      const entity = REALM.entities[candidate.slug];
      if (entity !== undefined) {
        spans.push({
          kind: "link",
          text: matchText,
          href: base + entity.path,
          ariaLabel: `${entity.name} — ${entity.epithet}`,
        });
      } else {
        spans.push({ kind: "text", text: matchText });
      }
    } else {
      spans.push({ kind: "text", text: matchText });
    }
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    spans.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return spans;
}
