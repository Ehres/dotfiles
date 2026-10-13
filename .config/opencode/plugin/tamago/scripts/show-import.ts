/**
 * What import.ts printed, drawn back side by side at real size, two pixels a character: the check
 * that the shared palette did not flatten a draw, before its blocks are pasted into a Species.
 *
 *   node scripts/import.ts adult.png hatchling.png young.png elder.png > import.txt
 *   node scripts/show-import.ts import.txt
 */
import { readFileSync } from "node:fs";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import { Refusal } from "./png.ts";

const STAGES = ["hatchling", "young", "adult", "elder"];

export type Imported = { palette: string[]; maps: { label: string; rows: string[] }[] };

/** The palette and labelled maps out of import.ts' output; an unlabelled single map is labelled by its position. */
export function parseImport(text: string): Imported {
  const palette = [...(/palette: \[(.*?)\]/.exec(text)?.[1] ?? "").matchAll(/"([^"]*)"/g)].map((m) => m[1] ?? "");
  if (palette.length === 0) throw new Refusal("no palette: line: is this import.ts output?");
  const maps = [...text.matchAll(/(?:\/\/ (.+)\n)?pixels: \[\n([\s\S]*?)\]/g)].map((m, i) => ({
    label: (m[1] ?? `map ${i + 1}`).replace(/\.png$/, ""),
    rows: [...(m[2] ?? "").matchAll(/"([^"]*)"/g)].map((r) => r[1] ?? ""),
  }));
  const rank = (label: string): number => {
    const at = STAGES.indexOf(label);
    return at < 0 ? STAGES.length : at;
  };
  maps.sort((a, b) => rank(a.label) - rank(b.label));
  return { palette, maps };
}

/** One map as terminal lines: a half block per two pixels, the top in the foreground, the bottom in the background. */
export function drawMap(palette: readonly string[], rows: readonly string[]): string[] {
  const rgb = (char: string | undefined): string | undefined => {
    const hex = char === undefined ? undefined : palette[MAP_ALPHABET.indexOf(char) - 1];
    return hex === undefined ? undefined : [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)).join(";");
  };
  const lines: string[] = [];
  for (let y = 0; y < PIXEL_HEIGHT; y += 2) {
    let line = "";
    for (let x = 0; x < SPRITE_WIDTH; x++) {
      const top = rgb(rows[y]?.[x]);
      const bottom = rgb(rows[y + 1]?.[x]);
      if (top && bottom) line += `\x1b[38;2;${top}m\x1b[48;2;${bottom}m▀\x1b[0m`;
      else if (top) line += `\x1b[38;2;${top}m▀\x1b[0m`;
      else if (bottom) line += `\x1b[38;2;${bottom}m▄\x1b[0m`;
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
}

function main(): void {
  const path = process.argv[2];
  if (path === undefined) throw new Refusal("usage: node scripts/show-import.ts <import.txt>");
  const { palette, maps } = parseImport(readFileSync(path, "utf8"));
  const drawn = maps.map(({ rows }) => drawMap(palette, rows));
  console.log(maps.map(({ label }) => label.padEnd(SPRITE_WIDTH)).join("   "));
  for (let row = 0; row < PIXEL_HEIGHT / 2; row++) console.log(drawn.map((lines) => lines[row] ?? "").join("   "));
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
