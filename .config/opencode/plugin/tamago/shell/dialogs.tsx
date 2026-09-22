/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { createEffect, createMemo, type Accessor } from "solid-js";
import type { Store } from "../adapter/store.ts";
import { blockers, idOf, ordered } from "../core/roster/roster.ts";
import { tamago, type Tamago } from "../core/tamago.ts";
import { RENAME, hatchConfirm } from "../core/text/dialogs.ts";
import { blocked, line } from "../core/text/roster.ts";
import { CHOOSE, CHOSEN_ELSEWHERE, NOTHING_TO_CHOOSE, TRAIT_TEXT } from "../core/text/traits.ts";
import { CardView } from "../view/card.tsx";
import { RosterView } from "../view/roster.tsx";
import { ThemeProvider } from "../view/theme.tsx";
import type { Actions } from "./actions.ts";
import type { Guard } from "./guard.ts";
import type { Mirror } from "./mirror.ts";

export type Dialogs = { showCard(): void; askName(): void; askHatch(): void; showRoster(): void; askChoice(): void };

/** The five dialogs of the plugin. Each root posts the theme so no view threads it down. */
export function createDialogs(deps: {
  api: TuiPluginApi;
  store: Store;
  mirror: Mirror;
  actions: Actions;
  clock: Accessor<number>;
  started: number;
  defaultName: string;
  warnCorrupt: () => void;
  guard: Guard;
}): Dialogs {
  const { api, store, mirror, actions, clock, started, defaultName, warnCorrupt, guard } = deps;

  /** The dialog stack wraps the card in OpenCode's own centered Dialog; nothing to position here. */
  const showCard = () => {
    api.ui.dialog.replace(() => (
      <ThemeProvider theme={api.theme}>
        <CardView name={mirror.name()} tamago={mirror.active()} clock={clock()} heart={actions.heart()} now={started + clock()} />
      </ThemeProvider>
    ));
  };

  const askName = () => {
    api.ui.dialog.replace(() => (
      <api.ui.DialogPrompt
        title={RENAME.title}
        placeholder={RENAME.placeholder}
        value={mirror.name()}
        onConfirm={guard((value: string) => {
          api.ui.dialog.clear();
          actions.rename(value);
        })}
        onCancel={() => api.ui.dialog.clear()}
      />
    ));
  };

  /** The roster dialog: every Tamago of the machine, the highlighted one's card underneath; Enter on a resting one is a Switch. */
  const showRoster = () => {
    const { roster, corrupt } = store.roster();
    if (corrupt) {
      warnCorrupt();
      return;
    }
    const careers = ordered(roster);
    const shown = careers.map((one) => tamago(one));
    const activeId = idOf(roster.active);
    const lines = careers.map((one) => line(one, defaultName, activeId));
    api.ui.dialog.replace(() => (
      <ThemeProvider theme={api.theme}>
        <RosterView
          tamagos={shown}
          lines={lines}
          clock={clock()}
          now={started + clock()}
          onSelect={guard((chosen: Tamago) => {
            api.ui.dialog.clear();
            if (idOf(chosen.career) !== activeId) actions.switchTo(idOf(chosen.career));
          })}
        />
      </ThemeProvider>
    ));
  };

  const askHatch = () => {
    if (!actions.settle()) return;
    const { roster, corrupt } = store.roster();
    if (corrupt) {
      warnCorrupt();
      return;
    }
    const first = blockers(roster)[0];
    if (first !== undefined) {
      api.ui.toast({ variant: "warning", title: mirror.name(), message: blocked(first, defaultName) });
      return;
    }
    const confirm = () => hatchConfirm(mirror.name());
    api.ui.dialog.replace(() => (
      <api.ui.DialogConfirm
        title={confirm().title}
        message={confirm().message}
        onConfirm={guard(() => {
          api.ui.dialog.clear();
          actions.lay();
        })}
        onCancel={() => api.ui.dialog.clear()}
      />
    ));
  };

  /** The Draw of the first pending Milestone. It closes itself when another window picks first, and a Pick of ours is never mistaken for theirs. */
  const askChoice = () => {
    const first = mirror.active().choices[0];
    if (first === undefined) {
      api.ui.toast({ variant: "info", title: mirror.name(), message: NOTHING_TO_CHOOSE });
      return;
    }
    const milestone = first.milestone.id;
    let ours = false;
    api.ui.dialog.replace(() => {
      const offered = createMemo(() => mirror.active().choices.find((one) => one.milestone.id === milestone));
      createEffect(() => {
        if (offered() !== undefined || ours) return;
        api.ui.dialog.clear();
        api.ui.toast({ variant: "info", title: mirror.name(), message: CHOSEN_ELSEWHERE });
      });
      return (
        <api.ui.DialogSelect
          title={CHOOSE.title}
          skipFilter
          options={(offered()?.draw ?? []).map((trait) => ({
            title: TRAIT_TEXT[trait]?.title ?? trait,
            value: trait,
            description: TRAIT_TEXT[trait]?.description ?? "",
          }))}
          onSelect={guard((option: { value: string }) => {
            ours = true;
            api.ui.dialog.clear();
            actions.choose(milestone, option.value);
          })}
        />
      );
    });
  };

  return { showCard, askName, askHatch, showRoster, askChoice };
}
