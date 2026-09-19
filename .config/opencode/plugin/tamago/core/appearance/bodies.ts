import type { StageId } from "../career/stage.ts";

export type Grown = Exclude<StageId, "egg">;
/** Takes three-column eyes and a one-column mark, gives the lines of the sprite; `fit` in sprites.ts pads them to SPRITE_WIDTH. */
export type Body = (eyes: string, mark: string) => string[];
/**
 * Four bodies per Species, one per Stage past the egg. The bodies of every
 * Species live in `core/creature/species/<rarity>.ts`, one entry per Species
 * with its Signature. Every body fits in SPRITE_WIDTH × SPRITE_HEIGHT, puts
 * the eyes in `( e )` on line 1 and the mark at column 10 of line 0; the
 * hatchling holds in four lines. Tests in sprites.test.ts and catalog.test.ts
 * enforce the size.
 */
export type Bodies = Record<Grown, Body>;
