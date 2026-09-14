import type { Activity } from "./state.ts";

/** Frame period of animations that show effort, and the tick period while any session shows it. */
export const FAST_MS = 500;
/** Frame period of calm animations, and the tick period when every session is calm. */
export const SLOW_MS = 2_000;

/** Activities that need the fast tick: they animate fast, or run a short timer (hurt recovery). */
const FAST: ReadonlySet<Activity> = new Set<Activity>(["thinking", "working", "hurt"]);

/** Which frame to show after `elapsedMs` in a given Activity. */
export function frameIndex(activity: Activity, elapsedMs: number): number {
  if (activity === "thinking" || activity === "working") return Math.floor(elapsedMs / FAST_MS);
  if (activity === "sleeping") return 0;
  return Math.floor(elapsedMs / SLOW_MS);
}

/** How long to wait before the next tick, given what every tracked session is doing. */
export function tickInterval(activities: readonly Activity[]): number {
  return activities.some((activity) => FAST.has(activity)) ? FAST_MS : SLOW_MS;
}
