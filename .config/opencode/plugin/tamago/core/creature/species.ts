import { weightsAt } from "./luck.ts";
import { generator, seed, weighted } from "./random.ts";
import type { Modifiers } from "./sheet.ts";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
/** From the most common to the rarest; the draw falls back along this order. */
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Tune here, never in code paths. Paces have round reciprocals so raw thresholds stay readable. The weights of the draw live in luck.ts: they move with the Luck. */
export const RARITY: Record<Rarity, { pace: number }> = {
  common: { pace: 1 },
  uncommon: { pace: 0.8 },
  rare: { pace: 0.5 },
  epic: { pace: 0.4 },
  legendary: { pace: 0.25 },
};

export type SpeciesId = string;
/** `sheet` holds the Modifiers this Species adds to the Sheet; absent for none. */
export type Species = { id: SpeciesId; label: string; rarity: Rarity; sheet?: Modifiers };

/**
 * Every Species that can hatch. Order within a Rarity is the order of the
 * draw. `sheet` holds the Modifiers, absent for none; a test bounds each to
 * ±MODIFIER_MAX and their sum to MODIFIERS_SUM_MAX. Tune a line before that
 * Species has hatched anywhere: the Sheet is derived, so changing it changes
 * the Temperament and Behavior of every Tamago of that Species already alive.
 * Once one lives, leave its line alone and add a sibling Species instead. The
 * reference entry has no Modifier and never will: that is what keeps every
 * Career from before the Sheet unchanged.
 */
export const SPECIES: readonly Species[] = [
  { id: "cat", label: "cat", rarity: "common" },
  { id: "owl", label: "owl", rarity: "common", sheet: { stoic: 2, cheerful: -1, energy: -2, chatter: -1, patience: 2 } },
  { id: "frog", label: "frog", rarity: "common", sheet: { stoic: 1, energy: -1, patience: 1 } },
  { id: "duck", label: "duck", rarity: "common", sheet: { cheerful: 2, chatter: 1 } },
  { id: "hamster", label: "hamster", rarity: "common", sheet: { energy: 2, patience: -1 } },
  { id: "snail", label: "snail", rarity: "common", sheet: { dreamy: 1, energy: -2, patience: 2 } },
  { id: "fox", label: "fox", rarity: "uncommon", sheet: { sarcastic: 2, energy: 1, sensitivity: 1 } },
  { id: "penguin", label: "penguin", rarity: "uncommon", sheet: { stoic: 2, chatter: 1 } },
  { id: "octopus", label: "octopus", rarity: "uncommon", sheet: { dreamy: 2, chatter: 1, sensitivity: -1 } },
  { id: "bat", label: "bat", rarity: "uncommon", sheet: { energy: 2, chatter: -2, sensitivity: 1 } },
  { id: "hedgehog", label: "hedgehog", rarity: "uncommon", sheet: { sensitivity: 2, chatter: -1, stoic: 1 } },
  { id: "axolotl", label: "axolotl", rarity: "uncommon", sheet: { cheerful: 1, sensitivity: -2, patience: 1 } },
  { id: "robot", label: "robot", rarity: "rare", sheet: { stoic: 3, sensitivity: -2, energy: 1 } },
  { id: "ghost", label: "ghost", rarity: "rare", sheet: { dreamy: 3, chatter: -2, energy: -1 } },
  { id: "jellyfish", label: "jellyfish", rarity: "rare", sheet: { dreamy: 2, sensitivity: 2, energy: -1 } },
  { id: "chameleon", label: "chameleon", rarity: "rare", sheet: { sarcastic: 2, patience: 2, chatter: -1 } },
  { id: "phoenix", label: "phoenix", rarity: "epic", sheet: { cheerful: 3, sensitivity: -3, energy: 1 } },
  { id: "kraken", label: "kraken", rarity: "epic", sheet: { sarcastic: 2, stoic: 2, sensitivity: 2, patience: -1 } },
  { id: "unicorn", label: "unicorn", rarity: "epic", sheet: { dreamy: 3, cheerful: 2, chatter: 1 } },
  { id: "dragon", label: "dragon", rarity: "legendary", sheet: { sarcastic: 3, sensitivity: -2, energy: 2 } },
];
/** The Species of a Career that recorded none: the creature drawn before Species existed. */
export const REFERENCE: SpeciesId = "cat";

/** The domain mixed into the hatch seed. No Milestone id is ever this string. */
const DOMAIN = "species";

/** The table entry for an id; the reference entry for an id this build does not know. */
export function species(id: SpeciesId, table: readonly Species[] = SPECIES): Species {
  return table.find((entry) => entry.id === id) ?? table.find((entry) => entry.id === REFERENCE) ?? { id: REFERENCE, label: REFERENCE, rarity: "common" };
}

/** The Pace of a Species, 1 for an unknown one. */
export function pace(id: SpeciesId, table: readonly Species[] = SPECIES): number {
  const found = table.find((entry) => entry.id === id);
  return found === undefined ? 1 : RARITY[found.rarity].pace;
}

/** The Rarity a number in [0, 1) lands on, by cumulative weight in RARITIES order. A zero weight never lands. */
function rarityAt(roll: number, weights: Record<Rarity, number>): Rarity {
  return weighted(roll, RARITIES, (rarity) => weights[rarity]);
}

/**
 * The Species a Tamago hatching at `hatchedAt` is: the same in every window of
 * this machine. Two draws, always both: the Rarity by `weights`, then a
 * Species uniform within it. An empty Rarity falls back to the next less rare
 * one that has a Species; common always holds the reference. The weights
 * default to those of a first egg; `store.hatch` passes those of the Roster's
 * Luck. The formula is pinned by a test: never change it once shipped.
 */
export function hatch(hatchedAt: number, table: readonly Species[] = SPECIES, weights: Record<Rarity, number> = weightsAt(0)): SpeciesId {
  const random = generator(seed(hatchedAt, DOMAIN));
  const roll = random();
  const pick = random();
  for (let index = RARITIES.indexOf(rarityAt(roll, weights)); index >= 0; index--) {
    const pool = table.filter((entry) => entry.rarity === RARITIES[index]);
    if (pool.length > 0) return pool[Math.floor(pick * pool.length)]?.id ?? REFERENCE;
  }
  return REFERENCE;
}
