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
 * The egg's map writes only indices 0 to 2. Indices 3 and 4 exist for the
 * patches: the egg takes DEFAULT_EXPRESSIONS, the migrated table that draws an
 * eye at index 4, so index 3 is a placeholder holding index 4 in place. Both
 * go when the egg is redrawn with a table of its own.
 */
export const EGG_PALETTE: Palette = ["#4c4438", "#d9cdb8", "#efe7d6", "#4c4438", "#2a2520"];
