/** @jsxImportSource @opentui/solid */
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { Show } from "solid-js";
import type { Activity } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";
import { Sprite } from "./sprite.tsx";

/** A drawn Bubble: borders in `border`, the phrase in `ink`. */
export type BubbleView = { top: string; text: string; bottom: string; border: RGBA; ink: RGBA };

/**
 * The Bubble, when there is one, above the Sprite and a caption column.
 * Without a Bubble the block does not exist, so the footer keeps today's
 * height.
 */
export function Portrait(props: {
  tamago: Tamago;
  activity: Activity;
  clock: number;
  heart: boolean;
  color: RGBA;
  bubble?: BubbleView;
  children: JSX.Element;
}): JSX.Element {
  return (
    <box flexDirection="column">
      <Show when={props.bubble}>
        {(bubble) => (
          <box flexDirection="column">
            <text fg={bubble().border}>{bubble().top}</text>
            <text fg={bubble().border}>
              ( <span style={{ fg: bubble().ink }}>{bubble().text}</span> )
            </text>
            <text fg={bubble().border}>{bubble().bottom}</text>
          </box>
        )}
      </Show>
      <box flexDirection="row" gap={2}>
        <Sprite tamago={props.tamago} activity={props.activity} clock={props.clock} heart={props.heart} color={props.color} />
        <box flexDirection="column" justifyContent="center">
          {props.children}
        </box>
      </box>
    </box>
  );
}
