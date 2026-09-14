/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { frameIndex } from "../core/cadence.ts";
import { bar, fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { next, stage, xp } from "../core/stage.ts";
import type { Career } from "../core/state.ts";
import { Portrait } from "./portrait.tsx";

const BAR_WIDTH = 20;

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, name and progress on the right. */
export function HomeView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  clock: () => number;
}): JSX.Element {
  const current = createMemo(() => stage(props.career()));
  const total = createMemo(() => xp(props.career()));
  const lines = () => frameAt(current(), "idle", frameIndex("idle", props.clock()));
  const progress = () => {
    const coming = next(props.career());
    if (!coming) return `${bar(1, BAR_WIDTH)} ${fmt(total())} xp · final form`;
    return `${bar(coming.progress, BAR_WIDTH)} ${fmt(total())} / ${fmt(coming.threshold)} xp → ${coming.stage}`;
  };

  return (
    <box paddingTop={1}>
      <Portrait lines={lines} color={() => props.theme().accent} bubble={() => undefined}>
        <text fg={props.theme().text}>
          <b>{props.name}</b>
          <span style={{ fg: props.theme().textMuted }}> · {current()}</span>
        </text>
        <text fg={props.theme().textMuted}>{progress()}</text>
      </Portrait>
    </box>
  );
}
