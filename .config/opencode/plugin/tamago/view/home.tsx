/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { bar, fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { next, stage, xp } from "../core/stage.ts";
import { TOOL_KINDS, type Career } from "../core/state.ts";

const BAR_WIDTH = 20;

export function HomeView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  frame: () => number;
}): JSX.Element {
  const lines = () => frameAt(stage(props.career()), "idle", props.frame());
  const tools = () => TOOL_KINDS.reduce((sum, kind) => sum + props.career().tools[kind], 0);
  const progress = () => {
    const coming = next(props.career());
    if (!coming) return `${bar(1, BAR_WIDTH)} ${fmt(xp(props.career()))} xp · final form`;
    return `${bar(coming.progress, BAR_WIDTH)} ${fmt(xp(props.career()))} / ${fmt(coming.threshold)} xp → ${coming.stage}`;
  };

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="column">
        {lines().map((line) => (
          <text fg={props.theme().accent}>{line}</text>
        ))}
      </box>
      <text fg={props.theme().text}>
        <b>{props.name}</b>
        <span style={{ fg: props.theme().textMuted }}> · {stage(props.career())}</span>
      </text>
      <text fg={props.theme().textMuted}>{progress()}</text>
      <text fg={props.theme().textMuted}>
        sessions {fmt(props.career().sessions)} · prompts {fmt(props.career().prompts)} · tools {fmt(tools())} · files{" "}
        {fmt(props.career().filesEdited)}
      </text>
    </box>
  );
}
