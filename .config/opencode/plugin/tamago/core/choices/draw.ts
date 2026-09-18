import { MILESTONES, reached, type Milestone } from "./milestone.ts";
import type { MilestoneId, TraitId } from "../career/pick.ts";
import type { Career } from "../career/career.ts";
import { TRAITS, eligible, type Trait } from "./trait.ts";
import { generator, seed } from "../creature/random.ts";

/** How many Traits a Draw offers at most. */
export const DRAW_SIZE = 3;

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
