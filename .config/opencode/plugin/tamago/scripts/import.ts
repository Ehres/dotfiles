// scripts/import.ts — run: node scripts/import.ts /path/to/duck.png [--patch <anchor>] [--palette "#rrggbb,..."]
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
 * What the image's size is measured against. A whole map is the canvas
 * exactly; a Patch has no fixed size — it is pinned to an anchor, and how far
 * it reaches depends on where that anchor sits, which this tool cannot know —
 * but it still has a bound, because nothing wider or taller than the canvas
 * can fit under any anchor at all. `stamp()` clips the rest at render, in
 * silence, which is the failure this refusal exists to make loud.
 */
export type Bound = { width: number; height: number; fit: "exactly" | "at most" };

/** A colour the image wears that the given palette did not hold, and how many pixels wear it. */
export type Drift = { colour: string; count: number };

/** What an image becomes: a map of palette indices, the Palette those index into, and what drifted. */
export type Drawn = { pixels: string[]; palette: string[]; added: readonly Drift[] };

/** Colours by descending pixel count, ties by hex: the order every refusal and every fresh Palette reads in. */
function ranked(counts: Map<string, number>): readonly Drift[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([colour, count]) => ({ colour, count }));
}

function listed(drifts: readonly Drift[]): readonly string[] {
  return drifts.map(({ colour, count }) => `  ${colour} x${count}`);
}

/**
 * The ceiling refusal's body: which colours are there, how many pixels each
 * holds, and what to do about it. Printed, not thrown blind, because a
 * person staring at "32 colours" over a hand-drawn image has no way to tell
 * a real 32-colour drawing from sixteen colours each anti-aliased into two —
 * the counts make that visible at a glance.
 */
function ceilingMessage(counts: Map<string, number>): string {
  return [
    `the image holds ${counts.size} colours, the ceiling is ${PALETTE_MAX}:`,
    ...listed(ranked(counts)),
    `reduce the image to ${PALETTE_MAX} colours or fewer in the editor — for instance, export with an indexed palette.`,
  ].join("\n");
}

/** The same refusal for a given palette: the ceiling is reached together, so the drift is what to look at. */
function driftCeilingMessage(given: readonly string[], added: readonly Drift[]): string {
  return [
    `the given palette holds ${given.length} colours and the image wears ${added.length} more, past the ceiling of ${PALETTE_MAX}:`,
    ...listed(added),
    `recolour those to colours the Species already holds, or drop one from the palette you passed.`,
  ].join("\n");
}

/**
 * The map and the Palette an image becomes. With no `given` palette the
 * colours are ordered by descending pixel count, ties by hex — the ordering
 * the first Body of a Species establishes. With one, that ordering is kept
 * exactly as passed and every colour the image wears that it does not hold is
 * appended after it, so the second, third and fourth Body of a Species index
 * into the same Palette as the first instead of each inventing its own.
 */
export function toMap(image: Image, bound: Bound, given: readonly string[] = []): Drawn {
  const oversize = image.width > bound.width || image.height > bound.height;
  const wrong = bound.fit === "exactly" ? image.width !== bound.width || image.height !== bound.height : oversize;
  if (wrong) {
    throw new Refusal(`the image is ${image.width} x ${image.height}, expected ${bound.fit} ${bound.width} x ${bound.height}`);
  }
  const counts = new Map<string, number>();
  for (let i = 0; i < image.width * image.height; i++) {
    const colour = colourAt(image, i);
    if (colour !== undefined) counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  const held = new Set(given);
  const added = ranked(counts).filter(({ colour }) => !held.has(colour));
  if (given.length === 0 && counts.size > PALETTE_MAX) throw new Refusal(ceilingMessage(counts));
  if (given.length > 0 && given.length + added.length > PALETTE_MAX) throw new Refusal(driftCeilingMessage(given, added));
  const palette = given.length === 0 ? added.map(({ colour }) => colour) : [...given, ...added.map(({ colour }) => colour)];
  const pixels: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = "";
    for (let x = 0; x < image.width; x++) {
      const colour = colourAt(image, y * image.width + x);
      row += colour === undefined ? "." : (MAP_ALPHABET[palette.indexOf(colour) + 1] ?? ".");
    }
    pixels.push(row);
  }
  return { pixels, palette, added: given.length === 0 ? [] : added };
}

/** The two blocks exactly as pasted into a Species file. The only thing this tool writes to stdout, so piping it (to `pbcopy`, say) carries nothing else. */
export function formatBlocks(map: { pixels: readonly string[]; palette: readonly string[] }): string {
  const paletteLine = `palette: [${map.palette.map((colour) => `"${colour}"`).join(", ")}],`;
  const pixelLines = map.pixels.map((row) => `  "${row}",`);
  return [paletteLine, "pixels: [", ...pixelLines, "],"].join("\n");
}

/**
 * What the image wore that the given palette did not, by name and pixel count.
 * Appending silently would be the same defect the per-image ordering already
 * is — indices that drifted without anyone being told — so the drift is named
 * the way the ceiling refusal names colours: a person can see at a glance
 * whether it is a genuinely new colour or a shade that survived a resave.
 * Undefined when nothing drifted, and when no palette was given, where every
 * colour is new by definition.
 */
export function formatDrift(added: readonly Drift[]): string | undefined {
  if (added.length === 0) return undefined;
  const one = added.length === 1;
  return [
    `warning: ${added.length} colour${one ? "" : "s"} of this image ${one ? "is" : "are"} not in the palette you gave, appended after it:`,
    ...added.map(({ colour, count }) => `  ${colour} x${count}`),
  ].join("\n");
}

/** The colour count, and a warning once the ceiling is reached. Reported, never pasted, so it belongs on stderr, not folded into formatBlocks. */
export function formatSummary(colours: number): { count: string; warning: string | undefined } {
  const count = `${colours} colour${colours === 1 ? "" : "s"}`;
  const warning =
    colours === PALETTE_MAX ? `warning: reached the ceiling of ${PALETTE_MAX} colours — the Species can hold no more` : undefined;
  return { count, warning };
}

/**
 * The Species' existing Palette, exactly as written in its file: `#rrggbb`
 * entries, comma-separated, in the order the first Body established. Refused
 * rather than repaired, because a typo silently shifts every index after it —
 * and a repeated colour would give one colour two indices, which is the same
 * defect with no typo in sight.
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
  const seen = new Set<string>();
  for (const colour of colours) {
    if (seen.has(colour)) throw new Refusal(`the given palette lists ${colour} twice, so one colour would hold two indices`);
    seen.add(colour);
  }
  if (colours.length > PALETTE_MAX) throw new Refusal(`the given palette holds ${colours.length} colours, the ceiling is ${PALETTE_MAX}`);
  return colours;
}

/** `--patch <anchor>` and `--palette <list>` may land anywhere in argv; whatever is left is the path. */
export function parseArgs(argv: readonly string[]): {
  path: string | undefined;
  anchor: string | undefined;
  palette: readonly string[] | undefined;
} {
  let rest: readonly string[] = argv;
  function take(flag: string, wants: string): string | undefined {
    const at = rest.indexOf(flag);
    if (at === -1) return undefined;
    const value = rest[at + 1];
    // A flag where the value should be is a forgotten argument, not a value: taking it would
    // import a Patch pinned to an anchor named "--palette".
    if (value === undefined || value.startsWith("--")) throw new Refusal(`${flag} requires ${wants}`);
    rest = rest.filter((_, i) => i !== at && i !== at + 1);
    return value;
  }
  const anchor = take("--patch", "an anchor name");
  const given = take("--palette", "a comma-separated list of #rrggbb colours");
  return { path: rest[0], anchor, palette: given === undefined ? undefined : parsePalette(given) };
}

/**
 * Reads the PNG at `path`, naming the path in the refusal on failure — a
 * typo'd filename or the wrong working directory is the single most likely
 * refusal this tool will ever produce, far more likely than a PNG feature it
 * does not cover, so it is a Refusal like every other one, not a stack dump.
 */
export function readPng(path: string): Uint8Array {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Refusal(`cannot read "${path}": ${reason}`);
  }
  return Uint8Array.from(bytes);
}

function main(): void {
  const { path, anchor, palette } = parseArgs(process.argv.slice(2));
  if (path === undefined) {
    console.error('usage: node scripts/import.ts <path-to-png> [--patch <anchor>] [--palette "#rrggbb,#rrggbb,..."]');
    process.exit(1);
  }

  const image = decodePng(readPng(path));
  // A whole map is the canvas exactly; a Patch is bounded by it, never sized by itself — measuring
  // it against its own dimensions is a check that cannot fail.
  const bound: Bound = { width: SPRITE_WIDTH, height: PIXEL_HEIGHT, fit: anchor === undefined ? "exactly" : "at most" };
  const map = toMap(image, bound, palette);

  if (anchor !== undefined) console.log(`// patch: ${anchor} (${image.width} x ${image.height})`);
  console.log(formatBlocks(map));
  const { count, warning } = formatSummary(map.palette.length);
  console.error(`\n${count}`);
  if (warning !== undefined) console.error(warning);
  const drift = formatDrift(map.added);
  if (drift !== undefined) console.error(drift);
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
