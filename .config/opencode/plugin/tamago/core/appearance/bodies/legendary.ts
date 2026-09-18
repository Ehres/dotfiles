import type { Bodies } from "../bodies.ts";
import type { SpeciesId } from "../../creature/species.ts";

/** The legendary Species: the dragon alone, so it keeps its standing. */
export const LEGENDARY: Record<SpeciesId, Bodies> = {
  dragon: {
    hatchling: (e, m) => [
      `   ^   ^  ${m}`,
      `  ( ${e} )`,
      "   \\_~_/",
      "    '-'",
      "",
    ],
    young: (e, m) => [
      `  ^\\   /^ ${m}`,
      `  ( ${e} )`,
      "  /\\_~_/\\",
      "   |___|",
      "   /   \\",
    ],
    adult: (e, m) => [
      `  ^\\   /^ ${m}`,
      `  ( ${e} )`,
      " /\\| ~ |/\\",
      "  |_____|",
      "  /|   |\\",
    ],
    elder: (e, m) => [
      `  ^\\ ^ /^ ${m}`,
      `  ( ${e} )`,
      " /\\|~~~|/\\",
      " \\_|___|_/",
      "  /|   |\\",
    ],
  },
};
