import type { Activity } from "./state.ts";

/** Frame period of animations that show effort, and the tick period while any session shows it. */
export const FAST_MS = 500;
/** Frame period of calm animations, and the tick period when every session is calm. */
export const SLOW_MS = 2_000;

/**
 * Tuning table, one entry per Activity: how often its frames alternate
 * (undefined: never), and whether it needs the fast tick because it animates
 * fast or runs a short timer (hurt recovery). Adding an Activity without a row
 * is a type error.
 */
export const CADENCE: Record<Activity, { frameMs: number | undefined; fastTick: boolean }> = {
  idle: { frameMs: SLOW_MS, fastTick: false },
  thinking: { frameMs: FAST_MS, fastTick: true },
  working: { frameMs: FAST_MS, fastTick: true },
  waiting: { frameMs: SLOW_MS, fastTick: false },
  hurt: { frameMs: SLOW_MS, fastTick: true },
  sleeping: { frameMs: undefined, fastTick: false },
};

/** Which frame to show after `elapsedMs` in a given Activity. */
export function frameIndex(activity: Activity, elapsedMs: number): number {
  const period = CADENCE[activity].frameMs;
  return period === undefined ? 0 : Math.floor(elapsedMs / period);
}

/** How long to wait before the next tick, given what every tracked session is doing. */
export function tickInterval(activities: readonly Activity[]): number {
  return activities.some((activity) => CADENCE[activity].fastTick) ? FAST_MS : SLOW_MS;
}
