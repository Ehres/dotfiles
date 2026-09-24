import type { StageId } from "../career/stage.ts";
import type { Gender } from "../creature/species.ts";
import type { Language } from "../language.ts";
import { STAGE_TEXT } from "./tables.ts";
import { word } from "./word.ts";

export const CORRUPT = "Saved progress was unreadable. It is kept aside as career.json.corrupt-*; starting from a fresh egg.";
export const BUSY = "Another window is writing. Try again.";
export const GONE = "That Tamago is gone from the roster.";

/** `gender` agrees the Stage word in French; the caller passes the Species' gender, masculine when there is none to read. */
export function evolved(name: string, stage: StageId, language: Language = "en", gender: Gender = "m"): string {
  const stageWord = word(STAGE_TEXT[stage], language, gender);
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
