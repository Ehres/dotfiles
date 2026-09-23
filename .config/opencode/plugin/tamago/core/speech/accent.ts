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
      streak: [{ en: "Still standing." }, { en: "Keep them coming." }, { en: "Barely felt it." }],
      retried: [{ en: "Again. Fine by me." }, { en: "Once more." }, { en: "I don't tire." }],
    },
  },
  unshaken: {
    takes: ["denied", "long_work"],
    opens: [],
    phrases: {
      denied: [{ en: "Understood." }, { en: "No matter." }, { en: "As you say." }],
      long_work: [{ en: "Long one. No trouble." }, { en: "Still steady." }, { en: "That held." }],
    },
  },
  proud: {
    takes: ["todos_done", "big_diff"],
    opens: [],
    phrases: {
      todos_done: [{ en: "Every one of them." }, { en: "Flawless." }, { en: "Look at that list." }],
      big_diff: [{ en: "A whole cathedral." }, { en: "Look at this work!" }, { en: "We built that." }],
    },
  },
  boastful: {
    takes: ["evolved", "granted"],
    opens: [],
    phrases: {
      evolved: [{ en: "Behold the new me." }, { en: "Better already." }, { en: "Told you I would." }],
      granted: [{ en: "Naturally." }, { en: "Wise of you." }, { en: "Of course. Watch." }],
    },
  },
  watchful: {
    takes: [],
    opens: ["branch", "worktree"],
    phrases: {
      branch: [{ en: "New branch. Noted." }, { en: "We moved. I saw." }, { en: "Different ground." }],
      worktree: [{ en: "A new tree. Nice." }, { en: "Another workspace." }, { en: "Room to work." }],
    },
  },
  restless: {
    takes: [],
    opens: ["stir"],
    phrases: { stir: [{ en: "Something moved." }, { en: "Files shifted. Hm." }, { en: "Not us, that one." }] },
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
