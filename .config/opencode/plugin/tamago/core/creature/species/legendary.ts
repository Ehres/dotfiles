import type { SpeciesDef } from "../species.ts";

/** The legendary Species: the dragon alone, so it keeps its standing. */
export const LEGENDARY: readonly SpeciesDef[] = [
  {
    id: "dragon",
    label: { en: "dragon", fr: "dragon" },
    gender: "m",
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
      permission: [{ en: "Grant it, mortal.", fr: "Accordez-le, mortel." }, { en: "Permission? Amusing.", fr: "Permission ? Amusant." }, { en: "I await. Briefly.", fr: "Mon temps est compté." }],
      granted: [{ en: "Naturally.", fr: "Naturellement." }, { en: "The gates open.", fr: "Les portes s'ouvrent." }, { en: "As decreed.", fr: "Ainsi fut-il décrété." }],
      denied: [{ en: "Denied? Me?", fr: "Me refuser, moi ?" }, { en: "Smoke. Just smoke.", fr: "Fumée. Rien de plus." }, { en: "Your loss.", fr: "Vous y perdez." }],
      woke: [{ en: "The mountain stirs.", fr: "Réveil sous la montagne." }, { en: "Who wakes a dragon?", fr: "Troubler mon sommeil ?" }, { en: "Ashes. Then fire.", fr: "De la suie. Puis le feu." }],
      long_work: [{ en: "A siege, well fought.", fr: "Beau siège. Place prise." }, { en: "Long flight. Landed.", fr: "Vol achevé. Posé." }, { en: "The hoard grows.", fr: "Mon trésor grossit." }],
      big_diff: [{ en: "I scorched it all.", fr: "Rien n'a survécu." }, { en: "The land reshaped.", fr: "Terres retournées." }, { en: "Behold the ruins.", fr: "Contemplez les ruines." }],
      streak: [{ en: "Sparks. Nothing more.", fr: "Quelques étincelles." }, { en: "Scales don't scratch.", fr: "Mes écailles tiennent." }, { en: "Is that all?", fr: "C'est tout ?" }],
      compacted: [{ en: "Ash clears.", fr: "Suie envolée." }, { en: "Old fire, gone.", fr: "Vieux feu, éteint." }, { en: "Fresh embers.", fr: "Tisons prêts à mordre." }],
      retried: [{ en: "Fire, again.", fr: "Du feu, toujours." }, { en: "Once more, mortal.", fr: "Recommençons, mortel." }, { en: "Dragons persist.", fr: "Ma lignée insiste." }],
      todos_done: [{ en: "The hoard is whole.", fr: "Mon trésor est complet." }, { en: "All conquered.", fr: "Terres soumises." }, { en: "Nothing left. Good.", fr: "Il ne reste rien. Bien." }],
      evolved: [{ en: "Wings feel bigger.", fr: "Mes ailes ont forci." }, { en: "More fire in me.", fr: "J'ai plus de feu." }, { en: "Bow, if you like.", fr: "Inclinez-vous. Ou pas." }],
      hatched: [{ en: "A dragon. Behold.", fr: "Dragon. Enfin." }, { en: "Rare. As I should be.", fr: "Vous m'avez attendu." }, { en: "Smoke? Just me.", fr: "Cette fumée ? La mienne." }],
      choice: [{ en: "Choose. I allow it.", fr: "Ce choix, je l'autorise." }, { en: "Two futures. Pick.", fr: "Voici deux avenirs." }, { en: "Decide, human.", fr: "J'attends, mortel." }],
    },
  },
];
