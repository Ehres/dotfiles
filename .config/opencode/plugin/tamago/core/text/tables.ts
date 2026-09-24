import type { Language, Phrase } from "../language.ts";
import type { StageId } from "../career/stage.ts";
import type { Rarity } from "../creature/species.ts";
import type { BehaviorStat, Temperament } from "../creature/sheet.ts";
import type { Craft, Stance } from "../creature/character.ts";
import type { Gender } from "../creature/species.ts";
import type { Word } from "./word.ts";

/** Each Language named in its own Language, so the list reads for whoever opens it. Never translated. */
export const LANGUAGE_NAME: Record<Language, string> = { en: "English", fr: "Français" };

export const STAGE_TEXT: Record<StageId, Word> = {
  egg: { en: "egg", fr: { m: "œuf", f: "œuf" } },
  hatchling: { en: "hatchling", fr: { m: "nouveau-né", f: "nouveau-née" } },
  young: { en: "young", fr: { m: "jeune", f: "jeune" } },
  adult: { en: "adult", fr: { m: "adulte", f: "adulte" } },
  elder: { en: "elder", fr: { m: "ancien", f: "ancienne" } },
};

export const RARITY_TEXT: Record<Rarity, Word> = {
  common: { en: "common", fr: { m: "commun", f: "commune" } },
  uncommon: { en: "uncommon", fr: { m: "peu commun", f: "peu commune" } },
  rare: { en: "rare", fr: { m: "rare", f: "rare" } },
  epic: { en: "epic", fr: { m: "épique", f: "épique" } },
  legendary: { en: "legendary", fr: { m: "légendaire", f: "légendaire" } },
};

export const STAT_TEXT: Record<BehaviorStat, Phrase> = {
  energy: { en: "energy", fr: "énergie" },
  chatter: { en: "chatter", fr: "bavardage" },
  sensitivity: { en: "sensitivity", fr: "sensibilité" },
  patience: { en: "patience", fr: "patience" },
};

export const TEMPERAMENT_TEXT: Record<Temperament, Phrase> = {
  cheerful: { en: "cheerful", fr: "enjoué" },
  sarcastic: { en: "sarcastic", fr: "sarcastique" },
  stoic: { en: "stoic", fr: "stoïque" },
  dreamy: { en: "dreamy", fr: "rêveur" },
};

/** The Craft carries the gender of its French noun, because the Stance agrees with it. */
export const CRAFT_TEXT: Record<Craft, { text: Phrase; gender: Gender }> = {
  scribe: { text: { en: "scribe", fr: "scribe" }, gender: "m" },
  shell: { text: { en: "shell", fr: "mécano" }, gender: "m" },
  sage: { text: { en: "sage", fr: "érudit" }, gender: "m" },
};

export const STANCE_TEXT: Record<Stance, Word> = {
  prudent: { en: "prudent", fr: { m: "prudent", f: "prudente" } },
  bold: { en: "bold", fr: { m: "audacieux", f: "audacieuse" } },
};
