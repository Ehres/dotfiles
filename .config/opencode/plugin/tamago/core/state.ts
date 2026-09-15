import { latest, type Rename } from "./name.ts";
import { firstPicks, hydratePicks, samePicks, type Picks } from "./pick.ts";

export type Activity = "idle" | "thinking" | "working" | "waiting" | "hurt" | "sleeping";
export type ToolKind = "read" | "edit" | "bash" | "other";

export type Session = {
  activity: Activity;
  since: number;
  /** Whether the OpenCode session is busy, per its own status. */
  busy: boolean;
};

export type Counters = {
  sessions: number;
  prompts: number;
  tools: Record<ToolKind, number>;
  filesEdited: number;
  errors: number;
  questions: number;
};

/** `name` is absent until the user renames the creature; the plugin option is the default. `picks` is always present, `{}` until the first Pick. */
export type Career = Counters & { hatchedAt: number; name?: Rename; picks: Picks };
/** `rename` and `picks` are Deltas like any other: they wait for the flush; the latest rename wins, the earliest Pick wins. */
export type Delta = Counters & { rename?: Rename; picks?: Picks };

export const ACTIVITIES: readonly Activity[] = ["idle", "thinking", "working", "waiting", "hurt", "sleeping"];
export const TOOL_KINDS: readonly ToolKind[] = ["read", "edit", "bash", "other"];

export const EMPTY_DELTA: Delta = {
  sessions: 0,
  prompts: 0,
  tools: { read: 0, edit: 0, bash: 0, other: 0 },
  filesEdited: 0,
  errors: 0,
  questions: 0,
};

export function initialSession(now: number): Session {
  return { activity: "idle", since: now, busy: false };
}

export function freshCareer(now: number): Career {
  return { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, hatchedAt: now, picks: {} };
}

export function isEmpty(delta: Delta): boolean {
  return (
    delta.rename === undefined &&
    (delta.picks === undefined || Object.keys(delta.picks).length === 0) &&
    delta.sessions === 0 &&
    delta.prompts === 0 &&
    delta.filesEdited === 0 &&
    delta.errors === 0 &&
    delta.questions === 0 &&
    TOOL_KINDS.every((kind) => delta.tools[kind] === 0)
  );
}

export function addDelta(a: Delta, b: Delta): Delta {
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = a.tools[kind] + b.tools[kind];
  const rename = latest(a.rename, b.rename);
  const picks = firstPicks(a.picks ?? {}, b.picks ?? {});
  return {
    sessions: a.sessions + b.sessions,
    prompts: a.prompts + b.prompts,
    tools,
    filesEdited: a.filesEdited + b.filesEdited,
    errors: a.errors + b.errors,
    questions: a.questions + b.questions,
    ...(rename === undefined ? {} : { rename }),
    ...(Object.keys(picks).length === 0 ? {} : { picks }),
  };
}

/** Structural equality, so a re-read of unchanged disk state does not notify anyone. */
export function sameCareer(a: Career, b: Career): boolean {
  return (
    a.hatchedAt === b.hatchedAt &&
    a.name?.value === b.name?.value &&
    a.name?.at === b.name?.at &&
    a.sessions === b.sessions &&
    a.prompts === b.prompts &&
    a.filesEdited === b.filesEdited &&
    a.errors === b.errors &&
    a.questions === b.questions &&
    TOOL_KINDS.every((kind) => a.tools[kind] === b.tools[kind]) &&
    samePicks(a.picks, b.picks)
  );
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hydrate(raw: unknown, now: number): { career: Career; corrupt: boolean } {
  if (!isRecord(raw)) return { career: freshCareer(now), corrupt: true };
  const rawTools = isRecord(raw.tools) ? raw.tools : {};
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = num(rawTools[kind], 0);
  const name = rename(raw.name);
  return {
    corrupt: false,
    career: {
      sessions: num(raw.sessions, 0),
      prompts: num(raw.prompts, 0),
      tools,
      filesEdited: num(raw.filesEdited, 0),
      errors: num(raw.errors, 0),
      questions: num(raw.questions, 0),
      hatchedAt: num(raw.hatchedAt, now),
      picks: hydratePicks(raw.picks),
      ...(name === undefined ? {} : { name }),
    },
  };
}

/** A stored name, only when both parts are well-formed. */
function rename(value: unknown): Rename | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.value !== "string" || value.value.length === 0) return undefined;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  return { value: value.value, at: value.at };
}
