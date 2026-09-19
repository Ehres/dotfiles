import { species } from "../creature/species.ts";
import { stage } from "../career/stage.ts";
import type { Career } from "../career/career.ts";
import { idOf, type CareerId } from "../roster/roster.ts";

/** The Name shown for a Career; `fallback` is the plugin's default Name. */
export function nameOf(career: Career, fallback: string): string {
  return career.name?.value ?? fallback;
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

/** One line of the roster view: Name, Species label and Stage; an egg shows its Stage alone; the active one says so. */
export function line(career: Career, fallback: string, activeId: CareerId): string {
  const who = nameOf(career, fallback);
  const stageOf = stage(career);
  const parts = stageOf === "egg" ? [who, stageOf] : [who, species(career.species).label, stageOf];
  if (idOf(career) === activeId) parts.push("active");
  return parts.join(" · ");
}
