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
 */
export const EGG_PALETTE: Palette = ["#4c4438", "#d9cdb8", "#efe7d6"];
