// World lore for the title section — verbatim from the approved prototype
// (design/tree-display/tree-display-prototype.html, v3.13 / round 21).
//
// Known worlds carry lore (ringfort name + narrative) and kin links — pills
// that seat the related world on click (same selectWorld path as a lantern tap).
// Unknown worlds get the generic seanchaí line — never a borrowed story.

export interface KinLink {
  id: string;
  why: string;
}

export interface WorldLore {
  lore: string;
  kin: KinLink[];
}

/** Lore table for all known worlds. Verbatim from the prototype's WORLDS_LORE. */
export const WORLDS_LORE: Record<string, WorldLore> = {
  "fenrir-agents": {
    lore: "the wolf's ledger — a ringfort of account-books, Loki's third cub chained to the enterprise since the beginning. Every coin the band moves passes along Fenrir's chain.",
    kin: [
      { id: "shanaghy-com-agents", why: "the ballads it earns" },
      { id: "mytruthfinder-agents", why: "runs in its hills" },
    ],
  },
  "say-so-agents": {
    lore: "the speaking ringfort — every say-so and utterance given a room of its own, where the sprites learn to speak before they sing.",
    kin: [
      { id: "shanaghy-com-agents", why: "the ballads it earns" },
      { id: "fenrir-agents", why: "the hall's books" },
    ],
  },
  "mytruthfinder-agents": {
    lore: "the salmon-pool ringfort — Fionn's salmon of knowledge, the truth-finder that cooks every catch of the net into a meal worth eating.",
    kin: [
      { id: "fenrir-agents", why: "its summer hills" },
      { id: "shanaghy-com-agents", why: "its bed in the hub" },
    ],
  },
  "shanaghy-com-agents": {
    lore: "the seanchaí's ringfort — descended of the fox (Sionnach), the family storytellers; the living garden where every ballad hangs, each session a bed in the hub.",
    kin: [
      { id: "odins-throne-hermes-agents", why: "the throne that watches it" },
      { id: "re-goatmower-agents", why: "the garden's mower" },
    ],
  },
  "re-goatmower-agents": {
    lore: "the west-field ringfort — the Mossiah's mower, the goat that grazes the overgrown again and again. What the goat grazed grows back; the pasture keeps its word.",
    kin: [
      { id: "shanaghy-com-agents", why: "the garden it mows" },
      { id: "fenrir-agents", why: "the hall's books" },
    ],
  },
  "odins-throne-hermes-agents": {
    lore: "the throne-hill ringfort — Hlidskjalf, the high seat from which the One-Eye watches all the worlds at once. This hall IS that throne; its agents keep the lanterns lit.",
    kin: [
      { id: "shanaghy-com-agents", why: "its ballads in the hub" },
      { id: "fenrir-agents", why: "the hills it stands on" },
    ],
  },
};

/** Generic lore for any world the seanchaí has not yet told a story about. */
export const GENERIC_WORLD_LORE = "an uncharted ringfort — the seanchaí has not yet told its story";
