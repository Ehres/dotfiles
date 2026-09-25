import { PIXEL_HEIGHT, SPRITE_WIDTH, type Rect } from "./pixels.ts";

/** The regions of a Body that move. Absent means still. */
export type Motion = { tail?: Rect; ears?: readonly Rect[] };

/**
 * Tune here, never in code paths. One entry per beat of the tail's cycle, in
 * pixels. It starts and ends at rest and sums to zero, so a Tamago whose
 * animation is interrupted is never left leaning.
 */
export const SWEEP: readonly number[] = [0, 1, 1, 0, -1, -1];

/** Beats between two blinks. Prime against SWEEP.length so the two never lock in step. */
const BLINK_EVERY = 11;
/** Which beat of the cycle the eyes shut on: not the resting one, so a blink reads as a change. */
const BLINK_ON = 7;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

/** How far the tail leans on a given beat. */
export function sweepAt(index: number): number {
  return SWEEP[wrap(index, SWEEP.length)] ?? 0;
}

/** Whether the eyes are shut on a given beat. */
export function blinksAt(index: number): boolean {
  return wrap(index, BLINK_EVERY) === BLINK_ON;
}

/**
 * Moves every opaque pixel inside `at` by `dx`, on a copy of `rows`. A pixel
 * pushed past the rectangle's own edge is dropped: a region never spills onto
 * the body beside it.
 */
export function shift(rows: readonly string[], at: Rect, dx: number): string[] {
  if (at.x < 0 || at.y < 0 || at.x + at.w > SPRITE_WIDTH || at.y + at.h > PIXEL_HEIGHT) {
    throw new Error(`the rectangle ${at.x},${at.y} ${at.w}x${at.h} falls outside the map`);
  }
  if (dx === 0) return rows.slice();
  const next = rows.slice();
  for (let dy = 0; dy < at.h; dy++) {
    const row = next[at.y + dy];
    if (row === undefined) continue;
    const chars = row.split("");
    const taken: string[] = [];
    for (let i = 0; i < at.w; i++) {
      taken.push(chars[at.x + i] ?? ".");
      chars[at.x + i] = ".";
    }
    for (let i = 0; i < at.w; i++) {
      const to = i + dx;
      if (to >= 0 && to < at.w && taken[i] !== ".") chars[at.x + to] = taken[i] ?? ".";
    }
    next[at.y + dy] = chars.join("");
  }
  return next;
}
