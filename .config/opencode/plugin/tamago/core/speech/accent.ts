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
      streak: ["Still standing.", "Keep them coming.", "Barely felt it."],
      retried: ["Again. Fine by me.", "Once more.", "I don't tire."],
    },
  },
  unshaken: {
    takes: ["denied", "long_work"],
    opens: [],
    phrases: {
      denied: ["Understood.", "No matter.", "As you say."],
      long_work: ["Long one. No trouble.", "Still steady.", "That held."],
    },
  },
  proud: {
    takes: ["todos_done", "big_diff"],
    opens: [],
    phrases: {
      todos_done: ["Every one of them.", "Flawless.", "Look at that list."],
      big_diff: ["A whole cathedral.", "Look at this work!", "We built that."],
    },
  },
  boastful: {
    takes: ["evolved", "granted"],
    opens: [],
    phrases: {
      evolved: ["Behold the new me.", "Better already.", "Told you I would."],
      granted: ["Naturally.", "Wise of you.", "Of course. Watch."],
    },
  },
  watchful: {
    takes: [],
    opens: ["branch", "worktree"],
    phrases: {
      branch: ["New branch. Noted.", "We moved. I saw.", "Different ground."],
      worktree: ["A new tree. Nice.", "Another workspace.", "Room to work."],
    },
  },
  restless: {
    takes: [],
    opens: ["stir"],
    phrases: { stir: ["Something moved.", "Files shifted. Hm.", "Not us, that one."] },
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
