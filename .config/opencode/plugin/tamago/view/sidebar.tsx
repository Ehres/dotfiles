/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { frameIndex } from "../core/cadence.ts";
import { fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { stage, xp } from "../core/stage.ts";
import type { Activity, Career, Session } from "../core/state.ts";

export const MOOD: Record<Activity, string> = {
  idle: "chilling",
  thinking: "thinking...",
  working: "working",
  waiting: "needs you",
  hurt: "ouch",
  sleeping: "zzz",
};

export function spriteColor(theme: TuiThemeCurrent, activity: Activity): RGBA {
  switch (activity) {
    case "hurt":
      return theme.error;
    case "waiting":
      return theme.warning;
    case "sleeping":
      return theme.textMuted;
    default:
      return theme.accent;
  }
}

export type FooterInfo = { parent: string; name: string; version: string };

export function SidebarView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  session: () => Session;
  career: () => Career;
  ticks: () => number;
  footer: () => FooterInfo;
}): JSX.Element {
  const lines = () => {
    const activity = props.session().activity;
    return frameAt(stage(props.career()), activity, frameIndex(activity, props.ticks()));
  };
  const color = () => spriteColor(props.theme(), props.session().activity);

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <box flexDirection="column" flexShrink={0}>
          {lines().map((line) => (
            <text fg={color()}>{line}</text>
          ))}
        </box>
        <box flexDirection="column" justifyContent="center">
          <text fg={props.theme().text}>
            <b>{props.name}</b>
          </text>
          <text fg={props.theme().textMuted}>
            {stage(props.career())} · {fmt(xp(props.career()))} xp
          </text>
          <text fg={props.theme().textMuted}>{MOOD[props.session().activity]}</text>
        </box>
      </box>
      <text>
        <span style={{ fg: props.theme().textMuted }}>{props.footer().parent}/</span>
        <span style={{ fg: props.theme().text }}>{props.footer().name}</span>
      </text>
      <text fg={props.theme().textMuted}>
        <span style={{ fg: props.theme().success }}>•</span> <b>Open</b>
        <span style={{ fg: props.theme().text }}>
          <b>Code</b>
        </span>{" "}
        <span>{props.footer().version}</span>
      </text>
    </box>
  );
}
