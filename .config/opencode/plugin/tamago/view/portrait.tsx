/** @jsxImportSource @opentui/solid */
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import type { Frame } from "../core/sprites.ts";

/**
 * The sprite column next to a caption column. `lines` is memoised so a tick
 * that lands on the same frame re-renders nothing, and <Index> keeps the text
 * nodes alive when only their content changes.
 */
export function Portrait(props: { lines: () => Frame; color: () => RGBA; children: JSX.Element }): JSX.Element {
  const lines = createMemo(() => props.lines());
  return (
    <box flexDirection="row" gap={2}>
      <box flexDirection="column" flexShrink={0}>
        <Index each={lines()}>{(line) => <text fg={props.color()}>{line()}</text>}</Index>
      </box>
      <box flexDirection="column" justifyContent="center">
        {props.children}
      </box>
    </box>
  );
}
