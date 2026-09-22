/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { Show } from "solid-js";
import { progress } from "../core/text/card.ts";
import { CHOICE_BADGE } from "../core/text/traits.ts";
import type { Tamago } from "../core/tamago.ts";
import { Portrait } from "./portrait.tsx";
import { useTheme } from "./theme.tsx";

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, name and progress on the right. */
export function HomeView(props: { name: string; tamago: Tamago; clock: number; heart: boolean }): JSX.Element {
  const theme = useTheme();

  return (
    <box paddingTop={1}>
      <Portrait tamago={props.tamago} activity="idle" clock={props.clock} heart={props.heart} color={theme.current.accent}>
        <text fg={theme.current.text}>
          <b>{props.name}</b>
          <Show when={props.tamago.choices.length > 0}>
            <span style={{ fg: theme.current.warning }}> {CHOICE_BADGE}</span>
          </Show>
          <span style={{ fg: theme.current.textMuted }}> · {props.tamago.stage}</span>
        </text>
        <text fg={theme.current.textMuted}>{progress(props.tamago)}</text>
      </Portrait>
    </box>
  );
}
