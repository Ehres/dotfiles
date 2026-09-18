import { pace, type SpeciesId } from "./species.ts";
import { TOOL_KINDS, type Counters, type ToolKind } from "./career.ts";

/** What the Stage is decided by: the counters, and the Species that sets their pace. Every Career is one. */
export type Paced = Counters & { species: SpeciesId };

/** XP weights. Tune here, never in code paths. Errors are deliberately absent. */
export const WEIGHTS: {
  prompts: number;
  sessions: number;
  filesEdited: number;
  tools: Record<ToolKind, number>;
} = {
  prompts: 2,
  sessions: 10,
  filesEdited: 5,
  tools: { read: 1, edit: 3, bash: 2, other: 1 },
};

export type StageId = "egg" | "hatchling" | "young" | "adult" | "elder";

/** Ascending thresholds. First guess; tune after a week of real use. */
export const STAGES: readonly { id: StageId; xp: number }[] = [
  { id: "egg", xp: 0 },
  { id: "hatchling", xp: 200 },
  { id: "young", xp: 1_500 },
  { id: "adult", xp: 6_000 },
  { id: "elder", xp: 20_000 },
];

export function xp(counters: Counters): number {
  let total = counters.prompts * WEIGHTS.prompts + counters.sessions * WEIGHTS.sessions + counters.filesEdited * WEIGHTS.filesEdited;
  for (const kind of TOOL_KINDS) total += counters.tools[kind] * WEIGHTS.tools[kind];
  return total;
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((entry) => entry.id === id);
}

/** XP times the Pace of the Species: the number the Stage thresholds are compared to. */
export function growth(paced: Paced): number {
  return xp(paced) * pace(paced.species);
}

export function stage(paced: Paced): StageId {
  const total = growth(paced);
  let current: StageId = "egg";
  for (const entry of STAGES) if (total >= entry.xp) current = entry.id;
  return current;
}

/** The coming Stage, its threshold in raw XP (so the card compares like with like), and the progress inside the current band. */
export function next(paced: Paced): { stage: StageId; threshold: number; progress: number } | undefined {
  const total = growth(paced);
  const index = stageIndex(stage(paced));
  const current = STAGES[index];
  const coming = STAGES[index + 1];
  if (!current || !coming) return undefined;
  const span = coming.xp - current.xp;
  return { stage: coming.id, threshold: Math.ceil(coming.xp / pace(paced.species)), progress: span > 0 ? (total - current.xp) / span : 1 };
}

/** The Stage reached when `after` sits strictly above `before`; undefined otherwise. */
export function evolution(before: Paced, after: Paced): StageId | undefined {
  const reached = stage(after);
  return stageIndex(reached) > stageIndex(stage(before)) ? reached : undefined;
}
