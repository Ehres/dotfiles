/** Cells across, and cells down. A cell is one pixel wide and two pixels tall. */
export const SPRITE_WIDTH = 21;
export const SPRITE_HEIGHT = 10;
/** Pixels down: two per cell. A cell being twice as tall as it is wide, these pixels are square on screen. */
export const PIXEL_HEIGHT = SPRITE_HEIGHT * 2;

/**
 * What a pixel is, never what colour it is. A Palette gives one colour per
 * Role. `eye`, `mark` and `badge` never appear in a map: the engine paints
 * them from the rectangles a Body declares and from the two corner slots.
 */
export type Role = "outline" | "primary" | "secondary" | "accent" | "eye" | "mark" | "badge" | "heart";

/** One terminal cell: the pixel above and the pixel below, null where nothing is drawn. */
export type Cell = { top: Role | null; bottom: Role | null };

/** SPRITE_HEIGHT rows of SPRITE_WIDTH cells. */
export type Frame = readonly (readonly Cell[])[];

/** A rectangle of pixels inside a map: where the eyes go, or what moves. */
export type Rect = { x: number; y: number; w: number; h: number };

/** The five characters a hand-drawn map may use. `E`, `M`, `G` and `H` are the engine's. */
export const MAP_ALPHABET = ".oabc";

/** The whole map alphabet. A character outside it is a typo, and throws. */
export const ROLE_OF: Record<string, Role | null> = {
  ".": null,
  o: "outline",
  a: "primary",
  b: "secondary",
  c: "accent",
  E: "eye",
  M: "mark",
  G: "badge",
  H: "heart",
};

function roleAt(rows: readonly string[], x: number, y: number): Role | null {
  const char = rows[y]?.[x];
  if (char === undefined) return null;
  const role = Object.prototype.hasOwnProperty.call(ROLE_OF, char) ? ROLE_OF[char] : undefined;
  if (role === undefined) throw new Error(`"${char}" is not a map character (row ${y}, column ${x})`);
  return role;
}

/** Packs PIXEL_HEIGHT rows of role characters into SPRITE_HEIGHT rows of Cells. */
export function pack(rows: readonly string[]): Frame {
  if (rows.length !== PIXEL_HEIGHT) throw new Error(`a map is ${PIXEL_HEIGHT} rows, got ${rows.length}`);
  for (const [y, row] of rows.entries()) {
    if (row.length !== SPRITE_WIDTH) throw new Error(`a map row is ${SPRITE_WIDTH} characters, row ${y} has ${row.length}`);
  }
  const frame: Cell[][] = [];
  for (let y = 0; y < PIXEL_HEIGHT; y += 2) {
    const line: Cell[] = [];
    for (let x = 0; x < SPRITE_WIDTH; x++) line.push({ top: roleAt(rows, x, y), bottom: roleAt(rows, x, y + 1) });
    frame.push(line);
  }
  return frame;
}

/** The character a painted overlay writes for each Role the engine owns. */
export const PAINT_OF: Record<"eye" | "mark" | "badge" | "heart", string> = { eye: "E", mark: "M", badge: "G", heart: "H" };

/** Rows of '#' (paint) and anything else (leave alone). */
export type Pattern = readonly string[];

/** Writes `pattern` into `at` as `role`, on a copy of `rows`. */
export function paint(rows: readonly string[], at: Rect, pattern: Pattern, role: "eye" | "mark" | "badge" | "heart"): string[] {
  if (at.x < 0 || at.y < 0 || at.x + at.w > SPRITE_WIDTH || at.y + at.h > PIXEL_HEIGHT) {
    throw new Error(`the rectangle ${at.x},${at.y} ${at.w}x${at.h} falls outside the map`);
  }
  if (pattern.length !== at.h || pattern.some((line) => line.length !== at.w)) {
    throw new Error(`a pattern for a ${at.w} x ${at.h} rectangle must be ${at.h} rows of ${at.w}`);
  }
  const char = PAINT_OF[role];
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
