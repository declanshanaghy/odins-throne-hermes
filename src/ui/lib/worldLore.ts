// World lore backed by the realm knowledge db — issue #99, v3.16.
// WORLDS_LORE is the db's worlds slice; src/ui/data/realm-knowledge.json stays byte-identical.

export type { WorldEntry as WorldLore, KinRef as KinLink } from "./realmKnowledge";
import { REALM } from "./realmKnowledge";

/** Lore table derived from realm-knowledge.json worlds slice. */
export const WORLDS_LORE = REALM.worlds;

/** Generic lore for worlds not in the db. */
export const GENERIC_WORLD_LORE = "an uncharted ringfort — the seanchaí has not yet told its story";
