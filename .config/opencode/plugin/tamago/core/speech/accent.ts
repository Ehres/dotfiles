import type { TraitId } from "../career/pick.ts";
import type { AnyCue, Cue, Phrases, TraitCue } from "./cue.ts";

/** What a Trait does to the Voice: the Cues it takes over, the Cues it alone opens, and its phrases for each of them. */
export type Accent = { takes: readonly Cue[]; opens: readonly TraitCue[]; phrases: Partial<Record<AnyCue, Phrases>> };

/**
 * Tune here, never in code paths. On a Cue a held Trait takes, that Trait
 * always speaks: the Species and the Temperament stay silent there. A Cue a
 * Trait opens is spoken by that Trait alone; nobody else can. A test checks
 * that `takes`/`opens` and `phrases` name exactly the same Cues.
 */
export const ACCENT: Record<TraitId, Accent> = {
  hardy: {
    takes: ["streak", "retried"],
    opens: [],
    phrases: {
      streak: [{ en: "Still standing.", fr: "Toujours d'aplomb." }, { en: "Keep them coming.", fr: "Vas-y, j'encaisse." }, { en: "Barely felt it.", fr: "À peine senti." }],
      retried: [{ en: "Again. Fine by me.", fr: "Ça ne me gêne pas." }, { en: "Once more.", fr: "On repart." }, { en: "I don't tire.", fr: "Rien ne m'épuise." }],
    },
  },
  unshaken: {
    takes: ["denied", "long_work"],
    opens: [],
    phrases: {
      denied: [{ en: "Understood.", fr: "Entendu." }, { en: "No matter.", fr: "Peu importe." }, { en: "As you say.", fr: "Comme tu voudras." }],
      long_work: [{ en: "Long one. No trouble.", fr: "Rien d'insurmontable." }, { en: "Still steady.", fr: "Toujours stable." }, { en: "That held.", fr: "Ça n'a pas cédé." }],
    },
  },
  proud: {
    takes: ["todos_done", "big_diff"],
    opens: [],
    phrases: {
      todos_done: [{ en: "Every one of them.", fr: "Toutes, sans exception." }, { en: "Flawless.", fr: "Sans un défaut." }, { en: "Look at that list.", fr: "Regarde cette liste." }],
      big_diff: [{ en: "A whole cathedral.", fr: "Toute une cathédrale." }, { en: "Look at this work!", fr: "Vois un peu ce travail !" }, { en: "We built that.", fr: "C'est notre ouvrage." }],
    },
  },
  boastful: {
    takes: ["evolved", "granted"],
    opens: [],
    phrases: {
      evolved: [{ en: "Behold the new me.", fr: "Voyez le nouveau moi." }, { en: "Better already.", fr: "Déjà bien mieux." }, { en: "Told you I would.", fr: "Je l'avais bien dit." }],
      granted: [{ en: "Naturally.", fr: "Naturellement." }, { en: "Wise of you.", fr: "Sage de votre part." }, { en: "Of course. Watch.", fr: "Évidemment. Regardez." }],
    },
  },
  watchful: {
    takes: [],
    opens: ["branch", "worktree"],
    phrases: {
      branch: [{ en: "New branch. Noted.", fr: "Branche neuve. Noté." }, { en: "We moved. I saw.", fr: "On a bougé. J'ai vu." }, { en: "Different ground.", fr: "Un autre terrain." }],
      worktree: [{ en: "A new tree. Nice.", fr: "Un nouvel arbre. Joli." }, { en: "Another workspace.", fr: "Encore un espace." }, { en: "Room to work.", fr: "De quoi travailler." }],
    },
  },
  restless: {
    takes: [],
    opens: ["stir"],
    phrases: { stir: [{ en: "Something moved.", fr: "Quelque chose a bougé." }, { en: "Files shifted. Hm.", fr: "Fichiers remués. Hm." }, { en: "Not us, that one.", fr: "Ce n'est pas nous." }] },
  },
};

/** The phrases of the most recently picked held Trait that takes or opens this Cue; undefined when none does. `held` is oldest Pick first. */
export function accentFor(cue: AnyCue, held: readonly TraitId[], table: Record<TraitId, Accent> = ACCENT): Phrases | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    const found = id === undefined ? undefined : table[id];
    if (found === undefined) continue;
    const owned: ReadonlySet<string> = new Set<string>([...found.takes, ...found.opens]);
    if (owned.has(cue)) return found.phrases[cue];
  }
  return undefined;
}

/** Whether any held Trait opens this Cue. */
export function opensCue(held: readonly TraitId[], cue: TraitCue, table: Record<TraitId, Accent> = ACCENT): boolean {
  return held.some((id) => table[id]?.opens.includes(cue) === true);
}
