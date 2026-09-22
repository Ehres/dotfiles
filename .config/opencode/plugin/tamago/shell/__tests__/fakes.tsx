/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";

export type Toast = { variant?: string; title?: string; message: string };
type SelectProps = { title: string; options: { title: string; description?: string }[] };

/**
 * The slice of the api these tests touch: toasts, the dialog stack, and a
 * DialogSelect standing in for OpenCode's own. Everything else is left
 * undefined on purpose, so a test that needs more has to say so.
 */
export function fakeApi(): { api: TuiPluginApi; toasts: Toast[]; shown: () => (() => JSX.Element) | undefined } {
  const toasts: Toast[] = [];
  let node: (() => JSX.Element) | undefined;
  const api = {
    ui: {
      toast: (input: Toast) => toasts.push(input),
      dialog: {
        replace: (next: () => JSX.Element) => {
          node = next;
        },
        clear: () => {
          node = undefined;
        },
      },
      DialogSelect: (props: SelectProps) => (
        <box flexDirection="column">
          <text>{props.title}</text>
          {props.options.map((option) => (
            <text>{option.title}</text>
          ))}
        </box>
      ),
    },
  } as unknown as TuiPluginApi;
  return { api, toasts, shown: () => node };
}
