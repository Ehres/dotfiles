import { LUCK_POINTS } from "../creature/luck.ts";
import { species } from "../creature/species.ts";
import { stage } from "../career/stage.ts";
import type { Career } from "../career/career.ts";

/** Every Career of the machine: the active one, then the resting ones. */
export type Roster = { active: Career; resting: readonly Career[] };

/** The identity of a Career on this machine: its hatch date in milliseconds. Two Careers never hatch in the same millisecond, since a Hatch needs the whole Roster to be elder. */
export type CareerId = number;

export function idOf(career: Career): CareerId {
  return career.hatchedAt;
}

/** A Tamago below elder. At most one per machine: that is what keeps a Hatch rare. */
export function growing(career: Career): boolean {
  return stage(career) !== "elder";
}

/** The Careers that block a Hatch, the active one first. Empty means a Hatch is allowed. */
export function blockers(roster: Roster): Career[] {
  return [roster.active, ...roster.resting].filter(growing);
}

/** The Careers a Switch may bring to the front: the resting ones, by hatch date. */
export function switchable(roster: Roster): Career[] {
  return [...roster.resting].sort((a, b) => a.hatchedAt - b.hatchedAt);
}

/**
 * The Luck of a Hatch: the points of every `elder` among `careers`, by
 * Rarity. At a Hatch the whole Roster is elder by the gate, so this is the
 * list of Species raised to the end; the filter keeps the function true on
 * its own. Recomputed at every Hatch from the disk, never stored.
 */
export function luck(careers: readonly Career[]): number {
  return careers.filter((career) => !growing(career)).reduce((sum, career) => sum + LUCK_POINTS[species(career.species).rarity], 0);
}

/** Every Career of the Roster in display order: the active one, then the resting ones by hatch date. */
export function ordered(roster: Roster): Career[] {
  return [roster.active, ...switchable(roster)];
}

export type RosterAction = "up" | "down" | "select";

/** The keys of the roster view by opentui key name. Changing a key means changing this table, never the view. */
export const ROSTER_KEYS: Readonly<Record<string, RosterAction>> = {
  up: "up",
  k: "up",
  down: "down",
  j: "down",
  return: "select",
};

export function rosterAction(key: string): RosterAction | undefined {
  return ROSTER_KEYS[key];
}

/** The cursor after a move, kept inside [0, count − 1]; it never wraps. */
export function step(cursor: number, action: "up" | "down", count: number): number {
  const moved = action === "up" ? cursor - 1 : cursor + 1;
  return Math.min(Math.max(moved, 0), Math.max(count - 1, 0));
}
