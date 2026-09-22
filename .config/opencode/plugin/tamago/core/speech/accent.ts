import type { TraitId } from "../career/pick.ts";
import type { Cue, Phrases } from "./cue.ts";

/** What a Trait does to the Voice: the Cues it takes over, and its phrases for each of them. */
export type Accent = { takes: readonly Cue[]; phrases: Partial<Record<Cue, Phrases>> };

/**
 * Tune here, never in code paths. On a Cue a held Trait takes, that Trait
 * always speaks: the Species and the Temperament stay silent there. A test
 * checks that `takes` and `phrases` name exactly the same Cues.
 */
export const ACCENT: Record<TraitId, Accent> = {
  hardy: {
    takes: ["streak", "retried"],
    phrases: {
      streak: ["Still standing.", "Keep them coming.", "Barely felt it."],
      retried: ["Again. Fine by me.", "Once more.", "I don't tire."],
    },
  },
  unshaken: {
    takes: ["denied", "long_work"],
    phrases: {
      denied: ["Understood.", "No matter.", "As you say."],
      long_work: ["Long one. No trouble.", "Still steady.", "That held."],
    },
  },
  proud: {
    takes: ["todos_done", "big_diff"],
    phrases: {
      todos_done: ["Every one of them.", "Flawless.", "Look at that list."],
      big_diff: ["A whole cathedral.", "Look at this work!", "We built that."],
    },
  },
  boastful: {
    takes: ["evolved", "granted"],
    phrases: {
      evolved: ["Behold the new me.", "Better already.", "Told you I would."],
      granted: ["Naturally.", "Wise of you.", "Of course. Watch."],
    },
  },
  watchful: { takes: [], phrases: {} },
  restless: { takes: [], phrases: {} },
};

/** The phrases of the most recently picked held Trait that takes this Cue; undefined when none does. `held` is oldest Pick first. */
export function accentFor(cue: Cue, held: readonly TraitId[]): Phrases | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    const found = id === undefined ? undefined : ACCENT[id];
    if (found?.takes.includes(cue)) return found.phrases[cue];
  }
  return undefined;
}
