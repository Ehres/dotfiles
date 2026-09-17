import { factor, sheet, type Sheet } from "./sheet.ts";
import { SPECIES, type Species } from "./species.ts";
import type { Career } from "./state.ts";

/** The durations and the count the behavior Stats of a Sheet set for one Tamago. Computed, never stored. */
export type Behavior = {
  /** Idle time before sleeping. energy × f */
  sleepMs: number;
  /** Frame and tick period while any session shows effort. energy ÷ f */
  fastMs: number;
  /** Frame and tick period when every session is calm. Always SLOW_PER_FAST × fastMs. */
  slowMs: number;
  /** Minimum gap between two Bubble starts. chatter ÷ f */
  quietMs: number;
  /** How long a Bubble stays up. chatter × f */
  bubbleMs: number;
  /** How long hurt lasts. sensitivity × f */
  hurtMs: number;
  /** Failures within STREAK_MS that make a streak. round(sensitivity ÷ f), at least STREAK_MIN */
  streakCount: number;
  /** Busy time after which going idle deserves a word. patience × f */
  longWorkMs: number;
};

/**
 * The Behavior of a median Sheet: the values the plugin used as constants
 * before the Sheet existed. Tune here, never in code paths. The default of
 * every function that takes a Behavior; events.ts, cadence.ts and voice.ts
 * re-export its fields under their old names, so this module imports none of
 * them and no import cycle exists.
 */
export const MEDIAN: Behavior = {
  sleepMs: 120_000,
  fastMs: 500,
  slowMs: 2_000,
  quietMs: 10_000,
  bubbleMs: 5_000,
  hurtMs: 3_000,
  streakCount: 3,
  longWorkMs: 300_000,
};
/** The slow cadence stays a whole multiple of the fast one, so a mode switch never skips or repeats a frame. */
export const SLOW_PER_FAST = MEDIAN.slowMs / MEDIAN.fastMs;
/** Below two, every lone failure would be a streak. */
export const STREAK_MIN = 2;

/** The Behavior a Sheet sets. Milliseconds are rounded; slowMs derives from the rounded fastMs so the multiple holds. */
export function behaviorOf(sheet: Sheet): Behavior {
  const energy = factor(sheet.energy);
  const chatter = factor(sheet.chatter);
  const sensitivity = factor(sheet.sensitivity);
  const patience = factor(sheet.patience);
  const fastMs = Math.round(MEDIAN.fastMs / energy);
  return {
    sleepMs: Math.round(MEDIAN.sleepMs * energy),
    fastMs,
    slowMs: fastMs * SLOW_PER_FAST,
    quietMs: Math.round(MEDIAN.quietMs / chatter),
    bubbleMs: Math.round(MEDIAN.bubbleMs * chatter),
    hurtMs: Math.round(MEDIAN.hurtMs * sensitivity),
    streakCount: Math.max(STREAK_MIN, Math.round(MEDIAN.streakCount / sensitivity)),
    longWorkMs: Math.round(MEDIAN.longWorkMs * patience),
  };
}

/** The Behavior of a Career: the same in every window, like its Stage. */
export function behavior(career: Pick<Career, "hatchedAt" | "species">, table: readonly Species[] = SPECIES): Behavior {
  return behaviorOf(sheet(career.hatchedAt, career.species, table));
}
