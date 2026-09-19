import { SPECIES } from "../creature/catalog.ts";
import { weightsAt } from "../creature/luck.ts";
import { hatch, type Rarity, type SpeciesId } from "../creature/species.ts";
import { latest, type Rename } from "./name.ts";
import { firstPicks, samePicks, type Picks } from "./pick.ts";

export type ToolKind = "read" | "edit" | "bash" | "other";

export type Counters = {
  sessions: number;
  prompts: number;
  tools: Record<ToolKind, number>;
  filesEdited: number;
  errors: number;
  questions: number;
};

/** `species` is drawn at hatch and never changes. `name` is absent until the user renames the creature; the plugin option is the default. `picks` is always present, `{}` until the first Pick. */
export type Career = Counters & { hatchedAt: number; species: SpeciesId; name?: Rename; picks: Picks };
/** `rename` and `picks` are Deltas like any other: they wait for the flush; the latest rename wins, the earliest Pick wins. */
export type Delta = Counters & { rename?: Rename; picks?: Picks };

export const TOOL_KINDS: readonly ToolKind[] = ["read", "edit", "bash", "other"];

/** Every plain numeric counter. Adding one to `Counters` without listing it here is a type error, and listing it is all it takes. */
export const COUNTER_KEYS = ["sessions", "prompts", "filesEdited", "errors", "questions"] as const satisfies readonly (keyof Counters)[];
type PlainCounter = (typeof COUNTER_KEYS)[number];
const _everyCounterListed: Exclude<Exclude<keyof Counters, "tools">, PlainCounter> extends never ? true : never = true;

/** Every key a Career may carry on disk. The store keeps any other key verbatim, so a newer build's data survives an older build's flush. */
export const CAREER_KEYS = [...COUNTER_KEYS, "tools", "hatchedAt", "species", "name", "picks"] as const satisfies readonly (keyof Career)[];
const _everyCareerKeyListed: Exclude<keyof Career, (typeof CAREER_KEYS)[number]> extends never ? true : never = true;

export const EMPTY_DELTA: Delta = {
  sessions: 0,
  prompts: 0,
  tools: { read: 0, edit: 0, bash: 0, other: 0 },
  filesEdited: 0,
  errors: 0,
  questions: 0,
};

/** A new egg at `now`: its Species drawn once, at `weights`, those of a first egg unless the store passes the Roster's Luck. */
export function freshCareer(now: number, weights: Record<Rarity, number> = weightsAt(0)): Career {
  return { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, hatchedAt: now, species: hatch(now, SPECIES, weights), picks: {} };
}

export function isEmpty(delta: Delta): boolean {
  return (
    delta.rename === undefined &&
    (delta.picks === undefined || Object.keys(delta.picks).length === 0) &&
    COUNTER_KEYS.every((key) => delta[key] === 0) &&
    TOOL_KINDS.every((kind) => delta.tools[kind] === 0)
  );
}

/** The counters of `a` and `b` added up. */
function addCounters(a: Counters, b: Counters): Counters {
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = a.tools[kind] + b.tools[kind];
  const out: Counters = { ...EMPTY_DELTA, tools };
  for (const key of COUNTER_KEYS) out[key] = a[key] + b[key];
  return out;
}

export function addDelta(a: Delta, b: Delta): Delta {
  const rename = latest(a.rename, b.rename);
  const picks = firstPicks(a.picks ?? {}, b.picks ?? {});
  return {
    ...addCounters(a, b),
    ...(rename === undefined ? {} : { rename }),
    ...(Object.keys(picks).length === 0 ? {} : { picks }),
  };
}

/** Counters add up, hatchedAt and species are kept, the latest rename wins, the earliest Pick per Milestone wins; a Career never carries a pending `rename`. */
export function merge(career: Career, delta: Delta): Career {
  const { rename: _pending, picks = career.picks, ...counters } = addDelta(career, delta);
  const name = latest(career.name, delta.rename);
  return { ...counters, hatchedAt: career.hatchedAt, species: career.species, picks, ...(name === undefined ? {} : { name }) };
}

/** Structural equality, so a re-read of unchanged disk state does not notify anyone. */
export function sameCareer(a: Career, b: Career): boolean {
  return (
    a.hatchedAt === b.hatchedAt &&
    a.species === b.species &&
    a.name?.value === b.name?.value &&
    a.name?.at === b.name?.at &&
    COUNTER_KEYS.every((key) => a[key] === b[key]) &&
    TOOL_KINDS.every((kind) => a.tools[kind] === b.tools[kind]) &&
    samePicks(a.picks, b.picks)
  );
}
