import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { decodePng } from "../png.ts";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): number[] {
  const bytes = [...Buffer.from(type), ...body];
  const length = [(body.length >>> 24) & 255, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255];
  const crc = crc32(Uint8Array.from(bytes));
  return [...length, ...bytes, (crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
}

/** A minimal 8-bit RGBA PNG, no interlace, one IDAT, filter 0 on every row. */
function png(width: number, height: number, rgba: (x: number, y: number) => readonly [number, number, number, number]): Uint8Array {
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) raw.push(...rgba(x, y));
  }
  const ihdr = Uint8Array.from([
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
    8, 6, 0, 0, 0,
  ]);
  return Uint8Array.from([
    ...SIGNATURE,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", Uint8Array.from(deflateSync(Buffer.from(raw)))),
    ...chunk("IEND", Uint8Array.from([])),
  ]);
}

/**
 * A PNG built chunk by chunk, for cases the happy-path `png()` builder above
 * cannot reach: another colour type, another filter, a malformed header. Raw
 * scanlines are passed pre-filtered (filter byte then channel bytes, per
 * row) so a test can exercise the decoder's own defiltering, not just an
 * unfiltered round trip.
 */
function buildPng(opts: {
  width: number;
  height: number;
  colourType: number;
  depth?: number;
  interlace?: number;
  raw?: number[];
  plte?: number[];
  trns?: number[];
}): Uint8Array {
  const { width, height, colourType, depth = 8, interlace = 0, raw, plte, trns } = opts;
  const ihdr = Uint8Array.from([
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
    depth, colourType, 0, 0, interlace,
  ]);
  const bytes = [...SIGNATURE, ...chunk("IHDR", ihdr)];
  if (plte !== undefined) bytes.push(...chunk("PLTE", Uint8Array.from(plte)));
  if (trns !== undefined) bytes.push(...chunk("tRNS", Uint8Array.from(trns)));
  if (raw !== undefined) bytes.push(...chunk("IDAT", Uint8Array.from(deflateSync(Buffer.from(raw)))));
  bytes.push(...chunk("IEND", Uint8Array.from([])));
  return Uint8Array.from(bytes);
}

test("decodes an 8-bit RGBA PNG to four bytes a pixel", () => {
  const image = decodePng(png(2, 2, (x, y) => (x === y ? [255, 0, 0, 255] : [0, 0, 0, 0])));
  assert.equal(image.width, 2);
  assert.equal(image.height, 2);
  assert.deepEqual([...image.pixels.slice(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...image.pixels.slice(4, 8)], [0, 0, 0, 0]);
});

test("a file that is not a PNG is refused by name", () => {
  assert.throws(() => decodePng(Uint8Array.from([1, 2, 3, 4])), /not a PNG/);
});

test("decodes an 8-bit RGB PNG (colour type 2), filling in a full alpha and defiltering Sub", () => {
  // Pixel 0 = (10,20,30), pixel 1 = (15,25,35). Sub filter: byte i predicts from byte i-3 in
  // the same row, 0 for the first pixel — so the encoded row is [10,20,30] then a flat [5,5,5].
  const bytes = buildPng({ width: 2, height: 1, colourType: 2, raw: [1, 10, 20, 30, 5, 5, 5] });
  const image = decodePng(bytes);
  assert.equal(image.width, 2);
  assert.equal(image.height, 1);
  assert.deepEqual([...image.pixels], [10, 20, 30, 255, 15, 25, 35, 255]);
});

test("decodes an 8-bit palette PNG (colour type 3), reading colour from PLTE and alpha from tRNS", () => {
  const bytes = buildPng({
    width: 2,
    height: 1,
    colourType: 3,
    raw: [0, 0, 1],
    plte: [200, 100, 50, 10, 20, 30],
    trns: [128, 255],
  });
  const image = decodePng(bytes);
  assert.deepEqual([...image.pixels], [200, 100, 50, 128, 10, 20, 30, 255]);
});

test("defilters Paeth against real, unequal neighbours on more than one row", () => {
  // Row 0 (filter None): pixel (10,20,30,40) then (50,60,70,80).
  // Row 1 (filter Paeth): every byte's a/b/c predictor lands on `b` (the byte above), so a flat
  // +5 offset reconstructs to (15,25,35,45) then (55,65,75,85) — exercising the branch with a, b
  // and c all distinct and non-zero, not the degenerate all-zero corner case.
  const raw = [0, 10, 20, 30, 40, 50, 60, 70, 80, 4, 5, 5, 5, 5, 5, 5, 5, 5];
  const image = decodePng(buildPng({ width: 2, height: 2, colourType: 6, raw }));
  assert.deepEqual([...image.pixels.slice(0, 4)], [10, 20, 30, 40]);
  assert.deepEqual([...image.pixels.slice(4, 8)], [50, 60, 70, 80]);
  assert.deepEqual([...image.pixels.slice(8, 12)], [15, 25, 35, 45]);
  assert.deepEqual([...image.pixels.slice(12, 16)], [55, 65, 75, 85]);
});

test("a bit depth other than 8 is refused by name", () => {
  assert.throws(() => decodePng(buildPng({ width: 1, height: 1, colourType: 6, depth: 16 })), /has 16/);
});

test("an interlaced PNG is refused by name", () => {
  assert.throws(() => decodePng(buildPng({ width: 1, height: 1, colourType: 6, interlace: 1 })), /interlaced/);
});

test("a colour type other than 2, 3 or 6 is refused by name", () => {
  assert.throws(() => decodePng(buildPng({ width: 1, height: 1, colourType: 0 })), /type 0/);
});

test("a palette PNG with no PLTE chunk is refused by name", () => {
  assert.throws(() => decodePng(buildPng({ width: 1, height: 1, colourType: 3 })), /PLTE/);
});

test("an unrecognised filter byte is refused by name, with the row", () => {
  const bytes = buildPng({ width: 1, height: 1, colourType: 6, raw: [5, 0, 0, 0, 0] });
  assert.throws(() => decodePng(bytes), /filter 5/);
});

test("defilters Up: every byte predicts from the byte directly above, never the one beside it", () => {
  // Row 0 (filter None): pixel (10,20,30,40) then (50,60,70,80).
  // Row 1 (filter Up): a flat +2 on the first pixel's channels and +5 on the second's reconstructs
  // to (12,22,32,42) then (55,65,75,85) — a and c play no part, so a bug that folded Up into Sub or
  // Average would still pass the Paeth and Sub tests above but fail here.
  const raw = [0, 10, 20, 30, 40, 50, 60, 70, 80, 2, 2, 2, 2, 2, 5, 5, 5, 5];
  const image = decodePng(buildPng({ width: 2, height: 2, colourType: 6, raw }));
  assert.deepEqual([...image.pixels.slice(8, 12)], [12, 22, 32, 42]);
  assert.deepEqual([...image.pixels.slice(12, 16)], [55, 65, 75, 85]);
});

test("defilters Average: the floor of the left and above neighbours, not either alone", () => {
  // Colour type 2 (RGB, 3 channels). Row 0 (filter None): pixel (10,20,30) then (50,60,70).
  // Row 1 (filter Average): the first pixel has no left neighbour, so its predictor is above/2 —
  // (10,20,30)/2 floored to (5,10,15) — reconstructing (14,24,34) from filtered (9,14,19). The
  // second pixel's predictor mixes its own left neighbour with the byte above it: floor((14+50)/2)
  // = 32, floor((24+60)/2) = 42, floor((34+70)/2) = 52, reconstructing (40,50,60) from (8,8,8).
  const raw = [0, 10, 20, 30, 50, 60, 70, 3, 9, 14, 19, 8, 8, 8];
  const image = decodePng(buildPng({ width: 2, height: 2, colourType: 2, raw }));
  assert.deepEqual([...image.pixels.slice(8, 12)], [14, 24, 34, 255]);
  assert.deepEqual([...image.pixels.slice(12, 16)], [40, 50, 60, 255]);
});

test("Paeth predicts the left neighbour when it, not the one above or the diagonal, is closest", () => {
  // Colour type 3 (palette, 1 channel a pixel) makes the neighbours line up with pixels directly:
  // a = the pixel to the left, b = above, c = above-left. paeth(a=0, b=3, c=6) picks `a` — verified
  // by search over the predictor's own formula, not asserted from the implementation under test.
  // Row 0 (filter None): indices 6, 3. Row 1 (filter Paeth): index 0 (from a flat-left predictor
  // of b=6, since a=c=0 at the row's own left edge), then a filtered byte of 9 lands on index 9
  // only if the predictor at that column really is `a` (0) — landing on 12 or 15 would mean the
  // decoder used `b` (3) or `c` (6) instead.
  const raw = [0, 6, 3, 4, 250, 9];
  const plte = Array.from({ length: 10 }, (_, n) => [n, n, n]).flat();
  const image = decodePng(buildPng({ width: 2, height: 2, colourType: 3, raw, plte }));
  assert.deepEqual([...image.pixels.slice(0, 4)], [6, 6, 6, 255]);
  assert.deepEqual([...image.pixels.slice(4, 8)], [3, 3, 3, 255]);
  assert.deepEqual([...image.pixels.slice(8, 12)], [0, 0, 0, 255]);
  assert.deepEqual([...image.pixels.slice(12, 16)], [9, 9, 9, 255]);
});

test("Paeth predicts the diagonal when it, not the one above or beside, is closest", () => {
  // paeth(a=0, b=10, c=5) picks `c` — again verified against the predictor's own formula. Row 0
  // (filter None): indices 5, 10. Row 1 (filter Paeth): index 0, then a filtered byte of 15 lands
  // on index 20 only if the predictor really is `c` (5) — landing on 25 or 15 would mean the
  // decoder used `b` (10) or `a` (0) instead.
  const raw = [0, 5, 10, 4, 251, 15];
  const plte = Array.from({ length: 21 }, (_, n) => [n, n, n]).flat();
  const image = decodePng(buildPng({ width: 2, height: 2, colourType: 3, raw, plte }));
  assert.deepEqual([...image.pixels.slice(0, 4)], [5, 5, 5, 255]);
  assert.deepEqual([...image.pixels.slice(4, 8)], [10, 10, 10, 255]);
  assert.deepEqual([...image.pixels.slice(8, 12)], [0, 0, 0, 255]);
  assert.deepEqual([...image.pixels.slice(12, 16)], [20, 20, 20, 255]);
});

test("a single IDAT chunk large enough for a real sprite does not overflow the call stack", () => {
  // Poorly-compressible pixel data (not a flat colour), sized like a genuine hand-drawn sprite: a
  // 160 x 160 image of this pattern decodes today, a 192 x 192 one overflows the stack when the
  // decoder spreads a chunk's bytes into a call — so this regression test sits comfortably past
  // that line rather than near it.
  const rgba = (x: number, y: number): readonly [number, number, number, number] => [(x * 7 + y * 13) % 256, (x * 3 + y * 5) % 256, (x * 11 + y) % 256, 255];
  const image = decodePng(png(256, 256, rgba));
  assert.equal(image.width, 256);
  assert.equal(image.height, 256);
  const [r, g, b, a] = rgba(200, 130);
  const at = (200 + 130 * 256) * 4;
  assert.deepEqual([...image.pixels.slice(at, at + 4)], [r, g, b, a]);
});

test("a decompressed row shorter than the header promises is refused by name, not zero-filled", () => {
  // A 2 x 2 RGBA image needs two 9-byte rows (18 bytes); this IDAT only supplies one.
  const bytes = buildPng({ width: 2, height: 2, colourType: 6, raw: [0, 10, 20, 30, 40, 50, 60, 70, 80] });
  assert.throws(() => decodePng(bytes), /9 bytes.*needs 18/);
});

test("a palette index past the end of PLTE is refused by name, not decoded as black", () => {
  const bytes = buildPng({ width: 1, height: 1, colourType: 3, raw: [0, 2], plte: [10, 20, 30] });
  assert.throws(() => decodePng(bytes), /index 2 has no entry in a 1-entry PLTE/);
});
