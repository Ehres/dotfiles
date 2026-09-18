/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { KeyEvent } from "@opentui/core";
import { useKeyboard, type JSX } from "@opentui/solid";
import { Index, Show, createSignal } from "solid-js";
import { rosterAction, step } from "../core/roster/roster.ts";
import type { Tamago } from "../core/tamago.ts";
import { CardBody } from "./card.tsx";

/** The gutter of the highlighted line, and the blank one of the others, so the Names stay aligned. */
const CURSOR = "> ";
const BLANK = "  ";

/**
 * The roster dialog: every Career of the machine as a line, the highlighted
 * one's CardBody underneath. OpenCode's Dialog wraps it and handles esc; the
 * moves and the select come from useKeyboard through the ROSTER_KEYS table in
 * core/roster.ts. `tamagos` and `lines` are frozen at opening, index for index.
 */
export function RosterView(props: {
  theme: () => TuiThemeCurrent;
  tamagos: readonly Tamago[];
  lines: readonly string[];
  clock: () => number;
  now: () => number;
  onSelect: (tamago: Tamago) => void;
}): JSX.Element {
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
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.theme().text}>
          <b>Tamago: roster</b>
        </text>
        <text fg={props.theme().textMuted}>esc</text>
      </box>
      <box flexDirection="column">
        <Index each={props.lines}>
          {(text, index) => (
            <text fg={index === cursor() ? props.theme().text : props.theme().textMuted}>
              {index === cursor() ? CURSOR : BLANK}
              {text()}
            </text>
          )}
        </Index>
      </box>
      <Show when={highlighted()}>
        {(one) => <CardBody theme={props.theme} tamago={one} clock={props.clock} heart={() => false} now={props.now} />}
      </Show>
    </box>
  );
}
