/** @jsxImportSource @opentui/solid */
import type { KeyEvent } from "@opentui/core";
import { useKeyboard, type JSX } from "@opentui/solid";
import { Index, Show, createSignal } from "solid-js";
import { rosterAction, step } from "../core/roster/roster.ts";
import type { Tamago } from "../core/tamago.ts";
import { CardBody } from "./card.tsx";
import { DialogFrame } from "./dialog.tsx";
import { useTheme } from "./theme.tsx";

/** The gutter of the highlighted line, and the blank one of the others, so the Names stay aligned. */
const CURSOR = "> ";
const BLANK = "  ";

/**
 * The roster dialog: every Career of the machine as a line, the highlighted
 * one's CardBody underneath. OpenCode's Dialog wraps it and handles esc; the
 * moves and the select come from useKeyboard through the ROSTER_KEYS table in
 * core/roster/roster.ts. `tamagos` and `lines` are frozen at opening, index for index.
 */
export function RosterView(props: {
  tamagos: readonly Tamago[];
  lines: readonly string[];
  clock: number;
  now: number;
  onSelect: (tamago: Tamago) => void;
}): JSX.Element {
  const theme = useTheme();
  const [cursor, setCursor] = createSignal(0);
  const highlighted = (): Tamago | undefined => props.tamagos[cursor()];
  useKeyboard((key: KeyEvent) => {
    const action = rosterAction(key.name);
    if (action === undefined) return;
    if (action === "select") {
      const chosen = highlighted();
      if (chosen !== undefined) props.onSelect(chosen);
      return;
    }
    setCursor((at) => step(at, action, props.tamagos.length));
  });
  return (
    <DialogFrame title="Tamago: roster">
      <box flexDirection="column">
        <Index each={props.lines}>
          {(text, index) => (
            <text fg={index === cursor() ? theme.current.text : theme.current.textMuted}>
              {index === cursor() ? CURSOR : BLANK}
              {text()}
            </text>
          )}
        </Index>
      </box>
      <Show when={highlighted()}>
        {(one) => <CardBody tamago={one()} clock={props.clock} heart={false} now={props.now} />}
      </Show>
    </DialogFrame>
  );
}
