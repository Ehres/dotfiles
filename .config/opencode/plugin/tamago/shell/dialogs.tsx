/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { createEffect, createMemo, type Accessor } from "solid-js";
import type { Store } from "../adapter/store.ts";
import { isLanguage, LANGUAGES, say } from "../core/language.ts";
import { blockers, idOf, ordered } from "../core/roster/roster.ts";
import { tamago, type Tamago } from "../core/tamago.ts";
import { LANGUAGE_TITLE, RENAME, hatchConfirm } from "../core/text/dialogs.ts";
import { blocked, line } from "../core/text/roster.ts";
import { LANGUAGE_NAME } from "../core/text/tables.ts";
import { CHOOSE, CHOSEN_ELSEWHERE, NOTHING_TO_CHOOSE, TRAIT_TEXT } from "../core/text/traits.ts";
import { CardView } from "../view/card.tsx";
import { LanguageProvider } from "../view/language.tsx";
import { RosterView } from "../view/roster.tsx";
import { ThemeProvider } from "../view/theme.tsx";
import type { Actions } from "./actions.ts";
import type { Guard } from "./guard.ts";
import type { Mirror } from "./mirror.ts";

export type Dialogs = {
  showCard(): void;
  askName(): void;
  askHatch(): void;
  showRoster(): void;
  askChoice(): void;
  askLanguage(): void;
};

/** The six dialogs of the plugin. Each root posts the theme so no view threads it down. */
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
        <LanguageProvider language={mirror.language()}>
          <CardView name={mirror.name()} tamago={mirror.active()} clock={clock()} heart={actions.heart()} now={started + clock()} />
        </LanguageProvider>
      </ThemeProvider>
    ));
  };

  const askName = () => {
    api.ui.dialog.replace(() => (
      <api.ui.DialogPrompt
        title={say(RENAME.title, mirror.language())}
        placeholder={say(RENAME.placeholder, mirror.language())}
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
    const lines = careers.map((one) => line(one, defaultName, activeId, mirror.language()));
    api.ui.dialog.replace(() => (
      <ThemeProvider theme={api.theme}>
        <LanguageProvider language={mirror.language()}>
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
        </LanguageProvider>
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
      api.ui.toast({ variant: "warning", title: mirror.name(), message: blocked(first, defaultName, mirror.language()) });
      return;
    }
    const confirm = () => hatchConfirm(mirror.name(), mirror.language());
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
      api.ui.toast({ variant: "info", title: mirror.name(), message: say(NOTHING_TO_CHOOSE, mirror.language()) });
      return;
    }
    const milestone = first.milestone.id;
    let ours = false;
    api.ui.dialog.replace(() => {
      const offered = createMemo(() => mirror.active().choices.find((one) => one.milestone.id === milestone));
      createEffect(() => {
        if (offered() !== undefined || ours) return;
        api.ui.dialog.clear();
        api.ui.toast({ variant: "info", title: mirror.name(), message: say(CHOSEN_ELSEWHERE, mirror.language()) });
      });
      return (
        <api.ui.DialogSelect
          title={say(CHOOSE.title, mirror.language())}
          skipFilter
          options={(offered()?.draw ?? []).map((trait) => ({
            title: say(TRAIT_TEXT[trait]?.title ?? { en: trait }, mirror.language()),
            value: trait,
            description: say(TRAIT_TEXT[trait]?.description ?? { en: "" }, mirror.language()),
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

  /** The Languages, each named in its own. Two rows today; a select is the shape that survives a third. */
  const askLanguage = () => {
    api.ui.dialog.replace(() => (
      <api.ui.DialogSelect
        title={say(LANGUAGE_TITLE, mirror.language())}
        skipFilter
        options={LANGUAGES.map((one) => ({ title: LANGUAGE_NAME[one], value: one }))}
        onSelect={guard((option: { value: string }) => {
          api.ui.dialog.clear();
          if (isLanguage(option.value)) actions.setLanguage(option.value);
        })}
      />
    ));
  };

  return { showCard, askName, askHatch, showRoster, askChoice, askLanguage };
}
