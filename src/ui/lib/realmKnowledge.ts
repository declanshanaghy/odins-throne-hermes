// Typed accessor for the realm knowledge db — src/ui/data/realm-knowledge.json.
// The JSON stays byte-identical; this module provides TypeScript interfaces only.

import realmRaw from "../data/realm-knowledge.json";

export interface KinRef {
  slug: string;
  why: string;
}

export interface WorldEntry {
  label: string;
  entity: string;
  profile: string;
  stone: string | null;
  site: string;
  hall: string;
  ringfort: string;
  lore: string;
  kin: KinRef[];
}

export interface EntityEntry {
  slug: string;
  name: string;
  path: string;
  epithet: string;
  veiled: boolean;
  mentions: string[];
  mentionedBy: string[];
  kin: string[];
  memories: { when: string; text: string }[];
  stats: Record<string, string>;
}

export interface RealmDb {
  meta: {
    base: string;
    version: string;
    crawled: string;
  };
  linking: {
    aliases: Record<string, string>;
    note: string;
  };
  worlds: Record<string, WorldEntry>;
  entities: Record<string, EntityEntry>;
}

export const REALM: RealmDb = realmRaw as unknown as RealmDb;
