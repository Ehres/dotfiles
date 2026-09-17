import type { Bodies } from "../bodies.ts";
import type { SpeciesId } from "../species.ts";

/** The common Species: everyday creatures. */
export const COMMON: Record<SpeciesId, Bodies> = {
  cat: {
    hatchling: (e, m) => [
      `   .---.  ${m}`,
      `  ( ${e} )`,
      "   \\ ^ /",
      "    '-'",
      "",
    ],
    young: (e, m) => [
      `   .---.  ${m}`,
      `  ( ${e} )`,
      "  /| ^ |\\",
      "   |___|",
      "   /   \\",
    ],
    adult: (e, m) => [
      `  /\\   /\\ ${m}`,
      `  ( ${e} )`,
      " /| ^^^ |\\",
      "  |_____|",
      "  /|   |\\",
    ],
    elder: (e, m) => [
      `  \\|/ \\|/ ${m}`,
      `  ( ${e} )`,
      " /|~^^^~|\\",
      "  |_____|",
      "  /|   |\\",
    ],
  },
  owl: {
    hatchling: (e, m) => [
      `  /\\   /\\ ${m}`,
      `  ( ${e} )`,
      "  (  v  )",
      "   '---'",
      "",
    ],
    young: (e, m) => [
      `  /\\   /\\ ${m}`,
      `  ( ${e} )`,
      "  ((  v  ))",
      "   |/|\\|",
      "   ~~ ~~",
    ],
    adult: (e, m) => [
      `  /\\___/\\ ${m}`,
      `  ( ${e} )`,
      "  ((  v  ))",
      "  /|/|\\|\\",
      "   ~~   ~~",
    ],
    elder: (e, m) => [
      `  /\\_^_/\\ ${m}`,
      `  ( ${e} )`,
      "  ((  v  ))",
      "  /|\\|/|\\",
      "   ~~~~~~~",
    ],
  },
};
