import type { Cue, Phrases } from "./cue.ts";

/**
 * The phrases a Species owns for every Cue: its Register in the voice. The
 * Signature of every Species lives in `core/creature/species/<rarity>.ts`, one
 * entry per Species with its bodies. The voice draws a Register per Cue spoken
 * (see `phrase` in register.ts): the Species most of the time, so a Tamago is
 * recognized by ear; the Temperament as a nuance; the neutral phrases as a
 * common ground. At `hatched` the Species always speaks: the hatch is where it
 * shows. English, at most MAX_TEXT characters each; a test in catalog.test.ts
 * enforces the coverage.
 */
export type Signature = Record<Cue, Phrases>;
