import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MERGE_DISTANCE,
  checkSize,
  distance,
  formatBlocks,
  formatSummary,
  mapOnto,
  parseArgs,
  parsePalette,
  readPng,
  sharedPalette,
} from "../import.ts";
import { Refusal, type Image } from "../png.ts";
import { PALETTE_MAX } from "../../core/appearance/palette.ts";

/** One row of pixels from hex colours; undefined is transparent. */
function strip(colours: readonly (string | undefined)[]): Image {
  const bytes: number[] = [];
  for (const colour of colours) {
    if (colour === undefined) bytes.push(0, 0, 0, 0);
    else bytes.push(parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16), 255);
  }
  return { width: colours.length, height: 1, pixels: Uint8Array.from(bytes) };
}

/** `count` copies of `colour`. */
function times(colour: string, count: number): string[] {
  return Array.from({ length: count }, () => colour);
}

function hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

test("distance is Euclidean RGB", () => {
  assert.equal(distance("#000000", "#000000"), 0);
  assert.equal(distance("#000000", "#030400"), 5);
});

test("the shared palette orders colours by pixel count summed across every image", () => {
  const a = strip([...times("#ff0000", 2), "#0000ff"]);
  const b = strip(times("#0000ff", 3));
  assert.deepEqual(sharedPalette([a, b]), ["#0000ff", "#ff0000"]);
});

test("near-identical colours merge into the most used one, distinct ones stay apart", () => {
  const drifted = strip([...times("#808080", 5), ...times("#848080", 2), "#80ff80"]);
  assert.deepEqual(sharedPalette([drifted]), ["#808080", "#80ff80"]);
});

test("the merge distance is the line: just inside merges, just outside does not", () => {
  const inside = `#${hex(0x80 + MERGE_DISTANCE)}8080`;
  const outside = `#${hex(0x80 + MERGE_DISTANCE + 1)}8080`;
  assert.deepEqual(sharedPalette([strip([...times("#808080", 2), inside])]), ["#808080"]);
  assert.deepEqual(sharedPalette([strip([...times("#808080", 2), outside])]), ["#808080", outside]);
});

test("more distinct colours than the ceiling keeps the most used", () => {
  // Twenty colours on a grid 60 apart, well past the merge distance, each used once more than the next.
  const colours: string[] = [];
  for (let n = 0; n < 20; n++) colours.push(...times(`#${hex((n % 5) * 60)}${hex(Math.floor(n / 5) * 60)}00`, 20 - n));
  const palette = sharedPalette([strip(colours)]);
  assert.equal(palette.length, PALETTE_MAX);
  assert.equal(palette[0], "#000000");
  assert.ok(!palette.includes(`#${hex(4 * 60)}${hex(3 * 60)}00`), "the least used colour is the one dropped");
});

test("a map takes the nearest palette colour for every opaque pixel, and a dot for a transparent one", () => {
  const { pixels, correction } = mapOnto(strip(["#ff0000", "#0000f0", undefined]), ["#ff0000", "#0000ff"]);
  assert.deepEqual(pixels, ["01."]);
  assert.equal(correction, 15);
});

test("two images mapped onto one shared palette use the same index for the same colour", () => {
  const adult = strip([...times("#808080", 3), "#ff0000"]);
  const young = strip(["#ff0000", "#828282"]);
  const palette = sharedPalette([adult, young]);
  assert.deepEqual(mapOnto(adult, palette).pixels, ["0001"]);
  assert.deepEqual(mapOnto(young, palette).pixels, ["10"]);
});

test("a whole map is the canvas exactly, a patch is at most the canvas", () => {
  assert.doesNotThrow(() => checkSize(strip(times("#000000", 4)), { width: 4, height: 1, fit: "exactly" }));
  assert.throws(() => checkSize(strip(times("#000000", 3)), { width: 4, height: 1, fit: "exactly" }), /3 x 1, expected exactly 4 x 1/);
  assert.doesNotThrow(() => checkSize(strip(times("#000000", 3)), { width: 4, height: 1, fit: "at most" }));
  assert.throws(() => checkSize(strip(times("#000000", 5)), { width: 4, height: 1, fit: "at most" }), Refusal);
});

test("formatBlocks prints the palette once, then each map, labelled only when a label is given", () => {
  assert.equal(
    formatBlocks(["#ff0000", "#00ff00"], [{ label: undefined, pixels: ["01"] }]),
    ['palette: ["#ff0000", "#00ff00"],', "pixels: [", '  "01",', "],"].join("\n"),
  );
  assert.equal(
    formatBlocks(["#ff0000"], [
      { label: "adult.png", pixels: ["0"] },
      { label: "young.png", pixels: ["."] },
    ]),
    ['palette: ["#ff0000"],', "// adult.png", "pixels: [", '  "0",', "],", "// young.png", "pixels: [", '  ".",', "],"].join("\n"),
  );
});

test("formatSummary says how many colours went in, how many came out, and the largest correction", () => {
  assert.equal(formatSummary(40, 12, 31.24), "40 colours in, 12 colours in the palette, largest correction 31.2");
  assert.equal(formatSummary(1, 1, 0), "1 colour in, 1 colour in the palette, largest correction 0.0");
});

test("parsePalette reads a Species' palette line, and refuses anything that would shift an index", () => {
  assert.deepEqual(parsePalette("#FF0000, #00ff00 ,#0000ff"), ["#ff0000", "#00ff00", "#0000ff"]);
  assert.throws(() => parsePalette("#ff0000,fff"), /"fff" is not a #rrggbb colour/);
  assert.throws(() => parsePalette("#ff0000,#ff0000"), /twice/);
  assert.throws(() => parsePalette(""), /at least one/);
  assert.throws(() => parsePalette(Array.from({ length: 17 }, (_, i) => `#0000${hex(i)}`).join(",")), /17 colours/);
  for (const text of ["#ff0000,fff", "#ff0000,#ff0000", "", "#12345"]) assert.throws(() => parsePalette(text), Refusal);
});

test("parseArgs takes every non-flag argument as an image path, flags anywhere", () => {
  assert.deepEqual(parseArgs(["a.png", "b.png"]), { paths: ["a.png", "b.png"], anchor: undefined, palette: undefined });
  assert.deepEqual(parseArgs(["--patch", "eyes", "eye.png"]), { paths: ["eye.png"], anchor: "eyes", palette: undefined });
  assert.deepEqual(parseArgs(["elder.png", "--palette", "#ff0000,#00ff00"]), {
    paths: ["elder.png"],
    anchor: undefined,
    palette: ["#ff0000", "#00ff00"],
  });
  assert.deepEqual(parseArgs([]), { paths: [], anchor: undefined, palette: undefined });
});

test("parseArgs refuses a flag with no value, including a flag standing where the value should be", () => {
  assert.throws(() => parseArgs(["duck.png", "--patch"]), /anchor name/);
  assert.throws(() => parseArgs(["duck.png", "--palette"]), /#rrggbb colours/);
  assert.throws(() => parseArgs(["duck.png", "--patch", "--palette", "#ff0000"]), /anchor name/);
  assert.throws(() => parseArgs(["duck.png", "--patch"]), Refusal);
});

test("readPng refuses a missing file by name, naming the path, not a stack dump", () => {
  const path = "/nonexistent/does-not-exist.png";
  assert.throws(() => readPng(path), Refusal);
  assert.throws(() => readPng(path), /does-not-exist\.png/);
});
