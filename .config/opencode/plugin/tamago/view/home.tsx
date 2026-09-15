/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { frameIndex } from "../core/cadence.ts";
import { progress } from "../core/card.ts";
import { frameAt, heartFrame } from "../core/sprites.ts";
import { stage } from "../core/stage.ts";
import type { Career } from "../core/state.ts";
import { Portrait } from "./portrait.tsx";

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, name and progress on the right. */
export function HomeView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  clock: () => number;
  heart: () => boolean;
}): JSX.Element {
  const current = createMemo(() => stage(props.career()));
  const lines = () => (props.heart() ? heartFrame(current()) : frameAt(current(), "idle", frameIndex("idle", props.clock())));

  return (
    <box paddingTop={1}>
      <Portrait lines={lines} color={() => props.theme().accent} bubble={() => undefined}>
        <text fg={props.theme().text}>
          <b>{props.name}</b>
          <span style={{ fg: props.theme().textMuted }}> · {current()}</span>
        </text>
        <text fg={props.theme().textMuted}>{progress(props.career())}</text>
      </Portrait>
    </box>
  );
}
