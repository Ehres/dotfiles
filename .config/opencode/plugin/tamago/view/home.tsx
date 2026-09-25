/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { BAR_WIDTH, progress, stageName } from "../core/text/card.ts";
import type { Tamago } from "../core/tamago.ts";
import { useLanguage } from "./language.tsx";
import { Portrait } from "./portrait.tsx";
import { useTheme } from "./theme.tsx";

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, name and progress on the right. */
export function HomeView(props: { name: string; tamago: Tamago; clock: number; heart: boolean }): JSX.Element {
  const theme = useTheme();
  const language = useLanguage();

  return (
    <box paddingTop={1}>
      <Portrait
        tamago={props.tamago}
        activity="idle"
        clock={props.clock}
        heart={props.heart}
        variant={theme.mode()}
        theme={theme.current}
        badge={props.tamago.choices.length > 0}
      >
        <text fg={theme.current.text}>
          <b>{props.name}</b>
          <span style={{ fg: theme.current.textMuted }}> · {stageName(props.tamago, language())}</span>
        </text>
        <text fg={theme.current.textMuted}>{progress(props.tamago, BAR_WIDTH, language())}</text>
      </Portrait>
    </box>
  );
}
