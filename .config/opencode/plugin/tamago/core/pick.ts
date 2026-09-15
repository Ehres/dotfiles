export type MilestoneId = string;
export type TraitId = string;

/** A Pick: the Trait kept at a Milestone and when it was decided, so the earliest wins across windows. */
export type Pick = { trait: TraitId; at: number };
/** At most one Pick per Milestone. */
export type Picks = Record<MilestoneId, Pick>;

/** The earlier of two Picks; on a tie the smaller trait id, so the choice is commutative. Mirror of `latest()` in name.ts. */
export function first(a: Pick | undefined, b: Pick | undefined): Pick | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (a.at !== b.at) return a.at < b.at ? a : b;
  return a.trait <= b.trait ? a : b;
}

/** Union by Milestone, `first` on every shared key. Returns `a` itself when `b` changes nothing, so signals see no change. */
export function firstPicks(a: Picks, b: Picks): Picks {
  let changed = false;
  const out: Picks = { ...a };
  for (const [milestone, pick] of Object.entries(b)) {
    const held = a[milestone];
    const kept = first(held, pick);
    if (kept === undefined || kept === held) continue; // `first` returns `held` itself on an equal Pick
    out[milestone] = kept;
    changed = true;
  }
  return changed ? out : a;
}

/** Structural equality over every Milestone. */
export function samePicks(a: Picks, b: Picks): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((milestone) => {
    const x = a[milestone];
    const y = b[milestone];
    return x !== undefined && y !== undefined && x.trait === y.trait && x.at === y.at;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    if (milestone.length === 0) continue;
    const kept = pick(value);
    if (kept !== undefined) out[milestone] = kept;
  }
  return out;
}
