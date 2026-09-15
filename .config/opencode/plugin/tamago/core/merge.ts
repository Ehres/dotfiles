import { latest } from "./name.ts";
import { addDelta, type Career, type Delta } from "./state.ts";

/** Counters add up, hatchedAt is kept, the latest rename wins; a Career never carries a pending `rename`. */
export function merge(career: Career, delta: Delta): Career {
  const { rename: _pending, ...counters } = addDelta(career, delta);
  const name = latest(career.name, delta.rename);
  return { ...counters, hatchedAt: career.hatchedAt, ...(name === undefined ? {} : { name }) };
}
