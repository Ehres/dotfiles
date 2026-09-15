import { bar, fmt } from "./format.ts";
import { next, xp } from "./stage.ts";
import type { Career } from "./state.ts";

export const DAY_MS = 86_400_000;
export const BAR_WIDTH = 20;

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
