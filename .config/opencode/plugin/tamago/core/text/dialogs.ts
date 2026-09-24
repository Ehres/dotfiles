import type { Language } from "../language.ts";

export const RENAME = { title: "Rename", placeholder: "A name for the creature" };

export function hatchConfirm(name: string, language: Language = "en"): { title: string; message: string } {
  switch (language) {
    case "en":
      return { title: "Hatch a new egg?", message: `${name} rests in the roster; switch back anytime.` };
    case "fr":
      return { title: "Faire éclore un œuf ?", message: `${name} passe au roster ; on peut y revenir quand on veut.` };
  }
}

export const ROSTER_TITLE = "Tamago: roster";

export const LANGUAGE_TITLE = "Language";

/** The hint on the right of a dialog title: OpenCode's Dialog closes on esc. */
export const ESC_HINT = "esc";
