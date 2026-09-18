/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import type { Behavior } from "../core/creature/behavior.ts";
import { bubbleBorders } from "../core/speech/bubble.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import type { Temperament } from "../core/creature/sheet.ts";
import { fmt } from "../core/appearance/format.ts";
import type { SpeciesId } from "../core/creature/species.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import type { Career } from "../core/career/career.ts";
import type { Activity, Session } from "../core/moment/session.ts";
import { stage, xp } from "../core/career/stage.ts";
import type { Bubble } from "../core/speech/voice.ts";
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
  species: () => SpeciesId;
  clock: () => number;
  footer: () => FooterInfo;
  bubble: () => Bubble | undefined;
  heart: () => boolean;
  temperament: () => Temperament;
  behavior: () => Behavior;
}): JSX.Element {
  const activity = createMemo(() => props.session().activity);
  const current = createMemo(() => stage(props.career()));
  const total = createMemo(() => xp(props.career()));
  const lines = () =>
    props.heart()
      ? heartFrame(props.species(), current(), props.temperament())
      : frameAt(props.species(), current(), activity(), frameIndex(activity(), props.clock(), props.behavior()));
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
