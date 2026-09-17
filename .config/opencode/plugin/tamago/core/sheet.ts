import { generator, seed } from "./random.ts";
import { SPECIES, species, type Species, type SpeciesId } from "./species.ts";

export type Temperament = "cheerful" | "sarcastic" | "stoic" | "dreamy";
/** The four Temperament Stats, read at the maximum. Order matters: ties go to the first one. Never reorder once shipped. */
export const TEMPERAMENTS: readonly Temperament[] = ["cheerful", "sarcastic", "stoic", "dreamy"];
export type BehaviorStat = "energy" | "chatter" | "sensitivity" | "patience";
/** The four behavior Stats, read by value. Order is the order of the bars on the card. */
export const BEHAVIOR_STATS: readonly BehaviorStat[] = ["energy", "chatter", "sensitivity", "patience"];
export type Stat = Temperament | BehaviorStat;
export const STATS: readonly Stat[] = [...TEMPERAMENTS, ...BEHAVIOR_STATS];

/** The eight Stats of a Tamago. Derived from the hatch date and the Species, never stored. */
export type Sheet = Record<Stat, number>;
/** What a Species adds to each Stat; absent is 0. */
export type Modifiers = Partial<Record<Stat, number>>;

/**
 * Every Stat is an integer in [min, max]; median gives the behavior the plugin
 * had before the Sheet. The historical Temperament Stat draws in [high, max],
 * the other three below it, so that without Modifiers the Sheet gives back
 * the historical Temperament.
 */
export const SCALE = { min: 0, max: 10, median: 5, high: 6 };
/** Bounds a test enforces on every Species of the table: one Modifier, and their sum in absolute value. */
export const MODIFIER_MAX = 3;
export const MODIFIERS_SUM_MAX = 8;

/** The domain mixed into the hatch seed, one per Stat. No Milestone id is ever `sheet:…`. */
function domain(stat: Stat): string {
  return `sheet:${stat}`;
}

/**
 * A fixed mix of the hatch timestamp: the Temperament every Career had before
 * the Sheet existed, and the Stat the Sheet draws high. Never change these
 * constants once shipped: every Tamago on every machine would change
 * Temperament. Moved unchanged from character.ts.
 */
export function historical(hatchedAt: number): Temperament {
  let h = Math.floor(hatchedAt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return TEMPERAMENTS[h % TEMPERAMENTS.length] ?? "cheerful";
}

/** One number in [0, 1) per Stat, from its own seed: a Stat added later never moves the others. */
function roll(hatchedAt: number, stat: Stat): number {
  return generator(seed(hatchedAt, domain(stat)))();
}

/** An integer in [min, max], uniform, from a number in [0, 1). */
function within(r: number, min: number, max: number): number {
  return min + Math.floor(r * (max - min + 1));
}

/** The eight Stats of a hatch date before any Modifier. */
export function draw(hatchedAt: number): Sheet {
  const high = historical(hatchedAt);
  const top = within(roll(hatchedAt, high), SCALE.high, SCALE.max);
  const sheet = {} as Sheet; // filled below for every Stat of STATS
  for (const stat of TEMPERAMENTS) sheet[stat] = stat === high ? top : within(roll(hatchedAt, stat), SCALE.min, top - 1);
  for (const stat of BEHAVIOR_STATS) sheet[stat] = within(roll(hatchedAt, stat), SCALE.min, SCALE.max);
  return sheet;
}

/**
 * The Sheet of a Tamago: the draw plus the Modifiers of its Species, the same
 * in every window of this machine. Behavior Stats are clamped to the scale so
 * the Behavior stays between half and double; Temperament Stats are not, so a
 * Species may make a Temperament certain. An unknown Species has no Modifier.
 */
export function sheet(hatchedAt: number, id: SpeciesId, table: readonly Species[] = SPECIES): Sheet {
  const drawn = draw(hatchedAt);
  const modifiers = species(id, table).sheet ?? {};
  const result = { ...drawn };
  for (const stat of TEMPERAMENTS) result[stat] = drawn[stat] + (modifiers[stat] ?? 0);
  for (const stat of BEHAVIOR_STATS) result[stat] = Math.min(SCALE.max, Math.max(SCALE.min, drawn[stat] + (modifiers[stat] ?? 0)));
  return result;
}

/** The highest Temperament Stat; ties go to TEMPERAMENTS order. */
export function temperamentOf(sheet: Sheet): Temperament {
  let best: Temperament = TEMPERAMENTS[0] ?? "cheerful";
  for (const stat of TEMPERAMENTS) if (sheet[stat] > sheet[best]) best = stat;
  return best;
}

/** 2^((v − median) / (max − median)): 0.5 at min, 1 at median, 2 at max. Geometric, because a duration is felt in ratio. */
export function factor(value: number): number {
  return 2 ** ((value - SCALE.median) / (SCALE.max - SCALE.median));
}
