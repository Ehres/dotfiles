/** @jsxImportSource @opentui/solid */
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { Index, Show, createMemo } from "solid-js";
import type { Frame } from "../core/appearance/sprites.ts";

/** A drawn Bubble: borders in `border`, the phrase in `ink`. */
export type BubbleView = { top: string; text: string; bottom: string; border: RGBA; ink: RGBA };

/**
 * The Bubble, when there is one, above the sprite column and a caption
 * column. `lines` is memoised so a tick that lands on the same frame
 * re-renders nothing, and <Index> keeps the text nodes alive when only
 * their content changes. Without a Bubble the block does not exist, so the
 * footer keeps today's height.
 */
export function Portrait(props: { lines: Frame; color: RGBA; bubble?: BubbleView; children: JSX.Element }): JSX.Element {
  const lines = createMemo(() => props.lines);
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
        <box flexDirection="column" flexShrink={0}>
          <Index each={lines()}>{(line) => <text fg={props.color}>{line()}</text>}</Index>
        </box>
        <box flexDirection="column" justifyContent="center">
          {props.children}
        </box>
      </box>
    </box>
  );
}
