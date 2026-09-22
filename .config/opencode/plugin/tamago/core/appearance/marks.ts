import type { TraitId } from "../career/pick.ts";

/**
 * Tune here, never in code paths. One column each: the mark is written over
 * one cell of the finished Frame. Every Pick marks the Sprite, whatever the
 * Trait's family, so a choice always shows.
 */
export const MARK: Record<TraitId, string> = {
  hardy: "+",
  unshaken: "#",
  proud: "*",
  boastful: "^",
  watchful: ":",
  restless: "~",
};

/** Where a mark is written: the top-left cell, free in every Species at every Stage (a test in catalog.test.ts keeps it so). */
export const MARK_LINE = 0;
export const MARK_COLUMN = 0;

/** The mark of the most recent Pick, so a new choice shows at once; undefined when no held Trait has one. `held` comes from `traits(career)`, oldest Pick first. */
export function markOf(held: readonly TraitId[]): string | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    const found = id === undefined ? undefined : MARK[id];
    if (found !== undefined) return found;
  }
  return undefined;
}
