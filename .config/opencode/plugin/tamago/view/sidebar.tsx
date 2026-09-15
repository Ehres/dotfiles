/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { bubbleBorders } from "../core/bubble.ts";
import { frameIndex } from "../core/cadence.ts";
import type { Temperament } from "../core/character.ts";
import { fmt } from "../core/format.ts";
import { frameAt, heartFrame } from "../core/sprites.ts";
import { stage, xp } from "../core/stage.ts";
import type { Activity, Career, Session } from "../core/state.ts";
import type { Bubble } from "../core/voice.ts";
import { Portrait, type BubbleView } from "./portrait.tsx";

export const MOOD: Record<Activity, string> = {
  idle: "chilling",
  thinking: "thinking...",
  working: "working",
  waiting: "needs you",
  hurt: "ouch",
  sleeping: "zzz",
};

/** Which theme color paints the sprite in each Activity. One row per Activity: a new one cannot fall back to the accent unnoticed. */
export const TONE: Record<Activity, "accent" | "error" | "warning" | "textMuted"> = {
  idle: "accent",
  thinking: "accent",
  working: "accent",
  waiting: "warning",
  hurt: "error",
  sleeping: "textMuted",
};

export function spriteColor(theme: TuiThemeCurrent, activity: Activity): RGBA {
  return theme[TONE[activity]];
}

export type FooterInfo = { parent: string; name: string; version: string };

export function SidebarView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  session: () => Session;
  career: () => Career;
  clock: () => number;
  footer: () => FooterInfo;
  bubble: () => Bubble | undefined;
  heart: () => boolean;
  temperament: () => Temperament;
}): JSX.Element {
  const activity = createMemo(() => props.session().activity);
  const current = createMemo(() => stage(props.career()));
  const total = createMemo(() => xp(props.career()));
  const lines = () =>
    props.heart() ? heartFrame(current(), props.temperament()) : frameAt(current(), activity(), frameIndex(activity(), props.clock()));
  const color = () => spriteColor(props.theme(), activity());
  const bubble = createMemo((): BubbleView | undefined => {
    const current = props.bubble();
    if (current === undefined) return undefined;
    const { top, bottom } = bubbleBorders(current.text);
    return { top, text: current.text, bottom, border: props.theme().textMuted, ink: props.theme().text };
  });

  return (
    <box flexDirection="column" gap={1}>
      <Portrait lines={lines} color={color} bubble={bubble}>
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
