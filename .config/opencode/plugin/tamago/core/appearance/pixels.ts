/** Cells across, and cells down. A cell is one pixel wide and two pixels tall. */
export const SPRITE_WIDTH = 32;
export const SPRITE_HEIGHT = 16;
/** Pixels down: two per cell. A cell being twice as tall as it is wide, these pixels are square on screen. */
export const PIXEL_HEIGHT = SPRITE_HEIGHT * 2;

/** What a pixel is: a colour of the Species' Palette, or something the engine paints. */
export type Ink = number | "mark" | "badge" | "heart";

/** One terminal cell: the pixel above and the pixel below, null where nothing is drawn. */
export type Cell = { top: Ink | null; bottom: Ink | null };

/** SPRITE_HEIGHT rows of SPRITE_WIDTH cells. */
export type Frame = readonly (readonly Cell[])[];

/** A rectangle of pixels inside a map: where the eyes go, or what moves. */
export type Rect = { x: number; y: number; w: number; h: number };

/** Transparent, then the sixteen palette indices. */
export const MAP_ALPHABET = ".0123456789abcdef";

/** The three characters the engine paints. A map never holds one. */
export const PAINT_OF: Record<"mark" | "badge" | "heart", string> = { mark: "M", badge: "G", heart: "H" };

const PAINTED: Record<string, "mark" | "badge" | "heart"> = { M: "mark", G: "badge", H: "heart" };

function inkAt(rows: readonly string[], x: number, y: number): Ink | null {
  const char = rows[y]?.[x];
  if (char === undefined || char === ".") return null;
  const painted = Object.prototype.hasOwnProperty.call(PAINTED, char) ? PAINTED[char] : undefined;
  if (painted !== undefined) return painted;
  const index = MAP_ALPHABET.indexOf(char);
  if (index <= 0) throw new Error(`"${char}" is not a map character (row ${y}, column ${x})`);
  return index - 1;
}

/** The character an Ink is written as. Empty for an out-of-range index, so paint() can throw loudly. */
function charOf(ink: Ink): string {
  return typeof ink === "number" ? (ink >= 0 ? (MAP_ALPHABET[ink + 1] ?? "") : "") : PAINT_OF[ink];
}

/** Packs PIXEL_HEIGHT rows of map characters into SPRITE_HEIGHT rows of Cells. */
export function pack(rows: readonly string[]): Frame {
  if (rows.length !== PIXEL_HEIGHT) throw new Error(`a map is ${PIXEL_HEIGHT} rows, got ${rows.length}`);
  for (const [y, row] of rows.entries()) {
    if (row.length !== SPRITE_WIDTH) throw new Error(`a map row is ${SPRITE_WIDTH} characters, row ${y} has ${row.length}`);
  }
  const frame: Cell[][] = [];
  for (let y = 0; y < PIXEL_HEIGHT; y += 2) {
    const line: Cell[] = [];
    for (let x = 0; x < SPRITE_WIDTH; x++) line.push({ top: inkAt(rows, x, y), bottom: inkAt(rows, x, y + 1) });
    frame.push(line);
  }
  return frame;
}

/** Rows of '#' (paint) and anything else (leave alone). */
export type Pattern = readonly string[];

/** Throws unless `at` lies wholly inside the map. Shared by paint and shift so the bounds rule has one home. */
export function assertInside(at: Rect): void {
  if (at.x < 0 || at.y < 0 || at.x + at.w > SPRITE_WIDTH || at.y + at.h > PIXEL_HEIGHT) {
    throw new Error(`the rectangle ${at.x},${at.y} ${at.w}x${at.h} falls outside the map`);
  }
}

/** Writes `pattern` into `at` as `ink`, on a copy of `rows`. */
export function paint(rows: readonly string[], at: Rect, pattern: Pattern, ink: Ink): string[] {
  assertInside(at);
  if (pattern.length !== at.h || pattern.some((line) => line.length !== at.w)) {
    throw new Error(`a pattern for a ${at.w} x ${at.h} rectangle must be ${at.h} rows of ${at.w}`);
  }
  const char = charOf(ink);
  if (char === "") throw new Error(`palette index ${String(ink)} is outside 0-15`);
  const next = rows.slice();
  for (let dy = 0; dy < at.h; dy++) {
    const row = next[at.y + dy];
    if (row === undefined) continue;
    const chars = row.split("");
    for (let dx = 0; dx < at.w; dx++) if (pattern[dy]?.[dx] === "#") chars[at.x + dx] = char;
    next[at.y + dy] = chars.join("");
  }
  return next;
}
