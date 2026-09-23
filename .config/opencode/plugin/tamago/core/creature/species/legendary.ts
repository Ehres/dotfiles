import type { SpeciesDef } from "../species.ts";

/** The legendary Species: the dragon alone, so it keeps its standing. */
export const LEGENDARY: readonly SpeciesDef[] = [
  {
    id: "dragon",
    label: { en: "dragon" },
    rarity: "legendary",
    sheet: { sarcastic: 3, sensitivity: -2, energy: 2 },
    bodies: {
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
    signature: {
      permission: [{ en: "Grant it, mortal." }, { en: "Permission? Amusing." }, { en: "I await. Briefly." }],
      granted: [{ en: "Naturally." }, { en: "The gates open." }, { en: "As decreed." }],
      denied: [{ en: "Denied? Me?" }, { en: "Smoke. Just smoke." }, { en: "Your loss." }],
      woke: [{ en: "The mountain stirs." }, { en: "Who wakes a dragon?" }, { en: "Ashes. Then fire." }],
      long_work: [{ en: "A siege, well fought." }, { en: "Long flight. Landed." }, { en: "The hoard grows." }],
      big_diff: [{ en: "I scorched it all." }, { en: "The land reshaped." }, { en: "Behold the ruins." }],
      streak: [{ en: "Sparks. Nothing more." }, { en: "Scales don't scratch." }, { en: "Is that all?" }],
      compacted: [{ en: "Ash clears." }, { en: "Old fire, gone." }, { en: "Fresh embers." }],
      retried: [{ en: "Fire, again." }, { en: "Once more, mortal." }, { en: "Dragons persist." }],
      todos_done: [{ en: "The hoard is whole." }, { en: "All conquered." }, { en: "Nothing left. Good." }],
      evolved: [{ en: "Wings feel bigger." }, { en: "More fire in me." }, { en: "Bow, if you like." }],
      hatched: [{ en: "A dragon. Behold." }, { en: "Rare. As I should be." }, { en: "Smoke? Just me." }],
      choice: [{ en: "Choose. I allow it." }, { en: "Two futures. Pick." }, { en: "Decide, human." }],
    },
  },
];
