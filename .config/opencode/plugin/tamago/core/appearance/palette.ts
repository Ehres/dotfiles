import type { Role } from "./pixels.ts";

/** The Roles a hand-drawn map can carry. */
export const MAP_ROLES = ["outline", "primary", "secondary", "accent"] as const;
/** The Roles the engine paints: never in a map. */
export const PAINTED_ROLES = ["eye", "mark", "badge", "heart"] as const;
/** The Roles a Species colours: the map's, plus the eye, which is the Species' too. */
export const SKIN_ROLES = [...MAP_ROLES, "eye"] as const;

/** One colour per Role a map can carry, plus the eye, which is the Species' too. Lowercase `#rrggbb`. */
export type Skin = Record<(typeof SKIN_ROLES)[number], string>;

/** Which theme a Skin is for. `theme.mode()` picks. */
export type Variant = "dark" | "light";

/** Both Skins of one Species. */
export type Palettes = Record<Variant, Skin>;

/** Every Role belongs to exactly one list. A new Role that joins neither is a compile error here. */
type Unplaced = Exclude<Role, (typeof MAP_ROLES)[number] | (typeof PAINTED_ROLES)[number]>;
const _everyRoleIsPlaced: Unplaced extends never ? true : never = true;
