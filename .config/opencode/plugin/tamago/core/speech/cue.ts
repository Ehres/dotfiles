/** Why the Tamago speaks. Born from events and transitions, never from content. */
export type Cue =
  | "permission"
  | "granted"
  | "denied"
  | "woke"
  | "long_work"
  | "big_diff"
  | "streak"
  | "compacted"
  | "retried"
  | "todos_done"
  | "evolved"
  | "hatched"
  | "choice";

/** At least one phrase; a test bounds each to MAX_TEXT. */
export type Phrases = readonly [string, ...string[]];

/** Tuning table: a higher priority may interrupt the quiet window; Infinity means once per Session. */
export const CUES: Record<Cue, { priority: number; cooldown: number }> = {
  permission: { priority: 1, cooldown: 120_000 },
  granted: { priority: 2, cooldown: 0 },
  denied: { priority: 2, cooldown: 0 },
  woke: { priority: 1, cooldown: 0 },
  long_work: { priority: 1, cooldown: 0 },
  big_diff: { priority: 1, cooldown: Infinity },
  streak: { priority: 2, cooldown: 60_000 },
  compacted: { priority: 2, cooldown: 0 },
  retried: { priority: 2, cooldown: 60_000 },
  todos_done: { priority: 2, cooldown: 0 },
  evolved: { priority: 3, cooldown: 0 },
  hatched: { priority: 3, cooldown: 0 },
  choice: { priority: 2, cooldown: 3_600_000 },
};

/** The Cues only a Trait opens: nobody else speaks them, so no Species owes them a phrase and `Signature` stays total over `Cue`. */
export type TraitCue = "branch" | "worktree" | "stir";
export type AnyCue = Cue | TraitCue;

export const TRAIT_CUES: Record<TraitCue, { priority: number; cooldown: number }> = {
  branch: { priority: 1, cooldown: 60_000 },
  worktree: { priority: 1, cooldown: 60_000 },
  stir: { priority: 1, cooldown: 600_000 },
};

/** Whether a Cue is one only a Trait opens, never one owed a phrase by every Species. */
export function isTraitCue(cue: AnyCue): cue is TraitCue {
  return cue in TRAIT_CUES;
}

/** The tuning of any Cue, whoever speaks it. */
export function tuningOf(cue: AnyCue): { priority: number; cooldown: number } {
  return isTraitCue(cue) ? TRAIT_CUES[cue] : CUES[cue];
}
