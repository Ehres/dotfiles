/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { frameIndex } from "../core/cadence.ts";
import { bar, fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { next, stage, xp } from "../core/stage.ts";
import type { Career } from "../core/state.ts";

const BAR_WIDTH = 20;

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, stats on the right. */
export function HomeView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  ticks: () => number;
}): JSX.Element {
  const lines = () => frameAt(stage(props.career()), "idle", frameIndex("idle", props.ticks()));
  const progress = () => {
    const coming = next(props.career());
    if (!coming) return `${bar(1, BAR_WIDTH)} ${fmt(xp(props.career()))} xp · final form`;
    return `${bar(coming.progress, BAR_WIDTH)} ${fmt(xp(props.career()))} / ${fmt(coming.threshold)} xp → ${coming.stage}`;
  };

  return (
    <box flexDirection="row" gap={2} paddingTop={1}>
      <box flexDirection="column" flexShrink={0}>
        {lines().map((line) => (
          <text fg={props.theme().accent}>{line}</text>
        ))}
      </box>
      <box flexDirection="column" justifyContent="center">
        <text fg={props.theme().text}>
          <b>{props.name}</b>
          <span style={{ fg: props.theme().textMuted }}> · {stage(props.career())}</span>
        </text>
        <text fg={props.theme().textMuted}>{progress()}</text>
      </box>
    </box>
  );
}
