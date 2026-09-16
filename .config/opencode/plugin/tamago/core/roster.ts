import type { Career } from "./state.ts";

/** Every Career of the machine: the active one, then the resting ones. */
export type Roster = { active: Career; resting: readonly Career[] };

/** The identity of a Career on this machine: its hatch date in milliseconds. Two Careers never hatch in the same millisecond, since a Hatch needs the whole Roster to be elder. */
export type CareerId = number;

export function idOf(career: Career): CareerId {
  return career.hatchedAt;
}
