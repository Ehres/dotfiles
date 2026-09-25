import { test } from "node:test";
import assert from "node:assert/strict";
import { PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH, pack, paint } from "../pixels.ts";

/** A map of the right shape, filled with one role, for tests that only care about packing. */
function filled(char: string): string[] {
  return Array.from({ length: PIXEL_HEIGHT }, () => char.repeat(SPRITE_WIDTH));
}

function blank(): string[] {
  return filled(".");
}

test("the grid is 32 cells wide, 16 cells tall, 32 pixels tall", () => {
  assert.equal(SPRITE_WIDTH, 32);
  assert.equal(SPRITE_HEIGHT, 16);
  assert.equal(PIXEL_HEIGHT, 32);
});

test("pack turns 32 pixel rows into 16 cell rows of 32 cells", () => {
  const frame = pack(filled("a"));
  assert.equal(frame.length, SPRITE_HEIGHT);
  for (const row of frame) assert.equal(row.length, SPRITE_WIDTH);
});

test("every alphabet character maps to its palette index", () => {
  const rows = filled(".");
  rows[0] = "0159af".padEnd(SPRITE_WIDTH, ".");
  const frame = pack(rows);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((i) => frame[0]?.[i]?.top),
    [0, 1, 5, 9, 10, 15],
  );
});

test("a cell carries the pixel above it and the pixel below it", () => {
  const rows = filled(".");
  rows[0] = "0".padEnd(SPRITE_WIDTH, ".");
  rows[1] = "1".padEnd(SPRITE_WIDTH, ".");
  const frame = pack(rows);
  assert.deepEqual(frame[0]?.[0], { top: 0, bottom: 1 });
  assert.deepEqual(frame[0]?.[1], { top: null, bottom: null });
});

test("paint writes an index as its own character, and an engine role as its letter", () => {
  const indexed = paint(blank(), { x: 2, y: 4, w: 1, h: 1 }, ["#"], 11);
  assert.equal(indexed[4]?.[2], "b");
  const painted = paint(blank(), { x: 2, y: 4, w: 1, h: 1 }, ["#"], "badge");
  assert.equal(painted[4]?.[2], "G");
  assert.equal(pack(painted)[2]?.[2]?.top, "badge");
});

test("a dot is transparent on both halves", () => {
  const frame = pack(filled("."));
  for (const row of frame) for (const cell of row) assert.deepEqual(cell, { top: null, bottom: null });
});

test("a character outside the alphabet throws, naming the row and column", () => {
  const rows = filled(".");
  rows[3] = ".".repeat(7) + "z" + ".".repeat(SPRITE_WIDTH - 8);
  assert.throws(() => pack(rows), /row 3, column 7/);
});

test("a map of the wrong height or width throws", () => {
  assert.throws(() => pack(filled("a").slice(0, 31)), /32 rows/);
  assert.throws(() => pack(filled("a").map((row) => row.slice(0, 31))), /32 characters/);
});

test("paint writes a pattern into a rectangle, '#' only", () => {
  const rows = paint(blank(), { x: 2, y: 4, w: 3, h: 3 }, [".#.", "###", ".#."], 0);
  assert.equal(rows[4]?.slice(2, 5), ".0.");
  assert.equal(rows[5]?.slice(2, 5), "000");
  assert.equal(rows[6]?.slice(2, 5), ".0.");
});

test("paint leaves everything outside the rectangle alone", () => {
  const rows = paint(blank(), { x: 2, y: 4, w: 3, h: 3 }, ["###", "###", "###"], 0);
  assert.equal(rows[3], ".".repeat(SPRITE_WIDTH));
  assert.equal(rows[7], ".".repeat(SPRITE_WIDTH));
  assert.equal(rows[4]?.[1], ".");
  assert.equal(rows[4]?.[5], ".");
});

test("a painted pixel packs to its Ink", () => {
  const frame = pack(paint(blank(), { x: 0, y: 0, w: 1, h: 1 }, ["#"], "badge"));
  assert.equal(frame[0]?.[0]?.top, "badge");
});

test("paint does not mutate the rows it is given", () => {
  const before = blank();
  paint(before, { x: 0, y: 0, w: 1, h: 1 }, ["#"], "mark");
  assert.equal(before[0], ".".repeat(SPRITE_WIDTH));
});

test("a pattern that does not fit its rectangle throws", () => {
  assert.throws(() => paint(blank(), { x: 0, y: 0, w: 2, h: 2 }, ["###", "###"], 0), /2 x 2/);
});

test("a rectangle that leaves the map throws", () => {
  assert.throws(() => paint(blank(), { x: 30, y: 0, w: 3, h: 1 }, ["###"], 0), /outside the map/);
  assert.throws(() => paint(blank(), { x: 0, y: 30, w: 1, h: 3 }, ["#", "#", "#"], 0), /outside the map/);
});
