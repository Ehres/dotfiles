import { TOOL_KINDS, type Counters, type ToolKind } from "./state.ts";

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

export function stage(counters: Counters): StageId {
  const total = xp(counters);
  let current: StageId = "egg";
  for (const entry of STAGES) if (total >= entry.xp) current = entry.id;
  return current;
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((entry) => entry.id === id);
}

export function next(counters: Counters): { stage: StageId; threshold: number; progress: number } | undefined {
  const total = xp(counters);
  const index = stageIndex(stage(counters));
  const current = STAGES[index];
  const coming = STAGES[index + 1];
  if (!current || !coming) return undefined;
  const span = coming.xp - current.xp;
  return { stage: coming.id, threshold: coming.xp, progress: span > 0 ? (total - current.xp) / span : 1 };
}
