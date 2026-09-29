/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { bubbleBorders, tailOffset } from "../core/speech/bubble.ts";
import { headOf } from "../core/appearance/sprites.ts";
import type { Activity, Session } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";
import type { Bubble } from "../core/speech/voice.ts";
import { Portrait, type BubbleView } from "./portrait.tsx";
import { useTheme } from "./theme.tsx";

/** The real sidebar, measured 2026-09-25. The Sprite is centred in it. */
export const SIDEBAR_WIDTH = 37;

export function SidebarView(props: {
  name: string;
  session: Session;
  tamago: Tamago;
  clock: number;
  bubble?: Bubble;
  heart: boolean;
}): JSX.Element {
  const theme = useTheme();
  const activity = () => props.session.activity;
  const bubble = createMemo((): BubbleView | undefined => {
    const current = props.bubble;
    if (current === undefined) return undefined;
    const { top, bottom } = bubbleBorders(current.text);
    return { top, text: current.text, bottom, border: theme.current.textMuted, ink: theme.current.text, offset: tailOffset(current.text, headOf(props.tamago.species.id, props.tamago.stage).x) };
  });
  return (
    <Portrait
      tamago={props.tamago}
      activity={activity()}
      clock={props.clock}
      heart={props.heart}
      theme={theme.current}
      badge={props.tamago.choices.length > 0}
      width={SIDEBAR_WIDTH}
      bubble={bubble()}
    />
  );
}
