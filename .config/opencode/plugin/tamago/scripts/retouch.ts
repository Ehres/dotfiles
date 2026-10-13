/**
 * Small hand edits to a drawn PNG before import.ts reads it: what a pixler draw needs when it lands
 * off-centre or one pixel wrong, without opening an image editor.
 *
 *   node scripts/retouch.ts frame <in.png> <out.png> [--bottom <row>]
 *   node scripts/retouch.ts patch <in.png> <out.png> "x,y=#rrggbb;x,y=clear;..."
 */
import { readFileSync, writeFileSync } from "node:fs";
import { PIXEL_HEIGHT, SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import { decodePng, encodePng, Refusal, type Image } from "./png.ts";

/** An alpha at or above this counts as drawn, as import.ts reads it. */
const OPAQUE = 128;

/**
 * The draw moved onto a transparent sprite canvas: centred on its drawn columns, its lowest drawn
 * row on `bottom` (the canvas' last row by default, where a Body stands). What falls outside is lost.
 */
export function frame(image: Image, bottom = PIXEL_HEIGHT - 1): Image {
  const { width, height, pixels } = image;
  let left = width;
  let right = -1;
  let low = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) >= OPAQUE) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        low = Math.max(low, y);
      }
  if (right < 0) throw new Refusal("nothing is drawn: every pixel is transparent");
  const dx = Math.floor((SPRITE_WIDTH - (right - left + 1)) / 2) - left;
  const dy = bottom - low;
  const canvas = new Uint8Array(SPRITE_WIDTH * PIXEL_HEIGHT * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= SPRITE_WIDTH || ty >= PIXEL_HEIGHT) continue;
      canvas.set(pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), (ty * SPRITE_WIDTH + tx) * 4);
    }
  return { width: SPRITE_WIDTH, height: PIXEL_HEIGHT, pixels: canvas };
}

/** `x,y=#rrggbb` paints one opaque pixel, `x,y=clear` erases it; edits are separated by `;`. */
export function patch(image: Image, edits: string): Image {
  const pixels = new Uint8Array(image.pixels);
  for (const edit of edits.split(";").map((part) => part.trim()).filter(Boolean)) {
    const match = /^(\d+),(\d+)=(clear|#[0-9a-fA-F]{6})$/.exec(edit);
    if (match === null) throw new Refusal(`"${edit}" is not an edit: write x,y=#rrggbb or x,y=clear`);
    const x = Number(match[1]);
    const y = Number(match[2]);
    const value = match[3] ?? "";
    if (x >= image.width || y >= image.height) throw new Refusal(`${x},${y} is outside the ${image.width} x ${image.height} image`);
    const at = (y * image.width + x) * 4;
    if (value === "clear") pixels.fill(0, at, at + 4);
    else pixels.set([1, 3, 5].map((o) => parseInt(value.slice(o, o + 2), 16)).concat(255), at);
  }
  return { ...image, pixels };
}

const USAGE = 'usage: node scripts/retouch.ts frame <in.png> <out.png> [--bottom <row>]\n       node scripts/retouch.ts patch <in.png> <out.png> "x,y=#rrggbb;x,y=clear;..."';

function main(): void {
  const [command, source, target, ...rest] = process.argv.slice(2);
  if (source === undefined || target === undefined) throw new Refusal(USAGE);
  const image = decodePng(new Uint8Array(readFileSync(source)));
  let result: Image;
  if (command === "frame") {
    const at = rest.indexOf("--bottom");
    const bottom = at < 0 ? undefined : Number(rest[at + 1]);
    if (bottom !== undefined && !(Number.isInteger(bottom) && bottom >= 0 && bottom < PIXEL_HEIGHT)) {
      throw new Refusal(`--bottom takes a row from 0 to ${PIXEL_HEIGHT - 1}`);
    }
    result = frame(image, bottom);
  } else if (command === "patch") {
    result = patch(image, rest.join(";"));
  } else throw new Refusal(USAGE);
  writeFileSync(target, encodePng(result));
  console.error(`${source} -> ${target}`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    if (error instanceof Refusal) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
