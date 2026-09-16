import { latest } from "./name.ts";
import { addDelta, type Career, type Delta } from "./state.ts";

/** Counters add up, hatchedAt and species are kept, the latest rename wins, the earliest Pick per Milestone wins; a Career never carries a pending `rename`. */
export function merge(career: Career, delta: Delta): Career {
  const { rename: _pending, picks = career.picks, ...counters } = addDelta(career, delta);
  const name = latest(career.name, delta.rename);
  return { ...counters, hatchedAt: career.hatchedAt, species: career.species, picks, ...(name === undefined ? {} : { name }) };
}
