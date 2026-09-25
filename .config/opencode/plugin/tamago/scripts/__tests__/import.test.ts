import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBlocks, formatDrift, formatSummary, parseArgs, parsePalette, readPng, toMap, type Bound } from "../import.ts";
import { Refusal, type Image } from "../png.ts";
import { PALETTE_MAX } from "../../core/appearance/palette.ts";
import { PIXEL_HEIGHT, SPRITE_WIDTH } from "../../core/appearance/pixels.ts";

/** A whole map is the canvas exactly; a Patch is bounded by it. Written out so no test spells `fit` by hand. */
function exactly(width: number, height: number): Bound {
  return { width, height, fit: "exactly" };
}

function atMost(width: number, height: number): Bound {
  return { width, height, fit: "at most" };
}

/** One row of pixels from hex colours; undefined is transparent. */
function strip(colours: readonly (string | undefined)[]): Image {
  const bytes: number[] = [];
  for (const colour of colours) {
    if (colour === undefined) bytes.push(0, 0, 0, 0);
    else bytes.push(parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16), 255);
  }
  return { width: colours.length, height: 1, pixels: Uint8Array.from(bytes) };
}

const GIVEN = ["#ff0000", "#00ff00", "#0000ff"];

test("a two-colour image becomes two palette entries and a map of their indices", () => {
  const image = { width: 2, height: 2, pixels: Uint8Array.from([255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]) };
  const { pixels, palette } = toMap(image, exactly(2, 2));
  assert.deepEqual(palette, ["#ff0000", "#0000ff"]); // by descending pixel count
  assert.deepEqual(pixels, ["00", "1."]);
});

test("a fully transparent pixel is a dot, never a colour", () => {
  const image = { width: 1, height: 1, pixels: Uint8Array.from([18, 52, 86, 0]) };
  assert.deepEqual(toMap(image, exactly(1, 1)).pixels, ["."]);
});

test("more than sixteen colours is refused, saying how many", () => {
  const many = Uint8Array.from(Array.from({ length: 17 * 4 }, (_, i) => (i % 4 === 3 ? 255 : i)));
  assert.throws(() => toMap({ width: 17, height: 1, pixels: many }, exactly(17, 1)), /17 colours/);
});

test("the colour-ceiling refusal is a Refusal, listing colours by descending count and what to do", () => {
  const rgba = (r: number, g: number, b: number): number[] => [r, g, b, 255];
  const pixels: number[] = [];
  for (let i = 0; i < 3; i++) pixels.push(...rgba(10, 10, 10)); // the most common colour, x3
  for (let i = 0; i < 2; i++) pixels.push(...rgba(20, 20, 20)); // the second, x2
  for (let n = 0; n < 15; n++) pixels.push(...rgba(30 + n, 30 + n, 30 + n)); // fifteen further colours, x1 each
  const width = pixels.length / 4;
  const image = { width, height: 1, pixels: Uint8Array.from(pixels) };

  assert.throws(() => toMap(image, exactly(width, 1)), Refusal);
  let message = "";
  try {
    toMap(image, exactly(width, 1));
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
  assert.throws(() => toMap(one, exactly(32, 32)), /1 x 1.*exactly 32 x 32/);
  assert.throws(() => toMap(one, exactly(32, 32)), Refusal);
});

// A Patch has no fixed size — it is pinned to an anchor, and how far it reaches depends on where
// that anchor sits, which this tool cannot know — but nothing wider or taller than the canvas fits
// under any anchor at all, so the canvas is its ceiling. Measuring a Patch against its own
// dimensions, as the tool used to, is a check that cannot fail: `stamp()` then clips it at render,
// in silence.
test("a patch is bounded by the canvas, in both dimensions, and anything smaller is taken", () => {
  const pixel = (width: number, height: number): Image => ({
    width,
    height,
    pixels: Uint8Array.from(Array.from({ length: width * height * 4 }, (_, i) => (i % 4 === 3 ? 255 : 1))),
  });
  const bound = atMost(SPRITE_WIDTH, PIXEL_HEIGHT);
  assert.throws(() => toMap(pixel(SPRITE_WIDTH + 1, 4), bound), /33 x 4.*at most 32 x 32/);
  assert.throws(() => toMap(pixel(4, PIXEL_HEIGHT + 1), bound), /4 x 33.*at most 32 x 32/);
  assert.throws(() => toMap(pixel(SPRITE_WIDTH + 1, 4), bound), Refusal);
  assert.equal(toMap(pixel(3, 2), bound).pixels.length, 2);
  assert.equal(toMap(pixel(SPRITE_WIDTH, PIXEL_HEIGHT), bound).pixels.length, PIXEL_HEIGHT, "the canvas itself is a legal patch");
});

// The reason the flag exists: a Species has one Palette and four Bodies, and ordering each image by
// its own pixel counts means every Body after the first has to be re-indexed by hand, on a 32 x 32
// grid of single characters, by eye. Twenty Species is sixty of those.
test("a given palette keeps its own order, whatever the image's pixel counts say", () => {
  // #0000ff is the only colour here and would lead a fresh ordering; given the palette, it stays 2.
  const { pixels, palette, added } = toMap(strip(["#0000ff", "#0000ff", undefined]), exactly(3, 1), GIVEN);
  assert.deepEqual(palette, GIVEN, "a palette the image only partly uses is kept whole, so no index shifts");
  assert.deepEqual(pixels, ["22."]);
  assert.deepEqual(added, []);
});

test("a colour the given palette does not hold is appended after it, and named with its count", () => {
  const { pixels, palette, added } = toMap(strip(["#ff0000", "#123456", "#123456"]), exactly(3, 1), GIVEN);
  assert.deepEqual(palette, [...GIVEN, "#123456"], "appended, never inserted: an insert would shift every index after it");
  assert.deepEqual(pixels, ["033"]);
  assert.deepEqual(added, [{ colour: "#123456", count: 2 }]);
  assert.equal(
    formatDrift(added),
    ["warning: 1 colour of this image is not in the palette you gave, appended after it:", "  #123456 x2"].join("\n"),
  );
});

test("an image sharing no colour with the given palette keeps the palette and appends all of its own", () => {
  const { pixels, palette, added } = toMap(strip(["#222222", "#111111", "#111111"]), exactly(3, 1), GIVEN);
  assert.deepEqual(palette, [...GIVEN, "#111111", "#222222"], "the appended ones rank by count, ties by hex");
  assert.deepEqual(pixels, ["433"]);
  assert.deepEqual(added, [
    { colour: "#111111", count: 2 },
    { colour: "#222222", count: 1 },
  ]);
  assert.equal(formatDrift(added)?.startsWith("warning: 2 colours of this image are not in the palette you gave"), true);
});

test("a given palette plus the image's own drift is refused past sixteen, naming what drifted", () => {
  const full = Array.from({ length: 15 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`);
  const image = strip(["#aaaaaa", "#bbbbbb", "#bbbbbb"]);
  assert.throws(() => toMap(image, exactly(3, 1), full), Refusal);
  assert.throws(() => toMap(image, exactly(3, 1), full), /holds 15 colours and the image wears 2 more, past the ceiling of 16/);
  assert.throws(() => toMap(image, exactly(3, 1), full), /#bbbbbb x2/);
  // Sixteen exactly is not past it: one more colour, already held, still fits.
  assert.equal(toMap(strip([full[0]]), exactly(1, 1), [...full, "#aaaaaa"]).palette.length, PALETTE_MAX);
});

test("formatDrift says nothing when nothing drifted", () => {
  assert.equal(formatDrift([]), undefined);
});

test("parsePalette reads a Species' palette line, and refuses anything that would shift an index", () => {
  assert.deepEqual(parsePalette("#FF0000, #00ff00 ,#0000ff"), ["#ff0000", "#00ff00", "#0000ff"]);
  assert.throws(() => parsePalette("#ff0000,fff"), /"fff" is not a #rrggbb colour/);
  assert.throws(() => parsePalette("#ff0000,#ff0000"), /twice/);
  assert.throws(() => parsePalette(""), /at least one/);
  assert.throws(() => parsePalette(Array.from({ length: 17 }, (_, i) => `#0000${i.toString(16).padStart(2, "0")}`).join(",")), /17 colours/);
  for (const text of ["#ff0000,fff", "#ff0000,#ff0000", "", "#12345"]) assert.throws(() => parsePalette(text), Refusal);
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
  assert.deepEqual(parseArgs(["duck.png"]), { path: "duck.png", anchor: undefined, palette: undefined });
  assert.deepEqual(parseArgs(["duck.png", "--patch", "eyes"]), { path: "duck.png", anchor: "eyes", palette: undefined });
  assert.deepEqual(parseArgs(["--patch", "eyes", "duck.png"]), { path: "duck.png", anchor: "eyes", palette: undefined });
  assert.deepEqual(parseArgs([]), { path: undefined, anchor: undefined, palette: undefined });
});

test("parseArgs finds --palette wherever it lands, beside --patch or alone", () => {
  assert.deepEqual(parseArgs(["duck.png", "--palette", "#ff0000,#00ff00"]), {
    path: "duck.png",
    anchor: undefined,
    palette: ["#ff0000", "#00ff00"],
  });
  assert.deepEqual(parseArgs(["--palette", "#ff0000", "--patch", "eyes", "duck.png"]), {
    path: "duck.png",
    anchor: "eyes",
    palette: ["#ff0000"],
  });
  assert.deepEqual(parseArgs(["--patch", "eyes", "--palette", "#ff0000", "duck.png"]), {
    path: "duck.png",
    anchor: "eyes",
    palette: ["#ff0000"],
  });
});

test("parseArgs refuses a flag with no value, including a flag standing where the value should be", () => {
  assert.throws(() => parseArgs(["duck.png", "--patch"]), /anchor name/);
  assert.throws(() => parseArgs(["duck.png", "--palette"]), /#rrggbb colours/);
  // Without this, --patch would take "--palette" as the anchor name and the palette would be lost.
  assert.throws(() => parseArgs(["duck.png", "--patch", "--palette", "#ff0000"]), /anchor name/);
  assert.throws(() => parseArgs(["duck.png", "--patch"]), Refusal);
});

test("readPng refuses a missing file by name, naming the path, not a stack dump", () => {
  const path = "/nonexistent/does-not-exist.png";
  assert.throws(() => readPng(path), Refusal);
  assert.throws(() => readPng(path), /does-not-exist\.png/);
});
