import type { TraitId } from "../career/pick.ts";

/** The badge after the Name while a Draw awaits a Pick. One column. */
export const CHOICE_BADGE = "★";

/** The title of the Draw dialog and what to do there. */
export const CHOOSE = { title: "Keep one" };

/** Nothing awaits, said as a toast when the command is run with an empty queue. */
export const NOTHING_TO_CHOOSE = "No choice waits right now.";
/** Another window picked first. */
export const CHOSEN_ELSEWHERE = "That choice was made in another window.";

/** What each Trait is called and what it changes, shown in the Draw dialog and on the card. */
export const TRAIT_TEXT: Record<TraitId, { title: string; description: string }> = {
  hardy: { title: "Hardy", description: "Shrugs off failing streaks and retries" },
  unshaken: { title: "Unshaken", description: "Takes a refusal and a long haul in stride" },
  proud: { title: "Proud", description: "Makes much of finished lists and big diffs" },
  boastful: { title: "Boastful", description: "Crows over evolutions and granted permissions" },
  watchful: { title: "Watchful", description: "Notices branches changing and worktrees appearing" },
  restless: { title: "Restless", description: "Feels files stirring outside the session" },
};
