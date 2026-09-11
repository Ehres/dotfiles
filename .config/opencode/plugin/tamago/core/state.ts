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
};

export type Career = Counters & { hatchedAt: number };
export type Delta = Counters;

export const ACTIVITIES: readonly Activity[] = ["idle", "thinking", "working", "waiting", "hurt", "sleeping"];
export const TOOL_KINDS: readonly ToolKind[] = ["read", "edit", "bash", "other"];

export const EMPTY_DELTA: Delta = {
  sessions: 0,
  prompts: 0,
  tools: { read: 0, edit: 0, bash: 0, other: 0 },
  filesEdited: 0,
  errors: 0,
};

export function initialSession(now: number): Session {
  return { activity: "idle", since: now, busy: false };
}

export function freshCareer(now: number): Career {
  return { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, hatchedAt: now };
}

export function isEmpty(delta: Delta): boolean {
  return (
    delta.sessions === 0 &&
    delta.prompts === 0 &&
    delta.filesEdited === 0 &&
    delta.errors === 0 &&
    TOOL_KINDS.every((kind) => delta.tools[kind] === 0)
  );
}

export function addDelta(a: Delta, b: Delta): Delta {
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = a.tools[kind] + b.tools[kind];
  return {
    sessions: a.sessions + b.sessions,
    prompts: a.prompts + b.prompts,
    tools,
    filesEdited: a.filesEdited + b.filesEdited,
    errors: a.errors + b.errors,
  };
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
  return {
    corrupt: false,
    career: {
      sessions: num(raw.sessions, 0),
      prompts: num(raw.prompts, 0),
      tools,
      filesEdited: num(raw.filesEdited, 0),
      errors: num(raw.errors, 0),
      hatchedAt: num(raw.hatchedAt, now),
    },
  };
}
