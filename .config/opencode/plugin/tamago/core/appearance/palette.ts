import type { Role } from "./pixels.ts";

/** The Roles a Species colours: the ones its maps can carry. */
export const SKIN_ROLES: readonly ("outline" | "primary" | "secondary" | "accent")[] = ["outline", "primary", "secondary", "accent"];
/** The Roles the engine paints; their colours belong to the Trait, the Draw and the Species' eye. */
export const PAINTED_ROLES: readonly ("eye" | "mark" | "badge" | "heart")[] = ["eye", "mark", "badge", "heart"];

/** One colour per Role a map can carry, plus the eye, which is the Species' too. Lowercase `#rrggbb`. */
export type Skin = Record<"outline" | "primary" | "secondary" | "accent" | "eye", string>;

/** Which theme a Skin is for. `theme.mode()` picks. */
export type Variant = "dark" | "light";

/** Both Skins of one Species. */
export type Palettes = Record<Variant, Skin>;
