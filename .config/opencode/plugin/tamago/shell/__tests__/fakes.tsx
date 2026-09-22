/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";

export type Toast = { variant?: string; title?: string; message: string };
export type SelectOption = { title: string; value: string; description?: string };
type SelectProps = { title: string; options: SelectOption[]; onSelect?: (option: SelectOption) => void };

/**
 * The slice of the api these tests touch: toasts, the dialog stack, and a
 * DialogSelect standing in for OpenCode's own. Everything else is left
 * undefined on purpose, so a test that needs more has to say so. `select`
 * exposes the latest DialogSelect props, once the dialog has been rendered,
 * so a test can drive `onSelect` the way a person picking an option would.
 */
export function fakeApi(): {
  api: TuiPluginApi;
  toasts: Toast[];
  shown: () => (() => JSX.Element) | undefined;
  select: () => SelectProps | undefined;
} {
  const toasts: Toast[] = [];
  let node: (() => JSX.Element) | undefined;
  let selected: SelectProps | undefined;
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
      DialogSelect: (props: SelectProps) => {
        selected = props;
        return (
          <box flexDirection="column">
            <text>{props.title}</text>
            {props.options.map((option) => (
              <text>{option.title}</text>
            ))}
          </box>
        );
      },
    },
  } as unknown as TuiPluginApi;
  return { api, toasts, shown: () => node, select: () => selected };
}
