/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import { bubbleBorders, tailOffset } from "../core/speech/bubble.ts";
import type { Activity, Session } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";
import type { Bubble } from "../core/speech/voice.ts";
import { Portrait, type BubbleView } from "./portrait.tsx";
import { useTheme } from "./theme.tsx";

/** The real sidebar, measured 2026-09-25. The Sprite is centred in it. */
export const SIDEBAR_WIDTH = 37;

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
  const bubble = createMemo((): BubbleView | undefined => {
    const current = props.bubble;
    if (current === undefined) return undefined;
    const { top, bottom } = bubbleBorders(current.text);
    return {
      top,
      text: current.text,
      bottom,
      border: theme.current.textMuted,
      ink: theme.current.text,
      offset: tailOffset(current.text),
    };
  });

  return (
    <box flexDirection="column" gap={1}>
      <Portrait
        tamago={props.tamago}
        activity={activity()}
        clock={props.clock}
        heart={props.heart}
        variant={theme.mode()}
        theme={theme.current}
        badge={props.tamago.choices.length > 0}
        width={SIDEBAR_WIDTH}
        bubble={bubble()}
      />
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
