/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { bubbleBorders } from "../core/speech/bubble.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import { fmt } from "../core/appearance/format.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import type { Frame } from "../core/appearance/sprites.ts";
import type { Activity, Session } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";
import type { Bubble } from "../core/speech/voice.ts";
import { Portrait, type BubbleView } from "./portrait.tsx";
import { useTheme } from "./theme.tsx";

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
  session: Session;
  tamago: Tamago;
  clock: number;
  footer: FooterInfo;
  bubble?: Bubble;
  heart: boolean;
}): JSX.Element {
  const theme = useTheme();
  const activity = () => props.session.activity;
  const lines = (): Frame => {
    const t = props.tamago;
    return props.heart
      ? heartFrame(t.species.id, t.stage, t.temperament)
      : frameAt(t.species.id, t.stage, activity(), frameIndex(activity(), props.clock, t.behavior));
  };
  const bubble = createMemo((): BubbleView | undefined => {
    const current = props.bubble;
    if (current === undefined) return undefined;
    const { top, bottom } = bubbleBorders(current.text);
    return { top, text: current.text, bottom, border: theme.current.textMuted, ink: theme.current.text };
  });

  return (
    <box flexDirection="column" gap={1}>
      <Portrait lines={lines()} color={spriteColor(theme.current, activity())} bubble={bubble()}>
        <text fg={theme.current.text}>
          <b>{props.name}</b>
        </text>
        <text fg={theme.current.textMuted}>
          {props.tamago.stage} · {fmt(props.tamago.xp)} xp
        </text>
        <text fg={theme.current.textMuted}>{MOOD[activity()]}</text>
      </Portrait>
      <text>
        <span style={{ fg: theme.current.textMuted }}>{props.footer.parent}/</span>
        <span style={{ fg: theme.current.text }}>{props.footer.name}</span>
      </text>
      <text fg={theme.current.textMuted}>
        <span style={{ fg: theme.current.success }}>•</span> <b>Open</b>
        <span style={{ fg: theme.current.text }}>
          <b>Code</b>
        </span>{" "}
        <span>{props.footer.version}</span>
      </text>
    </box>
  );
}
