import type { MilestoneId } from "./pick.ts";
import { stage, stageIndex, xp, type StageId } from "./stage.ts";
import { TOOL_KINDS, type Counters } from "./state.ts";

/** What a Milestone measures. Errors are deliberately absent: they never count. */
export type Measure = "sessions" | "prompts" | "filesEdited" | "questions" | "tools" | "xp";

export type Milestone =
  /** Reached when the Career's Stage is this one or a later one. */
  | { id: MilestoneId; stage: StageId }
  /** Reached when the measure is at least `min`. */
  | { id: MilestoneId; measure: Measure; min: number };

/**
 * Tune here, never in code paths. Table order is the order pending Milestones
 * are offered in. Empty until the first real Milestone; ids will follow
 * `evolution:<stage>` and `<measure>:<min>`, but nothing depends on it.
 */
export const MILESTONES: readonly Milestone[] = [];

/** The value of a Measure: `tools` sums the four kinds, `xp` reuses `xp()`. */
export function measure(counters: Counters, of: Measure): number {
  switch (of) {
    case "tools": {
      let total = 0;
      for (const kind of TOOL_KINDS) total += counters.tools[kind];
      return total;
    }
    case "xp":
      return xp(counters);
    default:
      return counters[of];
  }
}

/** Whether the counters satisfy a Milestone. A fact about the counters, not an event. */
export function isReached(counters: Counters, milestone: Milestone): boolean {
  if ("stage" in milestone) return stageIndex(stage(counters)) >= stageIndex(milestone.stage);
  return measure(counters, milestone.measure) >= milestone.min;
}

/** Milestones whose rule the counters satisfy, in table order. */
export function reached(counters: Counters, table: readonly Milestone[] = MILESTONES): Milestone[] {
  return table.filter((milestone) => isReached(counters, milestone));
}
