import type { Character } from "../creature/character.ts";
import type { Language } from "../language.ts";
import { say } from "../language.ts";
import { CRAFT_TEXT, STANCE_TEXT, TEMPERAMENT_TEXT } from "./tables.ts";
import { word } from "./word.ts";

/** "sarcastic · prudent shell" / "sarcastique · mécano prudent", or the Temperament alone before young. */
export function describe(character: Character, language: Language): string {
  const temperament = say(TEMPERAMENT_TEXT[character.temperament], language);
  const vocation = character.vocation;
  if (vocation === undefined) return temperament;
  const craft = CRAFT_TEXT[vocation.craft];
  const stance = word(STANCE_TEXT[vocation.stance], language, craft.gender);
  const named = say(craft.text, language);
  // English puts the adjective before the noun, French after it.
  return language === "en" ? `${temperament} · ${stance} ${named}` : `${temperament} · ${named} ${stance}`;
}
