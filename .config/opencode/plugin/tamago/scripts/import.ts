// scripts/import.ts — run: node scripts/import.ts /path/to/duck.png [--patch <anchor>]
import { readFileSync } from "node:fs";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import { PALETTE_MAX } from "../core/appearance/palette.ts";
import { decodePng, Refusal, type Image } from "./png.ts";

/** Alpha is a cut, not a blend: under 128 the pixel is transparent, at or above it takes its RGB. */
const OPAQUE = 128;

function colourAt(image: Image, i: number): string | undefined {
  if ((image.pixels[i * 4 + 3] ?? 0) < OPAQUE) return undefined;
  const hex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${hex(image.pixels[i * 4] ?? 0)}${hex(image.pixels[i * 4 + 1] ?? 0)}${hex(image.pixels[i * 4 + 2] ?? 0)}`;
}

/**
 * Ranks colours by descending pixel count (ties by hex) and writes the
 * ceiling refusal's body: which colours are there, how many pixels each
 * holds, and what to do about it. Printed, not thrown blind, because a
 * person staring at "32 colours" over a hand-drawn image has no way to tell
 * a real 32-colour drawing from sixteen colours each anti-aliased into two —
 * the counts make that visible at a glance.
 */
function ceilingMessage(counts: Map<string, number>): string {
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const lines = ranked.map(([colour, count]) => `  ${colour} x${count}`);
  return [
    `the image holds ${counts.size} colours, the ceiling is ${PALETTE_MAX}:`,
    ...lines,
    `reduce the image to ${PALETTE_MAX} colours or fewer in the editor — for instance, export with an indexed palette.`,
  ].join("\n");
}

/** The map and the Palette an image becomes: colours ordered by descending pixel count, ties by hex. */
export function toMap(image: Image, size: { width: number; height: number }): { pixels: string[]; palette: string[] } {
  if (image.width !== size.width || image.height !== size.height) {
    throw new Refusal(`the image is ${image.width} x ${image.height}, expected ${size.width} x ${size.height}`);
  }
  const counts = new Map<string, number>();
  for (let i = 0; i < image.width * image.height; i++) {
    const colour = colourAt(image, i);
    if (colour !== undefined) counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  if (counts.size > PALETTE_MAX) throw new Refusal(ceilingMessage(counts));
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

/** The two blocks exactly as pasted into a Species file. The only thing this tool writes to stdout, so piping it (to `pbcopy`, say) carries nothing else. */
export function formatBlocks(map: { pixels: string[]; palette: string[] }): string {
  const paletteLine = `palette: [${map.palette.map((colour) => `"${colour}"`).join(", ")}],`;
  const pixelLines = map.pixels.map((row) => `  "${row}",`);
  return [paletteLine, "pixels: [", ...pixelLines, "],"].join("\n");
}

/** The colour count, and a warning once the ceiling is reached. Reported, never pasted, so it belongs on stderr, not folded into formatBlocks. */
export function formatSummary(colours: number): { count: string; warning: string | undefined } {
  const count = `${colours} colour${colours === 1 ? "" : "s"}`;
  const warning =
    colours === PALETTE_MAX ? `warning: reached the ceiling of ${PALETTE_MAX} colours — the Species can hold no more` : undefined;
  return { count, warning };
}

/** `--patch <anchor>` may land anywhere in argv; whatever is left is the path. */
export function parseArgs(argv: readonly string[]): { path: string | undefined; anchor: string | undefined } {
  const patchAt = argv.indexOf("--patch");
  if (patchAt === -1) return { path: argv[0], anchor: undefined };
  const anchor = argv[patchAt + 1];
  if (anchor === undefined) throw new Refusal("--patch requires an anchor name");
  const rest = argv.filter((_, i) => i !== patchAt && i !== patchAt + 1);
  return { path: rest[0], anchor };
}

function main(): void {
  const { path, anchor } = parseArgs(process.argv.slice(2));
  if (path === undefined) {
    console.error("usage: node scripts/import.ts <path-to-png> [--patch <anchor>]");
    process.exit(1);
  }

  const image = decodePng(Uint8Array.from(readFileSync(path)));
  const size = anchor === undefined ? { width: SPRITE_WIDTH, height: PIXEL_HEIGHT } : { width: image.width, height: image.height };
  const map = toMap(image, size);

  if (anchor !== undefined) console.log(`// patch: ${anchor} (${image.width} x ${image.height})`);
  console.log(formatBlocks(map));
  const { count, warning } = formatSummary(map.palette.length);
  console.error(`\n${count}`);
  if (warning !== undefined) console.error(warning);
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
