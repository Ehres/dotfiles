import type { Context } from "@opencode/plugin/tui/context";
import { COMMAND_IDS, PALETTE, command, type CommandId } from "../core/text/commands.ts";
import type { Actions } from "./actions.ts";
import type { Dialogs } from "./dialogs.tsx";
import type { Guard } from "./guard.ts";
import type { Mirror } from "./mirror.ts";

/**
 * The eight palette commands, in one keymap layer. The layer is reactive: its
 * descriptions carry the Name, the choice count and the Language, and OpenCode
 * re-reads the factory whenever one of them changes. The layer goes when the
 * plugin is disabled or reloaded.
 */
export function registerPalette(deps: { api: Context; mirror: Mirror; actions: Actions; dialogs: Dialogs; guard: Guard }): void {
  const { api, mirror, actions, dialogs, guard } = deps;

  const RUN: Record<CommandId, () => void> = {
    mute: () => actions.setMute(!mirror.muted()),
    card: dialogs.showCard,
    pet: actions.pet,
    rename: dialogs.askName,
    hatch: dialogs.askHatch,
    roster: dialogs.showRoster,
    choose: dialogs.askChoice,
    language: dialogs.askLanguage,
  };

  api.keymap.layer(() => {
    const who = mirror.name();
    const choices = mirror.active().choices.length;
    const language = mirror.language();
    return {
      // The palette is its own input mode: a layer left in the default `base` mode is unreachable from it.
      mode: "global",
      commands: COMMAND_IDS.map((id) => {
        const { name, title, description } = command(id, who, choices, language);
        return { id: name, title, description, group: PALETTE, palette: true, run: guard(RUN[id]) };
      }),
    };
  });
}
