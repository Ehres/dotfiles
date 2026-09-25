import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBlocks, formatSummary, parseArgs, toMap } from "../import.ts";
import { Refusal } from "../png.ts";
import { PALETTE_MAX } from "../../core/appearance/palette.ts";

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

test("the colour-ceiling refusal is a Refusal, listing colours by descending count and what to do", () => {
  const rgba = (r: number, g: number, b: number): number[] => [r, g, b, 255];
  const pixels: number[] = [];
  for (let i = 0; i < 3; i++) pixels.push(...rgba(10, 10, 10)); // the most common colour, x3
  for (let i = 0; i < 2; i++) pixels.push(...rgba(20, 20, 20)); // the second, x2
  for (let n = 0; n < 15; n++) pixels.push(...rgba(30 + n, 30 + n, 30 + n)); // fifteen further colours, x1 each
  const width = pixels.length / 4;
  const image = { width, height: 1, pixels: Uint8Array.from(pixels) };

  assert.throws(() => toMap(image, { width, height: 1 }), Refusal);
  let message = "";
  try {
    toMap(image, { width, height: 1 });
  } catch (error) {
    message = error instanceof Error ? error.message : "";
  }
  assert.match(message, /17 colours/);
  assert.match(message, /ceiling is 16/);
  assert.match(message, /reduce the image to 16 colours or fewer/);
  const lines = message.split("\n");
  const mostCommon = lines.findIndex((line) => line.includes("#0a0a0a"));
  const second = lines.findIndex((line) => line.includes("#141414"));
  assert.ok(mostCommon !== -1 && (lines[mostCommon] ?? "").includes("x3"));
  assert.ok(second !== -1 && (lines[second] ?? "").includes("x2"));
  assert.ok(mostCommon < second, "the most common colour is listed before the second");
});

test("an image of the wrong size is refused, saying both sizes", () => {
  const one = { width: 1, height: 1, pixels: Uint8Array.from([0, 0, 0, 255]) };
  assert.throws(() => toMap(one, { width: 32, height: 32 }), /1 x 1.*32 x 32/);
  assert.throws(() => toMap(one, { width: 32, height: 32 }), Refusal);
});

test("formatBlocks prints the palette and pixels exactly as pasted into a Species file", () => {
  const text = formatBlocks({ palette: ["#ff0000", "#00ff00"], pixels: ["01", "10"] });
  assert.equal(text, ['palette: ["#ff0000", "#00ff00"],', "pixels: [", '  "01",', '  "10",', "],"].join("\n"));
});

test("formatSummary counts colours, in the singular at one, and warns only at the ceiling", () => {
  assert.deepEqual(formatSummary(1), { count: "1 colour", warning: undefined });
  assert.deepEqual(formatSummary(3), { count: "3 colours", warning: undefined });
  assert.deepEqual(formatSummary(PALETTE_MAX), {
    count: `${PALETTE_MAX} colours`,
    warning: `warning: reached the ceiling of ${PALETTE_MAX} colours — the Species can hold no more`,
  });
});

test("parseArgs finds --patch and its anchor wherever they land, and takes what's left as the path", () => {
  assert.deepEqual(parseArgs(["duck.png"]), { path: "duck.png", anchor: undefined });
  assert.deepEqual(parseArgs(["duck.png", "--patch", "eyes"]), { path: "duck.png", anchor: "eyes" });
  assert.deepEqual(parseArgs(["--patch", "eyes", "duck.png"]), { path: "duck.png", anchor: "eyes" });
  assert.deepEqual(parseArgs([]), { path: undefined, anchor: undefined });
});

test("parseArgs refuses --patch with no anchor name", () => {
  assert.throws(() => parseArgs(["duck.png", "--patch"]), /anchor name/);
});
