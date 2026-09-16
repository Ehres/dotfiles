import { generator, seed } from "./random.ts";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
/** From the most common to the rarest; the draw falls back along this order. */
export const RARITIES: readonly Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Tune here, never in code paths. First guess, like STAGES: adjust after real use. Paces have round reciprocals so raw thresholds stay readable. */
export const RARITY: Record<Rarity, { weight: number; pace: number }> = {
  common: { weight: 60, pace: 1 },
  uncommon: { weight: 25, pace: 0.8 },
  rare: { weight: 10, pace: 0.5 },
  epic: { weight: 4, pace: 0.4 },
  legendary: { weight: 1, pace: 0.25 },
};

export type SpeciesId = string;
export type Species = { id: SpeciesId; label: string; rarity: Rarity };

/** Every Species that can hatch. Order within a Rarity is the order of the draw. */
export const SPECIES: readonly Species[] = [
  { id: "cat", label: "cat", rarity: "common" },
  { id: "owl", label: "owl", rarity: "common" },
  { id: "dragon", label: "dragon", rarity: "legendary" },
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

/** The Rarity a number in [0, 1) lands on, by cumulative weight in RARITIES order. */
function rarityAt(roll: number): Rarity {
  const total = RARITIES.reduce((sum, rarity) => sum + RARITY[rarity].weight, 0);
  let cumulative = 0;
  for (const rarity of RARITIES) {
    cumulative += RARITY[rarity].weight / total;
    if (roll < cumulative) return rarity;
  }
  return RARITIES[RARITIES.length - 1] ?? "common";
}

/**
 * The Species a Tamago hatching at `hatchedAt` is: the same in every window of
 * this machine. Two draws, always both: the Rarity by weight, then a Species
 * uniform within it. An empty Rarity falls back to the next less rare one that
 * has a Species; common always holds the reference.
 */
export function hatch(hatchedAt: number, table: readonly Species[] = SPECIES): SpeciesId {
  const random = generator(seed(hatchedAt, DOMAIN));
  const roll = random();
  const pick = random();
  for (let index = RARITIES.indexOf(rarityAt(roll)); index >= 0; index--) {
    const pool = table.filter((entry) => entry.rarity === RARITIES[index]);
    if (pool.length > 0) return pool[Math.floor(pick * pool.length)]?.id ?? REFERENCE;
  }
  return REFERENCE;
}
