import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePng, encodePng, Refusal, type Image } from "../png.ts";
import { frame, patch } from "../retouch.ts";
import { drawMap, parseImport } from "../show-import.ts";

/** A transparent image with the listed pixels painted opaque red. */
function image(width: number, height: number, drawn: readonly (readonly [number, number])[]): Image {
  const pixels = new Uint8Array(width * height * 4);
  for (const [x, y] of drawn) pixels.set([255, 0, 0, 255], (y * width + x) * 4);
  return { width, height, pixels };
}

const opaque = (img: Image): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if ((img.pixels[(y * img.width + x) * 4 + 3] ?? 0) > 0) out.push([x, y]);
  return out;
};

test("encodePng round-trips through decodePng", () => {
  const original = image(5, 3, [[0, 0], [4, 2], [2, 1]]);
  original.pixels.set([10, 20, 30, 128], (1 * 5 + 3) * 4);
  const back = decodePng(encodePng(original));
  assert.equal(back.width, 5);
  assert.equal(back.height, 3);
  assert.deepEqual([...back.pixels], [...original.pixels]);
});

test("frame centres the drawn columns and stands the lowest drawn row on the last one", () => {
  const framed = frame(image(40, 40, [[2, 3], [5, 10]]));
  assert.equal(framed.width, 32);
  assert.equal(framed.height, 32);
  // 4 drawn columns (2..5) centre at 14..17; the lowest row (10) moves to 31.
  assert.deepEqual(opaque(framed), [[14, 24], [17, 31]]);
});

test("frame stands the draw on the row it is given", () => {
  assert.deepEqual(opaque(frame(image(32, 32, [[0, 0]]), 20)), [[15, 20]]);
});

test("frame refuses an image with nothing drawn", () => {
  assert.throws(() => frame(image(4, 4, [])), Refusal);
});

test("patch paints and clears single pixels without touching its input", () => {
  const before = image(4, 4, [[1, 1]]);
  const after = patch(before, "0,0=#00ff80; 1,1=clear");
  assert.deepEqual([...after.pixels.subarray(0, 4)], [0, 255, 128, 255]);
  assert.deepEqual(opaque(after), [[0, 0]]);
  assert.deepEqual(opaque(before), [[1, 1]]);
});

test("patch refuses a malformed edit and a pixel outside the image", () => {
  assert.throws(() => patch(image(4, 4, []), "1;1=#ffffff"), /is not an edit/);
  assert.throws(() => patch(image(4, 4, []), "4,0=clear"), /outside the 4 x 4 image/);
});

test("parseImport reads the palette and orders labelled maps by Stage", () => {
  const text = ['palette: ["#000000", "#ffffff"],', "// elder.png", "pixels: [", '  "01",', "],", "// hatchling.png", "pixels: [", '  "1.",', "],"].join("\n");
  const { palette, maps } = parseImport(text);
  assert.deepEqual(palette, ["#000000", "#ffffff"]);
  assert.deepEqual(maps.map(({ label, rows }) => [label, rows]), [["hatchling", ["1."]], ["elder", ["01"]]]);
});

test("parseImport refuses text with no palette", () => {
  assert.throws(() => parseImport("pixels: [\n],"), Refusal);
});

test("drawMap paints two pixels a character and leaves transparency blank", () => {
  const lines = drawMap(["#ff0000", "#0000ff"], ["0.", "1."]);
  assert.equal(lines.length, 16);
  assert.ok(lines[0]?.startsWith("\x1b[38;2;255;0;0m\x1b[48;2;0;0;255m▀\x1b[0m "));
  assert.equal(lines[1], " ".repeat(32));
});
