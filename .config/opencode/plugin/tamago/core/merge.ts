import { addDelta, type Career, type Delta } from "./state.ts";

export function merge(career: Career, delta: Delta): Career {
  return { ...addDelta(career, delta), hatchedAt: career.hatchedAt };
}
