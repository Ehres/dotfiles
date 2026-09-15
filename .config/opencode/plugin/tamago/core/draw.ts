import { MILESTONES, reached, type Milestone } from "./milestone.ts";
import type { MilestoneId, TraitId } from "./pick.ts";
import type { Career } from "./state.ts";
import { TRAITS, eligible, type Trait } from "./trait.ts";

/** How many Traits a Draw offers at most. */
export const DRAW_SIZE = 3;

/**
 * FNV-1a 32-bit over `${hatchedAt}:${milestone}`: the same in every window of
 * this machine. Never change the formula once shipped: every pending Draw on
 * every machine would change.
 */
export function seed(hatchedAt: number, milestone: MilestoneId): number {
  let h = 0x811c9dc5;
  for (const char of `${hatchedAt}:${milestone}`) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small deterministic generator of numbers in [0, 1). */
function generator(state: number): () => number {
  let s = state >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The eligible Traits, shuffled by `seed`, cut to DRAW_SIZE. Empty when nothing is eligible. */
export function draw(career: Career, milestone: MilestoneId, table: readonly Trait[] = TRAITS): TraitId[] {
  const pool = eligible(career, table);
  const random = generator(seed(career.hatchedAt, milestone));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = pool[i];
    const b = pool[j];
    if (a !== undefined && b !== undefined) {
      pool[i] = b;
      pool[j] = a;
    }
  }
  return pool.slice(0, DRAW_SIZE);
}

export type Pending = { milestone: Milestone; draw: TraitId[] };

/** Reached Milestones without a Pick whose Draw is not empty, with that Draw, in table order. A Milestone can never block the queue. */
export function pending(
  career: Career,
  milestones: readonly Milestone[] = MILESTONES,
  table: readonly Trait[] = TRAITS,
): Pending[] {
  const out: Pending[] = [];
  for (const milestone of reached(career, milestones)) {
    if (career.picks[milestone.id] !== undefined) continue;
    const offered = draw(career, milestone.id, table);
    if (offered.length > 0) out.push({ milestone, draw: offered });
  }
  return out;
}
