import type { TraitId } from "../career/pick.ts";
import type { Career } from "../career/career.ts";

export type Trait = {
  id: TraitId;
  /** Traits that must be held for this one to be eligible. Empty for a starter Trait. */
  needs: readonly TraitId[];
};

/**
 * Tune here, never in code paths. Says what exists and what it needs; what a
 * Trait does on its surface (phrases, Cue, Sprite mark) belongs to that
 * surface's module. Empty until the first real Trait.
 */
export const TRAITS: readonly Trait[] = [];

/** Traits the Career holds, by Pick `at` then trait id, each once. A Pick naming an unknown Trait is ignored, never an error. */
export function traits(career: Career, table: readonly Trait[] = TRAITS): TraitId[] {
  const known = new Set(table.map((trait) => trait.id));
  const picks = Object.values(career.picks)
    .filter((pick) => known.has(pick.trait))
    .sort((a, b) => a.at - b.at || (a.trait < b.trait ? -1 : a.trait > b.trait ? 1 : 0));
  const held: TraitId[] = [];
  for (const pick of picks) if (!held.includes(pick.trait)) held.push(pick.trait);
  return held;
}

/** Traits not held whose needs are all held, in table order. */
export function eligible(career: Career, table: readonly Trait[] = TRAITS): TraitId[] {
  const held = new Set(traits(career, table));
  return table.filter((trait) => !held.has(trait.id) && trait.needs.every((need) => held.has(need))).map((trait) => trait.id);
}
