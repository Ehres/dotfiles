import { test } from "node:test";
import assert from "node:assert/strict";
import { toMap } from "../import.ts";

test("a two-colour image becomes two palette entries and a map of their indices", () => {
  const image = { width: 2, height: 2, pixels: Uint8Array.from([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]) };
  const { pixels, palette } = toMap(image, { width: 2, height: 2 });
  assert.deepEqual(palette, ["#ff0000", "#0000ff"]); // by descending pixel count
  assert.deepEqual(pixels, ["00", "1."]);
});

test("a fully transparent pixel is a dot, never a colour", () => {
  const image = { width: 1, height: 1, pixels: Uint8Array.from([18, 52, 86, 0]) };
  assert.deepEqual(toMap(image, { width: 1, height: 1 }).pixels, ["."]);
});

test("more than sixteen colours is refused, saying how many", () => {
  const many = Uint8Array.from(Array.from({ length: 17 * 4 }, (_, i) => (i % 4 === 3 ? 255 : i)));
  assert.throws(() => toMap({ width: 17, height: 1, pixels: many }, { width: 17, height: 1 }), /17 colours/);
});

test("an image of the wrong size is refused, saying both sizes", () => {
  const one = { width: 1, height: 1, pixels: Uint8Array.from([0, 0, 0, 255]) };
  assert.throws(() => toMap(one, { width: 32, height: 32 }), /1 x 1.*32 x 32/);
});
