export const PALETTE = "Tamago";
export type CommandId = "mute" | "card" | "pet" | "rename" | "hatch" | "roster";
export const COMMAND_IDS: readonly CommandId[] = ["mute", "card", "pet", "rename", "hatch", "roster"];

const TITLES: Record<CommandId, string> = {
  mute: "toggle bubbles",
  card: "show card",
  pet: "pet",
  rename: "rename",
  hatch: "hatch a new egg",
  roster: "roster",
};

function description(id: CommandId, who: string): string {
  switch (id) {
    case "mute":
      return `Mute or unmute what ${who} says`;
    case "card":
      return `Who ${who} is: species, stage, XP, age, stats`;
    case "pet":
      return `Give ${who} a pat`;
    case "rename":
      return `Give ${who} a new name, shared by every window`;
    case "hatch":
      return "Hatch a new egg once every Tamago is elder";
    case "roster":
      return "Every Tamago of this machine; pick one to bring it to the front";
  }
}

/** Filed under PALETTE on purpose: the user searches for the plugin, not for a Name they may change; the Name only appears in the description. */
export function command(id: CommandId, who: string): { name: string; title: string; description: string } {
  return { name: `tamago.${id}`, title: `${PALETTE}: ${TITLES[id]}`, description: description(id, who) };
}
