import { next } from "../career/stage.ts";
import { BEHAVIOR_STATS, SCALE } from "../creature/sheet.ts";
import type { Language, Phrase } from "../language.ts";
import { say } from "../language.ts";
import type { Tamago } from "../tamago.ts";
import { bar, fmt } from "../appearance/format.ts";
import { MARK } from "../appearance/marks.ts";
import { RARITY_TEXT, STAGE_TEXT, STAT_TEXT } from "./tables.ts";
import { TRAIT_TEXT } from "./traits.ts";
import { word } from "./word.ts";

export const DAY_MS = 86_400_000;
export const BAR_WIDTH = 20;
/** One cell per point of the scale, so a bar reads without its number. */
export const STAT_BAR_WIDTH = SCALE.max - SCALE.min;
/** Shown at egg instead of the bars: the Sheet, like the Species, waits for the hatch. */
export const STATS_HIDDEN: Phrase = { en: "stats show at hatching", fr: "les stats viennent à l'éclosion" };

/** Labels are padded to the longest behavior Stat of that Language, so the bars line up. */
function labelWidth(language: Language): number {
  return Math.max(...BEHAVIOR_STATS.map((stat) => say(STAT_TEXT[stat], language).length));
}

/** Whole days since hatching, in words. */
export function age(hatchedAt: number, now: number, language: Language = "en"): string {
  const days = Math.max(0, Math.floor((now - hatchedAt) / DAY_MS));
  switch (language) {
    case "en":
      return days === 0 ? "hatched today" : days === 1 ? "1 day old" : `${days} days old`;
    case "fr":
      return days === 0 ? "éclos aujourd'hui" : days === 1 ? "1 jour" : `${days} jours`;
  }
}

/** The XP bar towards the next Stage, or a full bar once there is none. */
export function progress(tamago: Tamago, width = BAR_WIDTH, language: Language = "en"): string {
  const coming = next(tamago.career);
  if (coming === undefined) {
    const final = language === "en" ? "final form" : "forme finale";
    return `${bar(1, width)} ${fmt(tamago.xp, language)} xp · ${final}`;
  }
  const gender = tamago.species.gender ?? "m";
  const stageName = word(STAGE_TEXT[coming.stage], language, gender);
  return `${bar(coming.progress, width)} ${fmt(tamago.xp, language)} / ${fmt(coming.threshold, language)} xp → ${stageName}`;
}

/** The Species and its Rarity from hatchling on; before that the egg keeps its secret. */
export function speciesLine(tamago: Tamago, language: Language = "en"): string {
  if (tamago.stage === "egg") return language === "en" ? "still an egg" : "encore un œuf";
  const gender = tamago.species.gender ?? "m";
  const label = say(tamago.species.label, language);
  const rarity = word(RARITY_TEXT[tamago.species.rarity], language, gender);
  return `${label} · ${rarity}`;
}

/** "a" or "an" by the first letter in English; "un" or "une" by the gender in French. */
function article(tamago: Tamago, language: Language): string {
  if (language === "en") return /^[aeiou]/i.test(say(tamago.species.label, "en")) ? "an" : "a";
  return tamago.species.gender === "f" ? "une" : "un";
}

/** The hatch toast: the Species revealed, with its Rarity. */
export function reveal(name: string, tamago: Tamago, language: Language = "en"): string {
  const label = say(tamago.species.label, language);
  const gender = tamago.species.gender ?? "m";
  const rarity = word(RARITY_TEXT[tamago.species.rarity], language, gender);
  switch (language) {
    case "en":
      return `${name} hatched: ${article(tamago, language)} ${label}, ${rarity}!`;
    case "fr":
      return `${name} a éclos : ${article(tamago, language)} ${label}, ${rarity} !`;
  }
}

/** One line per behavior Stat, in BEHAVIOR_STATS order: label, bar, value after the Modifiers of the Species. At egg the single STATS_HIDDEN line. */
export function sheetLines(tamago: Tamago, language: Language = "en"): string[] {
  if (tamago.stage === "egg") return [say(STATS_HIDDEN, language)];
  const width = labelWidth(language);
  return BEHAVIOR_STATS.map((stat) => {
    const label = say(STAT_TEXT[stat], language);
    return `${label.padEnd(width)} ${bar((tamago.sheet[stat] - SCALE.min) / (SCALE.max - SCALE.min), STAT_BAR_WIDTH)} ${tamago.sheet[stat]}`;
  });
}

/** One line per held Trait: its mark and its title. Empty when none is held, so the card shows nothing. */
export function traitLines(tamago: Tamago, language: Language = "en"): string[] {
  return tamago.traits.map((id) => `${MARK[id] ?? " "} ${say(TRAIT_TEXT[id]?.title ?? { en: id }, language)}`);
}
