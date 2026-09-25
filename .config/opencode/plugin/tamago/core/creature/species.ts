import type { Bodies, Maps } from "../appearance/bodies.ts";
import type { Palettes } from "../appearance/palette.ts";
import type { Phrase } from "../language.ts";
import type { Signature } from "../speech/signature.ts";
import { REFERENCE, SPECIES } from "./catalog.ts";
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

/** French agrees in gender, English does not; the Species is what carries the fact. */
export type Gender = "m" | "f";

/** `sheet` holds the Modifiers this Species adds to the Sheet; absent for none. */
export type Species = { id: SpeciesId; label: Phrase; gender: Gender; rarity: Rarity; sheet?: Modifiers };

/** A catalog entry: the Species plus what it draws and what it says. Missing either is a compile error. */
export type SpeciesDef = Species & { bodies?: Bodies; maps?: Maps; palettes?: Palettes; signature: Signature };

/** The domain mixed into the hatch seed. No Milestone id is ever this string. */
const DOMAIN = "species";

/** The table entry for an id; the reference entry for an id this build does not know. */
export function species(id: SpeciesId, table: readonly Species[] = SPECIES): Species {
  return table.find((entry) => entry.id === id) ?? table.find((entry) => entry.id === REFERENCE) ?? { id: REFERENCE, label: { en: REFERENCE, fr: REFERENCE }, gender: "m", rarity: "common" };
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
