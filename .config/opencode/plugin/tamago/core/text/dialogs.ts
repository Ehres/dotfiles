import type { Language, Phrase } from "../language.ts";

export const RENAME: { title: Phrase; placeholder: Phrase } = {
  title: { en: "Rename", fr: "Renommer" },
  placeholder: { en: "A name for the creature", fr: "Un nom pour la créature" },
};

export function hatchConfirm(name: string, language: Language): { title: string; message: string } {
  switch (language) {
    case "en":
      return { title: "Hatch a new egg?", message: `${name} rests in the roster; switch back anytime.` };
    case "fr":
      return { title: "Faire éclore un œuf ?", message: `${name} passe au roster ; on peut y revenir quand on veut.` };
  }
}

export const ROSTER_TITLE: Phrase = { en: "Tamago: roster", fr: "Tamago : roster" };

export const LANGUAGE_TITLE: Phrase = { en: "Language", fr: "Langue" };

/** The hint on the right of a dialog title: OpenCode's Dialog closes on esc. */
export const ESC_HINT = "esc";
