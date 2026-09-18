import { COMMON } from "./bodies/common.ts";
import { EPIC } from "./bodies/epic.ts";
import { LEGENDARY } from "./bodies/legendary.ts";
import { RARE } from "./bodies/rare.ts";
import { UNCOMMON } from "./bodies/uncommon.ts";
import type { SpeciesId } from "../creature/species.ts";
import type { StageId } from "../career/stage.ts";

export type Grown = Exclude<StageId, "egg">;
/** Takes three-column eyes and a one-column mark, gives the lines of the sprite; `fit` in sprites.ts pads them to SPRITE_WIDTH. */
export type Body = (eyes: string, mark: string) => string[];
/** Four bodies per Species, one per Stage past the egg. */
export type Bodies = Record<Grown, Body>;

/**
 * The bodies of every Species, one file per Rarity under bodies/. Every body
 * fits in SPRITE_WIDTH × SPRITE_HEIGHT, puts the eyes in `( e )` on line 1
 * and the mark at column 10 of line 0; the hatchling holds in four lines.
 * Tests in sprites.test.ts and bodies.test.ts enforce the size and that every
 * Species of the table is here.
 */
export const BODIES: Record<SpeciesId, Bodies> = { ...COMMON, ...UNCOMMON, ...RARE, ...EPIC, ...LEGENDARY };
