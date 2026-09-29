import type { StageId } from "../career/stage.ts";
import type { Expressions, Point } from "./expressions.ts";
import type { Motion } from "./motion.ts";

export type Grown = Exclude<StageId, "egg">;

/** Named points of a Body. `head` is required: the heart and the bubble tail read it. */
export type Anchors = { head: Point; [name: string]: Point };

/**
 * One Stage of one Species. `pixels` is PIXEL_HEIGHT rows of SPRITE_WIDTH
 * characters of MAP_ALPHABET: colour, and only colour. Everything that moves
 * or receives a patch is declared beside it, so no character of the map ever
 * has two meanings.
 *
 * MARK_SLOT and BADGE_SLOT must stay transparent; every anchor the Species'
 * expressions name must exist here; `head` must leave room for the heart; a
 * `motion` rectangle must hold its region alone. sprites.test.ts enforces all
 * four — anchor names are strings, so this is where a missing one is caught.
 *
 * `expressions` overrides the Species' table for this Stage alone, merged over
 * it rather than replacing it. Optional, and rarely needed.
 */
export type Body = {
  pixels: readonly string[];
  anchors: Anchors;
  expressions?: Partial<Expressions>;
  motion?: Motion;
  /** Further whole maps for this Stage; the cadence alternates over them. `pixels` is frame zero and the only one a Species must give. */
  frames?: readonly (readonly string[])[];
};

/** Four maps per Species, one per Stage past the egg. */
export type Maps = Record<Grown, Body>;
