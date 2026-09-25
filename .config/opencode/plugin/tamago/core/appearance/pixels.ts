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

/** The whole map alphabet. A character outside it is a typo, and throws. */
export const ROLE_OF: Record<string, Role | null> = {
  ".": null,
  o: "outline",
  a: "primary",
  b: "secondary",
  c: "accent",
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
