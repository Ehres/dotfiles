import type { Language, Phrase } from "../language.ts";
import { say } from "../language.ts";

export const PALETTE = "Tamago";
export type CommandId = "mute" | "card" | "pet" | "rename" | "hatch" | "roster" | "choose" | "language";
export const COMMAND_IDS: readonly CommandId[] = ["mute", "card", "pet", "rename", "hatch", "roster", "choose", "language"];

const TITLES: Record<CommandId, Phrase> = {
  mute: { en: "toggle bubbles", fr: "bulles on-off" },
  card: { en: "show card", fr: "voir la carte" },
  pet: { en: "pet", fr: "caresser" },
  rename: { en: "rename", fr: "renommer" },
  hatch: { en: "hatch a new egg", fr: "faire éclore un œuf" },
  roster: { en: "roster", fr: "roster" },
  choose: { en: "choose a trait", fr: "choisir un trait" },
  language: { en: "language", fr: "langue" },
};

function description(id: CommandId, who: string, choices: number, language: Language): string {
  switch (id) {
    case "mute":
      return language === "en" ? `Mute or unmute what ${who} says` : `Couper ou rendre la parole à ${who}`;
    case "card":
      return language === "en" ? `Who ${who} is: species, stage, XP, age, stats` : `Qui est ${who} : espèce, stade, XP, âge, stats`;
    case "pet":
      return language === "en" ? `Give ${who} a pat` : `Faire une caresse à ${who}`;
    case "rename":
      return language === "en"
        ? `Give ${who} a new name, shared by every window`
        : `Donner un nouveau nom à ${who}, partagé par toutes les fenêtres`;
    case "hatch":
      return language === "en" ? "Hatch a new egg once every Tamago is elder" : "Faire éclore un œuf quand tous les Tamago sont anciens";
    case "roster":
      return language === "en"
        ? "Every Tamago of this machine; pick one to bring it to the front"
        : "Tous les Tamago de cette machine ; en choisir un pour le mettre devant";
    case "choose":
      if (language === "en") {
        if (choices === 0) return `Nothing to choose for ${who} yet`;
        return choices === 1 ? `One choice waits for ${who}` : `${choices} choices wait for ${who}`;
      }
      if (choices === 0) return `Rien à choisir pour ${who} pour l'instant`;
      return choices === 1 ? `Un choix attend ${who}` : `${choices} choix attendent ${who}`;
    case "language":
      return language === "en" ? "Choose the language everything is read in" : "Choisir la langue dans laquelle tout se lit";
  }
}

/** Filed under PALETTE on purpose: the user searches for the plugin, not for a Name they may change; the Name only appears in the description. */
export function command(id: CommandId, who: string, choices = 0, language: Language = "en"): { name: string; title: string; description: string } {
  return { name: `tamago.${id}`, title: `${PALETTE}: ${say(TITLES[id], language)}`, description: description(id, who, choices, language) };
}
