/** @jsxImportSource @opentui/solid */
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import { frameAt, heartFrame, type Frame } from "../core/appearance/sprites.ts";
import { markOf } from "../core/appearance/marks.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import type { Activity } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";

/**
 * The Sprite of a Tamago for an Activity at a moment of the clock: the heart
 * while petted, else the Frame the Behavior's cadence lands on. Frames are
 * cached in core, so the memo hands back the same reference for the same
 * frame and a tick that changes nothing re-renders nothing.
 */
export function Sprite(props: { tamago: Tamago; activity: Activity; clock: number; heart: boolean; color: RGBA }): JSX.Element {
  const lines = createMemo((): Frame => {
    const t = props.tamago;
    const mark = markOf(t.traits);
    return props.heart
      ? heartFrame(t.species.id, t.stage, t.temperament, mark)
      : frameAt(t.species.id, t.stage, props.activity, frameIndex(props.activity, props.clock, t.behavior), mark);
  });
  return (
    <box flexDirection="column" flexShrink={0}>
      <Index each={lines()}>{(line) => <text fg={props.color}>{line()}</text>}</Index>
    </box>
  );
}
