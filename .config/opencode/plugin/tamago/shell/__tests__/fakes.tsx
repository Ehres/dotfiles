import type { Context, DialogSelectOptions } from "@opencode/plugin/tui/context";
import type { JSX } from "@opentui/solid";
import type { Prefs } from "../actions.ts";

export type Toast = { variant?: string; title?: string; message: string };
/** The latest select OpenCode was asked for, and how to answer it the way a person picking an option would. */
export type Select = { options: DialogSelectOptions<string>; answer(value: string | undefined): void };

/**
 * The slice of the plugin context these tests touch: toasts and the dialog
 * stack. Everything else is left undefined on purpose, so a test that needs
 * more has to say so. `select` exposes the latest select, still open, so a
 * test can answer it; clearing the dialog answers it with nothing, as
 * OpenCode does.
 */
export function fakeApi(): {
  api: Context;
  toasts: Toast[];
  shown: () => (() => JSX.Element) | undefined;
  select: () => Select | undefined;
} {
  const toasts: Toast[] = [];
  let node: (() => JSX.Element) | undefined;
  let selected: Select | undefined;
  const clear = () => {
    node = undefined;
    const open = selected;
    selected = undefined;
    open?.answer(undefined);
  };
  const api = {
    ui: {
      toast: { show: (input: Toast) => toasts.push(input) },
      dialog: {
        show: (next: () => JSX.Element) => {
          clear();
          node = next;
        },
        set: () => {},
        clear,
        select: (options: DialogSelectOptions<string>) =>
          new Promise<string | undefined>((resolve) => {
            clear();
            selected = {
              options,
              answer: (value) => {
                if (selected?.options === options) selected = undefined;
                resolve(value);
              },
            };
          }),
      },
    },
  } as unknown as Context;
  return { api, toasts, shown: () => node, select: () => selected };
}

/** Preferences as OpenCode's plugin storage would keep them: `save` applies the mutation in place. */
export function fakePrefs(): { prefs: Prefs; save: (mutation: (draft: Prefs) => void) => void } {
  const prefs: Prefs = { muted: false };
  return { prefs, save: (mutation) => mutation(prefs) };
}
