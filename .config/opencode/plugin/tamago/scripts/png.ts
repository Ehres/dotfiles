import { inflateSync } from "node:zlib";

export type Image = { width: number; height: number; pixels: Uint8Array };

/**
 * A file or argument this tool intentionally does not read — the wrong size,
 * too many colours, a PNG feature this decoder does not cover — as opposed to
 * a bug in the tool itself. The CLI entry point in import.ts prints a
 * Refusal's message alone; anything else keeps its stack, because that one
 * was not supposed to happen.
 */
export class Refusal extends Error {}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function u32(bytes: Uint8Array, at: number): number {
  return (((bytes[at] ?? 0) << 24) | ((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * The PNG a pixel editor writes, and no more: 8 bits a channel, no interlace,
 * colour types 2 (RGB), 3 (palette) and 6 (RGBA). Written by hand on node:zlib
 * because this project carries no runtime dependencies — and it lives in
 * scripts/, which the plugin never imports, so it is not one. Everything it
 * refuses, it refuses by name.
 */
export function decodePng(bytes: Uint8Array): Image {
  for (const [i, byte] of SIGNATURE.entries()) {
    if (bytes[i] !== byte) throw new Refusal("not a PNG: the signature does not match");
  }
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  let plte: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  // Chunks are collected as buffers, not spread into an array: a real sprite's IDAT can run to
  // tens of thousands of bytes, and Buffer.from(...idat) passes every byte as a call argument —
  // past a couple hundred, that alone blows the call stack before any real work starts.
  const idatChunks: Uint8Array[] = [];
  while (at + 8 <= bytes.length) {
    const length = u32(bytes, at);
    const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
    const body = bytes.slice(at + 8, at + 8 + length);
    at += 12 + length;
    if (type === "IHDR") {
      width = u32(body, 0);
      height = u32(body, 4);
      depth = body[8] ?? 0;
      colour = body[9] ?? 0;
      interlace = body[12] ?? 0;
    } else if (type === "PLTE") plte = body;
    else if (type === "tRNS") trns = body;
    else if (type === "IDAT") idatChunks.push(body);
    else if (type === "IEND") break;
  }
  if (depth !== 8) throw new Refusal(`this decoder reads 8 bits a channel, this PNG has ${depth}`);
  if (interlace !== 0) throw new Refusal("this decoder does not read interlaced PNGs");
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : colour === 3 ? 1 : 0;
  if (channels === 0) throw new Refusal(`this decoder reads colour types 2, 3 and 6, this PNG is type ${colour}`);
  if (colour === 3 && plte === undefined) throw new Refusal("a palette PNG (colour type 3) with no PLTE chunk");
  const raw = new Uint8Array(inflateSync(Buffer.concat(idatChunks)));
  const stride = width * channels;
  const expected = height * (stride + 1);
  if (raw.length < expected) {
    throw new Refusal(`the image data decompresses to ${raw.length} bytes, a ${width} x ${height} image of this kind needs ${expected}`);
  }
  const lines = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    if (filter > 4) throw new Refusal(`unknown PNG filter ${filter} on row ${y}`);
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] ?? 0;
      const a = i >= channels ? (lines[y * stride + i - channels] ?? 0) : 0;
      const b = y > 0 ? (lines[(y - 1) * stride + i] ?? 0) : 0;
      const c = i >= channels && y > 0 ? (lines[(y - 1) * stride + i - channels] ?? 0) : 0;
      const value =
        filter === 1 ? x + a : filter === 2 ? x + b : filter === 3 ? x + ((a + b) >> 1) : filter === 4 ? x + paeth(a, b, c) : x;
      lines[y * stride + i] = value & 255;
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (colour === 6) pixels.set(lines.slice(i * 4, i * 4 + 4), i * 4);
    else if (colour === 2) pixels.set([...lines.slice(i * 3, i * 3 + 3), 255], i * 4);
    else {
      const index = lines[i] ?? 0;
      const paletteSize = plte === undefined ? 0 : Math.floor(plte.length / 3);
      if (index >= paletteSize) throw new Refusal(`palette index ${index} has no entry in a ${paletteSize}-entry PLTE`);
      const rgb = plte === undefined ? [] : [...plte.slice(index * 3, index * 3 + 3)];
      pixels.set([rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, trns?.[index] ?? 255], i * 4);
    }
  }
  return { width, height, pixels };
}
