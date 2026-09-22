import type { MilestoneId } from "../career/pick.ts";
import { growth, stage, stageIndex, type Paced, type StageId } from "../career/stage.ts";
import { TOOL_KINDS } from "../career/career.ts";

/** What a Milestone measures. Errors are deliberately absent: they never count. */
export type Measure = "sessions" | "prompts" | "filesEdited" | "questions" | "tools" | "xp";

export type Milestone =
  /** Reached when the Career's Stage is this one or a later one. */
  | { id: MilestoneId; stage: StageId }
  /** Reached when the measure is at least `min`. */
  | { id: MilestoneId; measure: Measure; min: number };

/**
 * Tune here, never in code paths. Table order is the order pending Milestones
 * are offered in. These are the shipped Milestones; a new one is added here,
 * its id following `evolution:<stage>` or `<measure>:<min>`.
 */
export const MILESTONES: readonly Milestone[] = [
  { id: "evolution:hatchling", stage: "hatchling" },
  { id: "evolution:young", stage: "young" },
  { id: "evolution:adult", stage: "adult" },
  { id: "evolution:elder", stage: "elder" },
];

/** The value of a Measure: `tools` sums the four kinds, `xp` follows Growth so a Milestone comes at the same moment of every Species' life. */
export function measure(paced: Paced, of: Measure): number {
  switch (of) {
    case "tools": {
      let total = 0;
      for (const kind of TOOL_KINDS) total += paced.tools[kind];
      return total;
    }
    case "xp":
      return growth(paced);
    default:
      return paced[of];
  }
}

/** Whether the counters satisfy a Milestone. A fact about the counters, not an event. */
export function isReached(paced: Paced, milestone: Milestone): boolean {
  if ("stage" in milestone) return stageIndex(stage(paced)) >= stageIndex(milestone.stage);
  return measure(paced, milestone.measure) >= milestone.min;
}

/** Milestones whose rule the counters satisfy, in table order. */
export function reached(paced: Paced, table: readonly Milestone[] = MILESTONES): Milestone[] {
  return table.filter((milestone) => isReached(paced, milestone));
}
