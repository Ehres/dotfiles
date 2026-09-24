import { species } from "../creature/species.ts";
import { stage } from "../career/stage.ts";
import type { Career } from "../career/career.ts";
import type { Language } from "../language.ts";
import { say } from "../language.ts";
import { idOf, type CareerId } from "../roster/roster.ts";
import { ACTIVE, STAGE_TEXT } from "./tables.ts";
import { word } from "./word.ts";

/** The Name shown for a Career; `fallback` is the plugin's default Name. */
export function nameOf(career: Career, fallback: string): string {
  return career.name?.value ?? fallback;
}

/** The refusal when a Hatch is blocked. */
export function blocked(first: Career, fallback: string, language: Language): string {
  const who = nameOf(first, fallback);
  const gender = species(first.species).gender;
  const stageOf = word(STAGE_TEXT[stage(first)], language, gender);
  switch (language) {
    case "en":
      return stage(first) === "egg"
        ? `${who} is still an egg. Hatch when every Tamago is elder.`
        : `${who} is still ${stageOf}. Hatch when every Tamago is elder.`;
    case "fr":
      // "encore un œuf" takes an article where "encore jeune" does not.
      return stage(first) === "egg"
        ? `${who} est encore un œuf. Une éclosion demande que tous soient anciens.`
        : `${who} est encore ${stageOf}. Une éclosion demande que tous soient anciens.`;
  }
}

/** The toast when another Career becomes active, whether this window caused it or learned it at a Flush. */
export function stepsIn(career: Career, fallback: string, language: Language): string {
  const isEgg = stage(career) === "egg";
  switch (language) {
    case "en":
      return isEgg ? "A new egg." : `${nameOf(career, fallback)} steps in.`;
    case "fr":
      return isEgg ? "Un nouvel œuf." : `${nameOf(career, fallback)} prend la place.`;
  }
}

/** One line of the roster view: Name, Species label and Stage; an egg shows its Stage alone; the active one says so. */
export function line(career: Career, fallback: string, activeId: CareerId, language: Language): string {
  const who = nameOf(career, fallback);
  const stageId = stage(career);
  const gender = species(career.species).gender;
  const stageWord = word(STAGE_TEXT[stageId], language, gender);
  const parts = stageId === "egg" ? [who, stageWord] : [who, say(species(career.species).label, language), stageWord];
  if (idOf(career) === activeId) parts.push(word(ACTIVE, language, gender));
  return parts.join(" · ");
}
