import { test } from "node:test";
import assert from "node:assert/strict";
import { PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH, pack } from "../pixels.ts";

/** A map of the right shape, filled with one role, for tests that only care about packing. */
function filled(char: string): string[] {
  return Array.from({ length: PIXEL_HEIGHT }, () => char.repeat(SPRITE_WIDTH));
}

test("the grid is 21 cells wide, 10 cells tall, 20 pixels tall", () => {
  assert.equal(SPRITE_WIDTH, 21);
  assert.equal(SPRITE_HEIGHT, 10);
  assert.equal(PIXEL_HEIGHT, 20);
});

test("pack turns 20 pixel rows into 10 cell rows of 21 cells", () => {
  const frame = pack(filled("a"));
  assert.equal(frame.length, SPRITE_HEIGHT);
  for (const row of frame) assert.equal(row.length, SPRITE_WIDTH);
});

test("a cell carries the pixel above it and the pixel below it", () => {
  const rows = filled(".");
  rows[0] = "o".padEnd(SPRITE_WIDTH, ".");
  rows[1] = "a".padEnd(SPRITE_WIDTH, ".");
  const frame = pack(rows);
  assert.deepEqual(frame[0]?.[0], { top: "outline", bottom: "primary" });
  assert.deepEqual(frame[0]?.[1], { top: null, bottom: null });
});

test("a dot is transparent on both halves", () => {
  const frame = pack(filled("."));
  for (const row of frame) for (const cell of row) assert.deepEqual(cell, { top: null, bottom: null });
});

test("every alphabet character maps to its Role", () => {
  const rows = filled(".");
  rows[0] = "oabc".padEnd(SPRITE_WIDTH, ".");
  const frame = pack(rows);
  assert.deepEqual(
    [frame[0]?.[0]?.top, frame[0]?.[1]?.top, frame[0]?.[2]?.top, frame[0]?.[3]?.top],
    ["outline", "primary", "secondary", "accent"],
  );
});

test("a character outside the alphabet throws, naming the row and column", () => {
  const rows = filled(".");
  rows[3] = ".".repeat(7) + "z" + ".".repeat(SPRITE_WIDTH - 8);
  assert.throws(() => pack(rows), /row 3, column 7/);
});

test("a map of the wrong height or width throws", () => {
  assert.throws(() => pack(filled("a").slice(0, 19)), /20 rows/);
  assert.throws(() => pack(filled("a").map((row) => row.slice(0, 20))), /21 characters/);
});
