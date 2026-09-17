import type { Rarity } from "./species.ts";

/**
 * Luck: how much the elders of the Roster tilt the next Hatch toward the
 * rare. Nothing here is stored: `store.hatch` sums the points of the elders
 * on disk and passes `weightsAt(luck)` to the draw. This module imports only
 * a type, so `species.ts` can import it without a cycle. Every number below
 * is a tuning knob: change the table, not the code.
 */

/** What one `elder` of each Rarity adds to the Luck. */
export const LUCK_POINTS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

/** The weights of the first egg: epic and legendary are earned, never given. */
export const BASE_WEIGHTS: Record<Rarity, number> = { common: 65, uncommon: 25, rare: 10, epic: 0, legendary: 0 };

/** What one point of Luck moves, per Rarity. Sums to zero so the total stays 100. */
export const LUCK_STEP: Record<Rarity, number> = { common: -4, uncommon: 1.5, rare: 1, epic: 1, legendary: 0.5 };

/** Common never falls below this: a common Species is not a punishment, and it is where the variety is. */
export const COMMON_FLOOR = 20;

/** The Luck past which nothing moves: where common reaches its floor. 11.25 with the tables above. */
export const LUCK_MAX = (BASE_WEIGHTS.common - COMMON_FLOOR) / -LUCK_STEP.common;

/** The weights of every Rarity at a given Luck: the base plus the step per point, capped so common stays at its floor. */
export function weightsAt(luck: number): Record<Rarity, number> {
  const effective = Math.min(Math.max(luck, 0), LUCK_MAX);
  const weights = {} as Record<Rarity, number>; // filled below for every key of BASE_WEIGHTS
  for (const rarity of Object.keys(BASE_WEIGHTS) as Rarity[]) weights[rarity] = BASE_WEIGHTS[rarity] + LUCK_STEP[rarity] * effective;
  return weights;
}
