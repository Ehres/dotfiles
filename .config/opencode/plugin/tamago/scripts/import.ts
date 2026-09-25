// scripts/import.ts — run: node scripts/import.ts /path/to/duck.png [--patch <anchor>]
import { readFileSync } from "node:fs";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import { PALETTE_MAX } from "../core/appearance/palette.ts";
import { decodePng, type Image } from "./png.ts";

/** Alpha is a cut, not a blend: under 128 the pixel is transparent, at or above it takes its RGB. */
const OPAQUE = 128;

function colourAt(image: Image, i: number): string | undefined {
  if ((image.pixels[i * 4 + 3] ?? 0) < OPAQUE) return undefined;
  const hex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${hex(image.pixels[i * 4] ?? 0)}${hex(image.pixels[i * 4 + 1] ?? 0)}${hex(image.pixels[i * 4 + 2] ?? 0)}`;
}

/** The map and the Palette an image becomes: colours ordered by descending pixel count, ties by hex. */
export function toMap(image: Image, size: { width: number; height: number }): { pixels: string[]; palette: string[] } {
  if (image.width !== size.width || image.height !== size.height) {
    throw new Error(`the image is ${image.width} x ${image.height}, expected ${size.width} x ${size.height}`);
  }
  const counts = new Map<string, number>();
  for (let i = 0; i < image.width * image.height; i++) {
    const colour = colourAt(image, i);
    if (colour !== undefined) counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  if (counts.size > PALETTE_MAX) throw new Error(`the image holds ${counts.size} colours, the ceiling is ${PALETTE_MAX}`);
  const palette = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([colour]) => colour);
  const pixels: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = "";
    for (let x = 0; x < image.width; x++) {
      const colour = colourAt(image, y * image.width + x);
      row += colour === undefined ? "." : (MAP_ALPHABET[palette.indexOf(colour) + 1] ?? ".");
    }
    pixels.push(row);
  }
  return { pixels, palette };
}

function main(): void {
  const args = process.argv.slice(2);
  const path = args[0];
  if (path === undefined) {
    console.error("usage: node scripts/import.ts <path-to-png> [--patch <anchor>]");
    process.exit(1);
  }
  const patchAt = args.indexOf("--patch");
  const anchor = patchAt === -1 ? undefined : args[patchAt + 1];
  if (patchAt !== -1 && anchor === undefined) throw new Error("--patch requires an anchor name");

  const image = decodePng(Uint8Array.from(readFileSync(path)));
  const size = anchor === undefined ? { width: SPRITE_WIDTH, height: PIXEL_HEIGHT } : { width: image.width, height: image.height };
  const { pixels, palette } = toMap(image, size);

  if (anchor !== undefined) console.log(`// patch: ${anchor} (${image.width} x ${image.height})`);
  console.log(`palette: [${palette.map((colour) => `"${colour}"`).join(", ")}],`);
  console.log("pixels: [");
  for (const row of pixels) console.log(`  "${row}",`);
  console.log("],");
  console.log(`\n${palette.length} colour${palette.length === 1 ? "" : "s"}`);
  if (palette.length === PALETTE_MAX) console.warn(`warning: reached the ceiling of ${PALETTE_MAX} colours — the Species can hold no more`);
}

if (import.meta.main) main();
