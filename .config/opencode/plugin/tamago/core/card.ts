import { bar, fmt } from "./format.ts";
import { BEHAVIOR_STATS, SCALE, sheet } from "./sheet.ts";
import { species } from "./species.ts";
import { next, stage, xp } from "./stage.ts";
import type { Career } from "./state.ts";

export const DAY_MS = 86_400_000;
export const BAR_WIDTH = 20;
/** One cell per point of the scale, so a bar reads without its number. */
export const STAT_BAR_WIDTH = SCALE.max - SCALE.min;
/** Shown at egg instead of the bars: the Sheet, like the Species, waits for the hatch. */
export const STATS_HIDDEN = "stats show at hatching";
/** Labels are padded to the longest behavior Stat so the bars line up. */
const LABEL_WIDTH = Math.max(...BEHAVIOR_STATS.map((stat) => stat.length));

/** Whole days since hatching, in words. */
export function age(hatchedAt: number, now: number): string {
  const days = Math.max(0, Math.floor((now - hatchedAt) / DAY_MS));
  if (days === 0) return "hatched today";
  return days === 1 ? "1 day old" : `${days} days old`;
}

/** The XP bar towards the next Stage, or a full bar once there is none. */
export function progress(career: Career, width = BAR_WIDTH): string {
  const coming = next(career);
  if (coming === undefined) return `${bar(1, width)} ${fmt(xp(career))} xp · final form`;
  return `${bar(coming.progress, width)} ${fmt(xp(career))} / ${fmt(coming.threshold)} xp → ${coming.stage}`;
}

/** The Species and its Rarity from hatchling on; before that the egg keeps its secret. */
export function speciesLine(career: Career): string {
  if (stage(career) === "egg") return "still an egg";
  const { label, rarity } = species(career.species);
  return `${label} · ${rarity}`;
}

/** "a" or "an", by the first letter of the label. */
function article(label: string): string {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

/** The hatch toast: the Species revealed, with its Rarity. */
export function reveal(name: string, career: Career): string {
  const { label, rarity } = species(career.species);
  return `${name} hatched: ${article(label)} ${label}, ${rarity}!`;
}

/** One line per behavior Stat, in BEHAVIOR_STATS order: label, bar, value after the Modifiers of the Species. At egg the single STATS_HIDDEN line. */
export function sheetLines(career: Career): string[] {
  if (stage(career) === "egg") return [STATS_HIDDEN];
  const stats = sheet(career.hatchedAt, career.species);
  return BEHAVIOR_STATS.map((stat) => `${stat.padEnd(LABEL_WIDTH)} ${bar((stats[stat] - SCALE.min) / (SCALE.max - SCALE.min), STAT_BAR_WIDTH)} ${stats[stat]}`);
}
