/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { Show } from "solid-js";
import type { Variant } from "../core/appearance/palette.ts";
import { SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import type { Activity } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";
import { Sprite } from "./sprite.tsx";

/** A drawn Bubble: borders in `border`, the phrase in `ink`, offset onto the head. */
export type BubbleView = { top: string; text: string; bottom: string; border: RGBA; ink: RGBA; offset: number };

/**
 * The Sprite, and a Bubble above it when there is one. The Sprite is centred
 * in `width` when given (a sidebar rule); without one it sits flush left, as
 * the card and the home need it. Without a Bubble the block does not exist,
 * so the footer keeps today's height.
 */
export function Portrait(props: {
  tamago: Tamago;
  activity: Activity;
  clock: number;
  heart: boolean;
  variant: Variant;
  theme: TuiThemeCurrent;
  badge: boolean;
  width?: number;
  bubble?: BubbleView;
  children?: JSX.Element;
}): JSX.Element {
  /** Left margin that centres the 21-cell Sprite in `width`; 0 when there is no room or no width. */
  const margin = () => Math.max(0, Math.floor(((props.width ?? SPRITE_WIDTH) - SPRITE_WIDTH) / 2));
  return (
    <box flexDirection="column">
      <Show when={props.bubble}>
        {(bubble) => (
          <box flexDirection="column" paddingLeft={margin() + bubble().offset}>
            <text fg={bubble().border}>{bubble().top}</text>
            <text fg={bubble().border}>
              ( <span style={{ fg: bubble().ink }}>{bubble().text}</span> )
            </text>
            <text fg={bubble().border}>{bubble().bottom}</text>
          </box>
        )}
      </Show>
      <box flexDirection="row" gap={2}>
        <box paddingLeft={margin()}>
          <Sprite
            tamago={props.tamago}
            activity={props.activity}
            clock={props.clock}
            heart={props.heart}
            variant={props.variant}
            theme={props.theme}
            badge={props.badge}
          />
        </box>
        <Show when={props.children}>
          <box flexDirection="column" justifyContent="center">
            {props.children}
          </box>
        </Show>
      </box>
    </box>
  );
}
