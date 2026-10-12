/** @jsxImportSource @opentui/solid */
import type { Context } from "@opencode/plugin/tui/context";
import { createEffect, createRoot, type Accessor } from "solid-js";
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
import { ThemeProvider, type Theme } from "../view/theme.tsx";
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

/** The six dialogs of the plugin. Each JSX root posts the theme so no view threads it down. */
export function createDialogs(deps: {
  api: Context;
  theme: Theme;
  store: Store;
  mirror: Mirror;
  actions: Actions;
  clock: Accessor<number>;
  started: number;
  defaultName: string;
  warnCorrupt: () => void;
  guard: Guard;
}): Dialogs {
  const { api, theme, store, mirror, actions, clock, started, defaultName, warnCorrupt, guard } = deps;

  /** OpenCode's own dialogs answer with a promise: `then` runs guarded, and a rejection is logged by the same guard. */
  const answer = <T,>(asked: Promise<T>, then: (value: T) => void): void => {
    asked.then(
      guard(then),
      guard((err: unknown) => {
        throw err;
      }),
    );
  };

  /** The dialog stack wraps the card in OpenCode's own centered Dialog; nothing to position here. */
  const showCard = () => {
    api.ui.dialog.show(() => (
      <ThemeProvider theme={theme}>
        <LanguageProvider language={mirror.language()}>
          <CardView name={mirror.name()} tamago={mirror.active()} clock={clock()} heart={actions.heart()} now={started + clock()} />
        </LanguageProvider>
      </ThemeProvider>
    ));
    api.ui.dialog.set({ size: "xlarge" });
  };

  const askName = () => {
    const asked = api.ui.dialog.prompt({
      title: say(RENAME.title, mirror.language()),
      placeholder: say(RENAME.placeholder, mirror.language()),
      value: mirror.name(),
    });
    answer(asked, (value) => {
      if (value !== undefined) actions.rename(value);
    });
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
    api.ui.dialog.show(() => (
      <ThemeProvider theme={theme}>
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
    api.ui.dialog.set({ size: "xlarge" });
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
      api.ui.toast.show({ variant: "warning", title: mirror.name(), message: blocked(first, defaultName, mirror.language()) });
      return;
    }
    const { title, message } = hatchConfirm(mirror.name(), mirror.language());
    answer(api.ui.dialog.confirm({ title, message }), (confirmed) => {
      if (confirmed === true) actions.lay();
    });
  };

  /**
   * The Draw of the first pending Milestone. It closes itself when another window picks first, and a
   * Pick of ours is never mistaken for theirs: whichever settles first, the select or the watch, the
   * other then stands down.
   */
  const askChoice = () => {
    const first = mirror.active().choices[0];
    if (first === undefined) {
      api.ui.toast.show({ variant: "info", title: mirror.name(), message: say(NOTHING_TO_CHOOSE, mirror.language()) });
      return;
    }
    const milestone = first.milestone.id;
    const language = mirror.language();
    let settled = false;
    createRoot((dispose) => {
      createEffect(() => {
        const offered = mirror.active().choices.some((one) => one.milestone.id === milestone);
        if (offered || settled) return;
        settled = true;
        dispose();
        api.ui.dialog.clear();
        api.ui.toast.show({ variant: "info", title: mirror.name(), message: say(CHOSEN_ELSEWHERE, mirror.language()) });
      });
      const asked = api.ui.dialog.select({
        title: say(CHOOSE.title, language),
        options: first.draw.map((trait) => ({
          title: say(TRAIT_TEXT[trait]?.title ?? { en: trait, fr: trait }, language),
          value: trait,
          description: say(TRAIT_TEXT[trait]?.description ?? { en: "", fr: "" }, language),
        })),
        search: (_query, options) => options,
      });
      answer(asked, (trait) => {
        if (settled) return;
        settled = true;
        dispose();
        if (trait !== undefined) actions.choose(milestone, trait);
      });
    });
  };

  /** The Languages, each named in its own. Two rows today; a select is the shape that survives a third. */
  const askLanguage = () => {
    const asked = api.ui.dialog.select({
      title: say(LANGUAGE_TITLE, mirror.language()),
      options: LANGUAGES.map((one) => ({ title: LANGUAGE_NAME[one], value: one })),
      current: mirror.language(),
      search: (_query, options) => options,
    });
    answer(asked, (value) => {
      if (value !== undefined && isLanguage(value)) actions.setLanguage(value);
    });
  };

  return { showCard, askName, askHatch, showRoster, askChoice, askLanguage };
}
