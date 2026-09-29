// scripts/import.ts — turns PNG sprites into the palette and maps pasted into a Species file.
//
//   node scripts/import.ts adult.png hatchling.png young.png elder.png   one Species, one shared palette
//   node scripts/import.ts elder.png --palette "#rrggbb,..."             redraw a stage, keep the palette
//   node scripts/import.ts eye.png --patch left_eye --palette "..."      an expression patch
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import { PALETTE_MAX } from "../core/appearance/palette.ts";
import { decodePng, Refusal, type Image } from "./png.ts";

/** Alpha is a cut, not a blend: under 128 the pixel is transparent, at or above it takes its RGB. */
const OPAQUE = 128;

/**
 * Two colours closer than this are the same colour. An AI regeneration drifts every colour of its
 * source by up to about 33 — measured on a cat and the kitten derived from it — while a genuinely
 * different feature, turquoise eyes on a grey coat, sat 46 or more away. 35 merges the first and
 * keeps the second apart.
 */
export const MERGE_DISTANCE = 35;

/**
 * What an image's size is measured against. A whole map is the canvas exactly; a Patch is pinned
 * to an anchor and has no fixed size, but nothing larger than the canvas fits under any anchor.
 */
export type Bound = { width: number; height: number; fit: "exactly" | "at most" };

function colourAt(image: Image, i: number): string | undefined {
  if ((image.pixels[i * 4 + 3] ?? 0) < OPAQUE) return undefined;
  const hex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${hex(image.pixels[i * 4] ?? 0)}${hex(image.pixels[i * 4 + 1] ?? 0)}${hex(image.pixels[i * 4 + 2] ?? 0)}`;
}

/** Euclidean RGB distance between two `#rrggbb` colours. */
export function distance(a: string, b: string): number {
  const channel = (colour: string, at: number): number => parseInt(colour.slice(at, at + 2), 16);
  const dr = channel(a, 1) - channel(b, 1);
  const dg = channel(a, 3) - channel(b, 3);
  const db = channel(a, 5) - channel(b, 5);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function checkSize(image: Image, bound: Bound): void {
  const wrong =
    bound.fit === "exactly"
      ? image.width !== bound.width || image.height !== bound.height
      : image.width > bound.width || image.height > bound.height;
  if (wrong) throw new Refusal(`the image is ${image.width} x ${image.height}, expected ${bound.fit} ${bound.width} x ${bound.height}`);
}

/** Every opaque colour across `images`, with its pixel count summed over all of them. */
export function pooled(images: readonly Image[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const image of images) {
    for (let i = 0; i < image.width * image.height; i++) {
      const colour = colourAt(image, i);
      if (colour !== undefined) counts.set(colour, (counts.get(colour) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The one Palette a Species' images share, deduced from all of them at once: colours taken by
 * descending pixel count, each joining the first kept colour within MERGE_DISTANCE, and at most
 * PALETTE_MAX kept — the most used, in descending order of use.
 */
export function sharedPalette(images: readonly Image[]): string[] {
  const ranked = [...pooled(images).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const kept: { colour: string; count: number }[] = [];
  for (const [colour, count] of ranked) {
    const home = kept.find((one) => distance(one.colour, colour) <= MERGE_DISTANCE);
    if (home === undefined) kept.push({ colour, count });
    else home.count += count;
  }
  kept.sort((a, b) => b.count - a.count || a.colour.localeCompare(b.colour));
  return kept.slice(0, PALETTE_MAX).map(({ colour }) => colour);
}

/** An image drawn on `palette`: every opaque pixel takes the nearest colour, and how far the furthest one moved. */
export function mapOnto(image: Image, palette: readonly string[]): { pixels: string[]; correction: number } {
  const resolved = new Map<string, { index: number; distance: number }>();
  const nearest = (colour: string): { index: number; distance: number } => {
    const known = resolved.get(colour);
    if (known !== undefined) return known;
    let best = { index: 0, distance: Infinity };
    for (const [index, candidate] of palette.entries()) {
      const d = distance(colour, candidate);
      if (d < best.distance) best = { index, distance: d };
    }
    resolved.set(colour, best);
    return best;
  };
  let correction = 0;
  const pixels: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = "";
    for (let x = 0; x < image.width; x++) {
      const colour = colourAt(image, y * image.width + x);
      if (colour === undefined) {
        row += ".";
        continue;
      }
      const { index, distance: moved } = nearest(colour);
      correction = Math.max(correction, moved);
      row += MAP_ALPHABET[index + 1] ?? ".";
    }
    pixels.push(row);
  }
  return { pixels, correction };
}

/** What is pasted into a Species file: the palette once, then each map, labelled when there is more than one. The only thing written to stdout. */
export function formatBlocks(palette: readonly string[], maps: readonly { label: string | undefined; pixels: readonly string[] }[]): string {
  const lines = [`palette: [${palette.map((colour) => `"${colour}"`).join(", ")}],`];
  for (const { label, pixels } of maps) {
    if (label !== undefined) lines.push(`// ${label}`);
    lines.push("pixels: [", ...pixels.map((row) => `  "${row}",`), "],");
  }
  return lines.join("\n");
}

/** One line for stderr: how many colours went in, how many came out, and how far the furthest pixel moved. */
export function formatSummary(source: number, palette: number, correction: number): string {
  const plural = (n: number): string => `${n} colour${n === 1 ? "" : "s"}`;
  return `${plural(source)} in, ${plural(palette)} in the palette, largest correction ${correction.toFixed(1)}`;
}

/**
 * A Species' existing Palette, exactly as written in its file. Refused rather than repaired: a
 * typo or a repeated colour would shift every index after it.
 */
export function parsePalette(text: string): string[] {
  const colours = text
    .split(",")
    .map((one) => one.trim().toLowerCase())
    .filter((one) => one !== "");
  if (colours.length === 0) throw new Refusal("--palette requires at least one #rrggbb colour");
  for (const colour of colours) {
    if (!/^#[0-9a-f]{6}$/.test(colour)) throw new Refusal(`"${colour}" is not a #rrggbb colour`);
  }
  if (new Set(colours).size !== colours.length) throw new Refusal("the given palette lists a colour twice, so one colour would hold two indices");
  if (colours.length > PALETTE_MAX) throw new Refusal(`the given palette holds ${colours.length} colours, the ceiling is ${PALETTE_MAX}`);
  return colours;
}

/** `--patch <anchor>` and `--palette <list>` may land anywhere in argv; everything else is an image path. */
export function parseArgs(argv: readonly string[]): {
  paths: readonly string[];
  anchor: string | undefined;
  palette: readonly string[] | undefined;
} {
  let rest: readonly string[] = argv;
  function take(flag: string, wants: string): string | undefined {
    const at = rest.indexOf(flag);
    if (at === -1) return undefined;
    const value = rest[at + 1];
    // A flag where the value should be is a forgotten argument, not a value.
    if (value === undefined || value.startsWith("--")) throw new Refusal(`${flag} requires ${wants}`);
    rest = rest.filter((_, i) => i !== at && i !== at + 1);
    return value;
  }
  const anchor = take("--patch", "an anchor name");
  const given = take("--palette", "a comma-separated list of #rrggbb colours");
  return { paths: rest, anchor, palette: given === undefined ? undefined : parsePalette(given) };
}

/** Reads the PNG at `path`; a missing or unreadable file is a Refusal naming the path, not a stack dump. */
export function readPng(path: string): Uint8Array {
  try {
    return Uint8Array.from(readFileSync(path));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Refusal(`cannot read "${path}": ${reason}`);
  }
}

function main(): void {
  const { paths, anchor, palette: given } = parseArgs(process.argv.slice(2));
  if (paths.length === 0) {
    console.error('usage: node scripts/import.ts <image.png>... [--palette "#rrggbb,..."] [--patch <anchor>]');
    process.exit(1);
  }
  if (anchor !== undefined && paths.length > 1) throw new Refusal("--patch takes a single image");

  const bound: Bound = { width: SPRITE_WIDTH, height: PIXEL_HEIGHT, fit: anchor === undefined ? "exactly" : "at most" };
  const images = paths.map((path) => {
    const image = decodePng(readPng(path));
    checkSize(image, bound);
    return image;
  });

  const palette = given ?? sharedPalette(images);
  const maps = images.map((image) => mapOnto(image, palette));
  const labelled = paths.length > 1;
  const label = (path: string): string | undefined =>
    anchor !== undefined ? `patch: ${anchor}` : labelled ? basename(path) : undefined;

  console.log(formatBlocks(palette, maps.map(({ pixels }, i) => ({ label: label(paths[i] ?? ""), pixels }))));
  const correction = Math.max(0, ...maps.map(({ correction: moved }) => moved));
  console.error(`\n${formatSummary(pooled(images).size, palette.length, correction)}`);
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
