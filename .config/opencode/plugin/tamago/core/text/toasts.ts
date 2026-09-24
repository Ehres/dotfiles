import type { StageId } from "../career/stage.ts";
import type { Language } from "../language.ts";
import { STAGE_TEXT } from "./tables.ts";
import { word } from "./word.ts";

export const CORRUPT = "Saved progress was unreadable. It is kept aside as career.json.corrupt-*; starting from a fresh egg.";
export const BUSY = "Another window is writing. Try again.";
export const GONE = "That Tamago is gone from the roster.";

/** The Stage word has no gender to agree with here: evolved() is not handed the Species, so it reads masculine. */
export function evolved(name: string, stage: StageId, language: Language = "en"): string {
  const stageWord = word(STAGE_TEXT[stage], language, "m");
  switch (language) {
    case "en":
      return `${name} evolved: ${stageWord}!`;
    case "fr":
      return `${name} évolue : ${stageWord} !`;
  }
}

export function cannotSave(name: string, dir: string, language: Language = "en"): string {
  switch (language) {
    case "en":
      return `${name} cannot save its progress. See ${dir}/error.log.`;
    case "fr":
      return `${name} n'arrive pas à enregistrer sa progression. Voir ${dir}/error.log.`;
  }
}
