import type { TraitId } from "../career/pick.ts";
import type { Pattern, Rect } from "./pixels.ts";

/** Where a mark is written: the top-left 3 x 3, transparent in every map. */
export const MARK_SLOT: Rect = { x: 0, y: 0, w: 3, h: 3 };
/** Where a pending Draw is shown: the top-right 3 x 3, transparent in every map. */
export const BADGE_SLOT: Rect = { x: 18, y: 0, w: 3, h: 3 };

/**
 * Tune here, never in code paths. One 3 x 3 pattern per Trait: every Pick
 * marks the Sprite, whatever the Trait's family, so a choice always shows.
 */
export const MARK: Record<TraitId, Pattern> = {
  hardy: [".#.", "###", ".#."],
  unshaken: ["###", "###", "###"],
  proud: ["#.#", ".#.", "#.#"],
  boastful: [".#.", "#.#", "..."],
  watchful: [".#.", "...", ".#."],
  restless: ["..#", ".#.", "#.."],
};

/** The pending-Draw badge, painted in the other corner. */
export const BADGE: Pattern = ["#.#", ".#.", "#.#"];

/** The Trait whose mark the Sprite wears: the most recent Pick that has one. `held` comes from `traits(career)`, oldest first. */
export function markOf(held: readonly TraitId[]): TraitId | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    if (id !== undefined && MARK[id] !== undefined) return id;
  }
  return undefined;
}
