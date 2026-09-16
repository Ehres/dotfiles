import { age, speciesLine } from "./card.ts";
import { stage } from "./stage.ts";
import type { Career } from "./state.ts";

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

/** The Name shown for a Career; `fallback` is the plugin's default Name. */
function nameOf(career: Career, fallback: string): string {
  return career.name?.value ?? fallback;
}

/** One line of the switch dialog. An egg does not tell its Species, so its line skips the Stage too. */
export function entry(career: Career, fallback: string, now: number): string {
  const who = nameOf(career, fallback);
  const when = age(career.hatchedAt, now);
  if (stage(career) === "egg") return `${who} · ${speciesLine(career)} · ${when}`;
  return `${who} · ${speciesLine(career)} · ${stage(career)} · ${when}`;
}

/** The refusal when a Hatch is blocked. */
export function blocked(first: Career, fallback: string): string {
  const who = nameOf(first, fallback);
  const stageOf = stage(first);
  return stageOf === "egg"
    ? `${who} is still an egg. Hatch when every Tamago is elder.`
    : `${who} is still ${stageOf}. Hatch when every Tamago is elder.`;
}

/** The toast when another Career becomes active, whether this window caused it or learned it at a Flush. */
export function stepsIn(career: Career, fallback: string): string {
  return stage(career) === "egg" ? "A new egg." : `${nameOf(career, fallback)} steps in.`;
}
