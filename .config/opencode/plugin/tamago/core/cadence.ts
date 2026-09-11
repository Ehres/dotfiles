import type { Activity } from "./state.ts";

/** Slow animations advance once every this many ticks. */
export const SLOW_FRAME_TICKS = 4;

/** Which frame to show after `ticks` ticks in a given Activity. */
export function frameIndex(activity: Activity, ticks: number): number {
  if (activity === "working" || activity === "thinking") return ticks;
  if (activity === "sleeping") return 0;
  return Math.floor(ticks / SLOW_FRAME_TICKS);
}
