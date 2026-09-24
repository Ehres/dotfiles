import type { StageId } from "../career/stage.ts";
import type { Gender } from "../creature/species.ts";
import type { Language, Phrase } from "../language.ts";
import { STAGE_TEXT } from "./tables.ts";
import { word } from "./word.ts";

export const CORRUPT: Phrase = {
  en: "Saved progress was unreadable. It is kept aside as career.json.corrupt-*; starting from a fresh egg.",
  fr: "La progression enregistrée était illisible. Elle est mise de côté en career.json.corrupt-* ; on repart d'un œuf.",
};
export const BUSY: Phrase = { en: "Another window is writing. Try again.", fr: "Une autre fenêtre écrit. Réessaie." };
export const GONE: Phrase = { en: "That Tamago is gone from the roster.", fr: "Ce Tamago n'est plus au roster." };

/** `gender` agrees the Stage word in French; the caller passes the Species' gender, masculine when there is none to read. */
export function evolved(name: string, stage: StageId, gender: Gender, language: Language): string {
  const stageWord = word(STAGE_TEXT[stage], language, gender);
  switch (language) {
    case "en":
      return `${name} evolved: ${stageWord}!`;
    case "fr":
      return `${name} évolue : ${stageWord} !`;
  }
}

export function cannotSave(name: string, dir: string, language: Language): string {
  switch (language) {
    case "en":
      return `${name} cannot save its progress. See ${dir}/error.log.`;
    case "fr":
      return `${name} n'arrive pas à enregistrer sa progression. Voir ${dir}/error.log.`;
  }
}
