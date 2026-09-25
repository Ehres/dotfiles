import { test } from "node:test";
import assert from "node:assert/strict";
import { PIXEL_HEIGHT, SPRITE_WIDTH } from "../pixels.ts";
import { BLINK_EVERY, SWEEP, blinksAt, shift, sweepAt } from "../motion.ts";

function blank(): string[] {
  return Array.from({ length: PIXEL_HEIGHT }, () => ".".repeat(SPRITE_WIDTH));
}

test("shift moves the opaque pixels of a rectangle and clears where they were", () => {
  const rows = blank();
  rows[4] = "..aa".padEnd(SPRITE_WIDTH, ".");
  const moved = shift(rows, { x: 2, y: 4, w: 4, h: 1 }, 1);
  assert.equal(moved[4]?.slice(0, 6), "...aa.");
});

test("shift leaves pixels outside the rectangle where they are", () => {
  const rows = blank();
  rows[4] = "aa".padEnd(SPRITE_WIDTH, ".");
  const moved = shift(rows, { x: 5, y: 4, w: 3, h: 1 }, 1);
  assert.equal(moved[4]?.slice(0, 3), "aa.");
});

test("a pixel pushed past the edge of the rectangle is dropped, never wrapped", () => {
  const rows = blank();
  rows[4] = "..aa".padEnd(SPRITE_WIDTH, ".");
  const moved = shift(rows, { x: 2, y: 4, w: 2, h: 1 }, 1);
  assert.equal(moved[4]?.slice(0, 5), "...a.");
});

test("shift does not mutate the rows it is given", () => {
  const before = blank();
  before[4] = "..aa".padEnd(SPRITE_WIDTH, ".");
  shift(before, { x: 2, y: 4, w: 4, h: 1 }, 1);
  assert.equal(before[4]?.slice(0, 6), "..aa..");
});

test("the sweep is a six-beat cycle that returns to rest and never exceeds one pixel", () => {
  assert.equal(SWEEP.length, 6);
  assert.equal(SWEEP[0], 0);
  for (const step of SWEEP) assert.ok(step >= -1 && step <= 1, `${step}`);
  assert.equal(SWEEP.reduce((sum, step) => sum + step, 0), 0);
});

test("sweepAt wraps, forwards and backwards", () => {
  assert.equal(sweepAt(0), SWEEP[0]);
  assert.equal(sweepAt(SWEEP.length), SWEEP[0]);
  assert.equal(sweepAt(-1), SWEEP[SWEEP.length - 1]);
});

test("a blink lands once every eleven beats and never on the resting beat", () => {
  const beats = Array.from({ length: 22 }, (_, i) => blinksAt(i));
  assert.equal(beats.filter(Boolean).length, 2);
  assert.equal(blinksAt(7), true);
  assert.equal(blinksAt(0), false);
  assert.equal(blinksAt(-4), blinksAt(18), "a negative index wraps like a positive one");
});

test("shift throws when the rectangle leaves the map on the x axis", () => {
  const rows = blank();
  assert.throws(() => shift(rows, { x: 18, y: 0, w: 5, h: 1 }, 0), /outside the map/);
});

test("shift throws when the rectangle leaves the map on the y axis", () => {
  const rows = blank();
  assert.throws(() => shift(rows, { x: 0, y: 18, w: 1, h: 5 }, 0), /outside the map/);
});

test("a pixel at the rectangle's left edge is dropped when shifted by -1", () => {
  const rows = blank();
  rows[4] = "a".padEnd(SPRITE_WIDTH, ".");
  const moved = shift(rows, { x: 0, y: 4, w: 1, h: 1 }, -1);
  assert.equal(moved[4]?.slice(0, 1), ".");
});

test("BLINK_EVERY and SWEEP.length are coprime", () => {
  function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
  }
  assert.equal(gcd(BLINK_EVERY, SWEEP.length), 1, `gcd(${BLINK_EVERY}, ${SWEEP.length}) must be 1`);
});
