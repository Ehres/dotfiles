/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { frameIndex } from "../core/cadence.ts";
import { fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { stage, xp } from "../core/stage.ts";
import type { Activity, Career, Session } from "../core/state.ts";
import { Portrait } from "./portrait.tsx";

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
  clock: () => number;
  footer: () => FooterInfo;
}): JSX.Element {
  const activity = createMemo(() => props.session().activity);
  const current = createMemo(() => stage(props.career()));
  const total = createMemo(() => xp(props.career()));
  const lines = () => frameAt(current(), activity(), frameIndex(activity(), props.clock()));
  const color = () => spriteColor(props.theme(), activity());

  return (
    <box flexDirection="column" gap={1}>
      <Portrait lines={lines} color={color}>
        <text fg={props.theme().text}>
          <b>{props.name}</b>
        </text>
        <text fg={props.theme().textMuted}>
          {current()} · {fmt(total())} xp
        </text>
        <text fg={props.theme().textMuted}>{MOOD[activity()]}</text>
      </Portrait>
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
