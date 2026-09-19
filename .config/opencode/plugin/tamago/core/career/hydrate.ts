import { COUNTER_KEYS, EMPTY_DELTA, TOOL_KINDS, freshCareer, type Career } from "./career.ts";
import type { Rename } from "./name.ts";
import type { Pick, Picks } from "./pick.ts";
import { REFERENCE } from "../creature/catalog.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A stored name, only when both parts are well-formed. */
function rename(value: unknown): Rename | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.value !== "string" || value.value.length === 0) return undefined;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  return { value: value.value, at: value.at };
}

/** A stored Pick, only when both parts are well-formed. */
function pick(value: unknown): Pick | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.trait !== "string" || value.trait.length === 0) return undefined;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  return { trait: value.trait, at: value.at };
}

/** The well-formed entries of a stored `picks`; anything else is dropped silently, never a corruption. */
export function hydratePicks(raw: unknown): Picks {
  if (!isRecord(raw)) return {};
  const out: Picks = {};
  for (const [milestone, value] of Object.entries(raw)) {
    if (milestone.length === 0 || milestone === "__proto__") continue;
    const kept = pick(value);
    if (kept !== undefined) out[milestone] = kept;
  }
  return out;
}

/** A Career read from disk: missing fields take their defaults, an unknown Species is kept verbatim, a non-object is corrupt and gives a fresh egg. */
export function hydrate(raw: unknown, now: number): { career: Career; corrupt: boolean } {
  if (!isRecord(raw)) return { career: freshCareer(now), corrupt: true };
  const rawTools = isRecord(raw.tools) ? raw.tools : {};
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = num(rawTools[kind], 0);
  const name = rename(raw.name);
  const species = typeof raw.species === "string" && raw.species.length > 0 ? raw.species : REFERENCE;
  const career: Career = {
    ...EMPTY_DELTA,
    tools,
    hatchedAt: num(raw.hatchedAt, now),
    species,
    picks: hydratePicks(raw.picks),
    ...(name === undefined ? {} : { name }),
  };
  for (const key of COUNTER_KEYS) career[key] = num(raw[key], 0);
  return { corrupt: false, career };
}
