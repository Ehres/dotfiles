import type { TraitId } from "../career/pick.ts";
import type { Phrase } from "../language.ts";

/** The badge after the Name while a Draw awaits a Pick. One column. */
export const CHOICE_BADGE = "★";

/** The title of the Draw dialog and what to do there. */
// TODO(Task 10): become Phrase and read with say(); see the plan's string table for the French.
export const CHOOSE = { title: "Keep one" };

/** Nothing awaits, said as a toast when the command is run with an empty queue. */
// TODO(Task 10): become Phrase and read with say(); see the plan's string table for the French.
export const NOTHING_TO_CHOOSE = "No choice waits right now.";
/** Another window picked first. */
// TODO(Task 10): become Phrase and read with say(); see the plan's string table for the French.
export const CHOSEN_ELSEWHERE = "That choice was made in another window.";

/**
 * What each Trait is called and what it changes, shown in the Draw dialog and
 * on the card. `description` is not bound by MAX_TEXT: it is read in a
 * dialog, not spoken in a Bubble.
 */
export const TRAIT_TEXT: Record<TraitId, { title: Phrase; description: Phrase }> = {
  hardy: {
    title: { en: "Hardy", fr: "Endurant" },
    description: { en: "Shrugs off failing streaks and retries", fr: "Encaisse les séries d'échecs et les reprises" },
  },
  unshaken: {
    title: { en: "Unshaken", fr: "Imperturbable" },
    description: { en: "Takes a refusal and a long haul in stride", fr: "Prend un refus et une longue traversée sans broncher" },
  },
  proud: {
    title: { en: "Proud", fr: "Fier" },
    description: { en: "Makes much of finished lists and big diffs", fr: "Fait grand cas des listes finies et des gros diffs" },
  },
  boastful: {
    title: { en: "Boastful", fr: "Vantard" },
    description: { en: "Crows over evolutions and granted permissions", fr: "Se rengorge des évolutions et des permissions accordées" },
  },
  watchful: {
    title: { en: "Watchful", fr: "Vigilant" },
    description: { en: "Notices branches changing and worktrees appearing", fr: "Remarque les branches qui changent et les worktrees qui apparaissent" },
  },
  restless: {
    title: { en: "Restless", fr: "Fébrile" },
    description: { en: "Feels files stirring outside the session", fr: "Sent les fichiers bouger hors de la session" },
  },
};
