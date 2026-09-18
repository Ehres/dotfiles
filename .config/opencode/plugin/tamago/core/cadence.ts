import { MEDIAN, type Behavior } from "./behavior.ts";
import type { Activity } from "./session.ts";

/** Which of the two periods of a Behavior an animation alternates on; undefined never animates. */
export type FramePace = "fast" | "slow" | undefined;

/**
 * Tuning table, one entry per Activity: which pace its frames alternate on
 * (undefined: never), and whether it needs the fast tick because it animates
 * fast or runs a short timer (hurt recovery). The Behavior turns a pace into
 * milliseconds. Adding an Activity without a row is a type error.
 */
export const CADENCE: Record<Activity, { frame: FramePace; fastTick: boolean }> = {
  idle: { frame: "slow", fastTick: false },
  thinking: { frame: "fast", fastTick: true },
  working: { frame: "fast", fastTick: true },
  waiting: { frame: "slow", fastTick: false },
  hurt: { frame: "slow", fastTick: true },
  sleeping: { frame: undefined, fastTick: false },
};

/** The period of a pace for this Behavior, undefined when it never animates. */
function period(frame: FramePace, behavior: Behavior): number | undefined {
  if (frame === undefined) return undefined;
  return frame === "fast" ? behavior.fastMs : behavior.slowMs;
}

/** Which frame to show after `elapsedMs` in a given Activity. */
export function frameIndex(activity: Activity, elapsedMs: number, behavior: Behavior = MEDIAN): number {
  const ms = period(CADENCE[activity].frame, behavior);
  return ms === undefined ? 0 : Math.floor(elapsedMs / ms);
}

/** How long to wait before the next tick, given what every tracked session is doing. */
export function tickInterval(activities: readonly Activity[], behavior: Behavior = MEDIAN): number {
  return activities.some((activity) => CADENCE[activity].fastTick) ? behavior.fastMs : behavior.slowMs;
}
