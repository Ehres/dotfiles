import type { Language } from "../language.ts";
import type { Gender } from "../creature/species.ts";

/** A French word in both genders. Invariable words carry the same string twice: no caller has to know which words agree. */
export type Agreed = { m: string; f: string };

/** A word the user reads, where French agrees in gender and English does not. */
export type Word = { en: string; fr: Agreed };

export function word(w: Word, language: Language, gender: Gender): string {
  return language === "en" ? w.en : w.fr[gender];
}
