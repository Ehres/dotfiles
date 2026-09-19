import { generator, seed, weighted } from "../creature/random.ts";
import { TEMPERAMENTS, temperamentOf, type Speaker, type Temperament } from "../creature/sheet.ts";
import type { Cue, Phrases } from "./cue.ts";
import { FLAVOR, PHRASES } from "./phrases.ts";
import { SIGNATURE } from "./signature.ts";

/** Who speaks a Cue: the Species, one of the four Temperaments, or nobody in particular. */
export type Register = "species" | "temperament" | "neutral";
/** Tuning table: the share of each Register, out of their sum. The Species first, so a Tamago is recognized by ear; the Temperament as a nuance; the neutral phrases as a common ground. */
export const REGISTER: Record<Register, number> = { species: 70, temperament: 25, neutral: 5 };
const REGISTERS: readonly Register[] = ["species", "temperament", "neutral"];

/** The phrases of a Register for a Cue. A Species this build does not know has no Signature: its Temperament speaks in its place. */
function pool(cue: Cue, speaker: Speaker, register: Register, r: number): Phrases {
  switch (register) {
    case "species":
      return SIGNATURE[speaker.species]?.[cue] ?? FLAVOR[temperamentOf(speaker.sheet)][cue];
    case "temperament": {
      // A Temperament Stat may sit below zero after a Modifier: it weighs nothing. All four at zero cannot happen with a drawn Sheet; the Temperament speaks then.
      const stat = (temperament: Temperament): number => Math.max(0, speaker.sheet[temperament]);
      const total = TEMPERAMENTS.reduce((sum, temperament) => sum + stat(temperament), 0);
      return FLAVOR[total > 0 ? weighted(r, TEMPERAMENTS, stat) : temperamentOf(speaker.sheet)][cue];
    }
    case "neutral":
      return PHRASES[cue];
  }
}

/** The domain of the voice seed: one draw per Cue and occurrence, so a Cue added later never moves the others. No Milestone id is ever `voice:…`. */
function domain(cue: Cue, times: number): string {
  return `voice:${cue}:${times}`;
}

/**
 * The phrase a Tamago says the `times`-th time it speaks `cue`. Seeded from
 * the hatch date, the Cue and the count: every window agrees for the same
 * occurrence of the Cue, nothing is stored, and one hears a different phrase
 * from one time to the next. The Register first, at REGISTER shares; then,
 * for the Temperament, which of the four at the weight of its Stat; then a
 * phrase, uniform. At `hatched` the Species always speaks: that is where it
 * shows.
 */
export function phrase(cue: Cue, speaker: Speaker, times: number): string {
  const random = generator(seed(speaker.hatchedAt, domain(cue, times)));
  const register = cue === "hatched" ? "species" : weighted(random(), REGISTERS, (key) => REGISTER[key]);
  const own = pool(cue, speaker, register, random());
  return own[Math.floor(random() * own.length)] ?? own[0];
}
