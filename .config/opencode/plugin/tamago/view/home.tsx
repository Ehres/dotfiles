/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { frameIndex } from "../core/moment/cadence.ts";
import { progress } from "../core/appearance/card.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import type { Tamago } from "../core/tamago.ts";
import { Portrait } from "./portrait.tsx";
import { useTheme } from "./theme.tsx";

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, name and progress on the right. */
export function HomeView(props: { name: string; tamago: Tamago; clock: number; heart: boolean }): JSX.Element {
  const theme = useTheme();
  const lines = () => {
    const t = props.tamago;
    return props.heart
      ? heartFrame(t.species.id, t.stage, t.temperament)
      : frameAt(t.species.id, t.stage, "idle", frameIndex("idle", props.clock, t.behavior));
  };

  return (
    <box paddingTop={1}>
      <Portrait lines={lines()} color={theme.current.accent}>
        <text fg={theme.current.text}>
          <b>{props.name}</b>
          <span style={{ fg: theme.current.textMuted }}> · {props.tamago.stage}</span>
        </text>
        <text fg={theme.current.textMuted}>{progress(props.tamago)}</text>
      </Portrait>
    </box>
  );
}
