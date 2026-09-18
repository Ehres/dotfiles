import { COMMON } from "./signatures/common.ts";
import { EPIC } from "./signatures/epic.ts";
import { LEGENDARY } from "./signatures/legendary.ts";
import { RARE } from "./signatures/rare.ts";
import { UNCOMMON } from "./signatures/uncommon.ts";
import type { SpeciesId } from "../creature/species.ts";
import type { Cue, Phrases } from "./voice.ts";

/** The phrases a Species owns for every Cue: its Register in the voice. */
export type Signature = Record<Cue, Phrases>;

/**
 * The Signature of every Species, one file per Rarity under signatures/. The
 * voice draws a Register per Cue spoken (see `phrase` in voice.ts): the
 * Species most of the time, so a Tamago is recognized by ear; the Temperament
 * as a nuance; the neutral phrases as a common ground. At `hatched` the
 * Species always speaks: the hatch is where it shows. English, at most
 * MAX_TEXT characters each; a test enforces the coverage, and that every
 * Species of the table has an entry here.
 */
export const SIGNATURE: Partial<Record<SpeciesId, Signature>> = { ...COMMON, ...UNCOMMON, ...RARE, ...EPIC, ...LEGENDARY };
