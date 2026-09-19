import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { COMMAND_IDS, PALETTE, command, type CommandId } from "../core/text/commands.ts";
import type { Actions } from "./actions.ts";
import type { Dialogs } from "./dialogs.tsx";
import type { Guard } from "./guard.ts";
import type { Mirror } from "./mirror.ts";

/** The six palette commands. `register` is called again after a rename or a Switch: the descriptions carry the Name and are fixed at registration. */
export function createPalette(deps: {
  api: TuiPluginApi;
  mirror: Mirror;
  actions: Actions;
  dialogs: Dialogs;
  guard: Guard;
}): { register(): void; dispose(): void } {
  const { api, mirror, actions, dialogs, guard } = deps;

  const RUN: Record<CommandId, () => void> = {
    mute: () => actions.setMute(!mirror.muted()),
    card: dialogs.showCard,
    pet: actions.pet,
    rename: dialogs.askName,
    hatch: dialogs.askHatch,
    roster: dialogs.showRoster,
  };

  let unregisterCommands: (() => void) | undefined;
  return {
    register(): void {
      unregisterCommands?.();
      const who = mirror.name();
      unregisterCommands = api.keymap.registerLayer({
        commands: COMMAND_IDS.map((id) => ({
          ...command(id, who),
          category: PALETTE,
          /** What lists a command in the palette; OpenCode's own commands carry it. */
          namespace: "palette",
          run: guard(RUN[id]),
        })),
      });
    },
    dispose(): void {
      unregisterCommands?.();
    },
  };
}
