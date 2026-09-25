import type { TraitId } from "../career/pick.ts";
import type { Pattern, Rect } from "./pixels.ts";

/** Where a mark is written: the top-left 3 x 3, transparent in every map. */
export const MARK_SLOT: Rect = { x: 0, y: 0, w: 3, h: 3 };
/** Where a pending Draw is shown: the top-right 3 x 3, transparent in every map. */
export const BADGE_SLOT: Rect = { x: 18, y: 0, w: 3, h: 3 };

/**
 * A key into OpenCode's theme, named here so a Trait can be given one without core resolving it to
 * an actual colour: view/ is still the only layer that turns a key into an RGBA.
 *
 * Six keys, checked against the shipped `tokyonight` theme (the user's own, `tui.jsonc`) so all six
 * actually render as six: `accent` and `warning` are the same hex there, and so are `primary` and
 * `info`, which would silently pair two Traits onto one colour. `diffAdded` fills the sixth slot with
 * a teal that sits clear of the other five.
 */
export type ThemeColor = "success" | "error" | "accent" | "secondary" | "primary" | "diffAdded";

/**
 * Tune here, never in code paths. One 3 x 3 pattern per Trait, plus a colour: every Pick marks the
 * Sprite, whatever the Trait's family, so a choice always shows, and six Traits read as six, not as
 * one monochrome corner.
 */
export const MARK: Record<TraitId, { pattern: Pattern; color: ThemeColor }> = {
  hardy: { pattern: [".#.", "###", ".#."], color: "success" },
  unshaken: { pattern: ["###", "###", "###"], color: "accent" },
  proud: { pattern: ["#.#", ".#.", "#.#"], color: "error" },
  boastful: { pattern: [".#.", "#.#", "..."], color: "diffAdded" },
  watchful: { pattern: [".#.", "...", ".#."], color: "secondary" },
  restless: { pattern: ["..#", ".#.", "#.."], color: "primary" },
};

/** The pending-Draw badge, painted in the other corner. */
export const BADGE: Pattern = ["###", "#.#", "###"];

/** The Trait whose mark the Sprite wears: the most recent Pick that has one. `held` comes from `traits(career)`, oldest first. */
export function markOf(held: readonly TraitId[]): TraitId | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    if (id !== undefined && Object.prototype.hasOwnProperty.call(MARK, id)) return id;
  }
  return undefined;
}
