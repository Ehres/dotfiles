/**
 * A Species' colours, index 0 to 15, lowercase `#rrggbb`. A map's characters
 * are indices into this list. One list per Species: the Sprite is tuned for a
 * dark theme and read as-is on a light one.
 */
export type Palette = readonly string[];

/** The ceiling, and what the import script passes as `maxColors`. */
export const PALETTE_MAX = 16;

/**
 * The egg's own colours, never a Species'. Every egg looks the same whatever
 * hatches from it: the Rarity and the Species are learned at the hatch, and
 * the egg reveals neither.
 *
 * Index 3 is a placeholder: the egg's map never writes it, and it exists only
 * to keep index 4 — the egg's eye colour — aligned with EYE_INDEX in
 * sprites.ts, the slot every Species' own eye shares too. Task 4 removes the
 * shared eye index, and with it the need for this placeholder.
 */
export const EGG_PALETTE: Palette = ["#4c4438", "#d9cdb8", "#efe7d6", "#4c4438", "#2a2520"];
