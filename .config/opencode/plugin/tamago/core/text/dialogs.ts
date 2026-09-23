export const RENAME = { title: "Rename", placeholder: "A name for the creature" };

export function hatchConfirm(name: string): { title: string; message: string } {
  return { title: "Hatch a new egg?", message: `${name} rests in the roster; switch back anytime.` };
}

export const ROSTER_TITLE = "Tamago: roster";

export const LANGUAGE_TITLE = "Language";

/** The hint on the right of a dialog title: OpenCode's Dialog closes on esc. */
export const ESC_HINT = "esc";
