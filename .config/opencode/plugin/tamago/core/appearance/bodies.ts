import type { StageId } from "../career/stage.ts";
import type { Rect } from "./pixels.ts";
import type { Motion } from "./motion.ts";

export type Grown = Exclude<StageId, "egg">;

/**
 * One Stage of one Species. `pixels` is PIXEL_HEIGHT rows of SPRITE_WIDTH
 * characters of MAP_ALPHABET: colour, and only colour. Everything that moves
 * or receives an overlay is a rectangle declared beside it, so no character
 * of the map ever has two meanings.
 *
 * MARK_SLOT and BADGE_SLOT must stay transparent; `eyes` must fall on the
 * body; a `motion` rectangle must hold the region alone. Tests in
 * sprites.test.ts and catalog.test.ts enforce all three.
 */
export type Body = {
  pixels: readonly string[];
  eyes: readonly [Rect, Rect];
  motion?: Motion;
};

/** Four bodies per Species, one per Stage past the egg. */
export type Maps = Record<Grown, Body>;

/** Kept until Task 14 deletes the last ASCII body. */
export type Bodies = Record<Grown, (eyes: string, mark: string) => string[]>;
