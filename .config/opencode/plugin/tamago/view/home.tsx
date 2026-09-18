/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { createMemo } from "solid-js";
import type { Behavior } from "../core/creature/behavior.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import { progress } from "../core/appearance/card.ts";
import type { Temperament } from "../core/creature/sheet.ts";
import type { SpeciesId } from "../core/creature/species.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import { stage } from "../core/career/stage.ts";
import type { Career } from "../core/career/career.ts";
import { Portrait } from "./portrait.tsx";

/** Rendered in the additive home_bottom slot, under the prompt: sprite on the left, name and progress on the right. */
export function HomeView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  species: () => SpeciesId;
  clock: () => number;
  heart: () => boolean;
  temperament: () => Temperament;
  behavior: () => Behavior;
}): JSX.Element {
  const current = createMemo(() => stage(props.career()));
  const lines = () =>
    props.heart()
      ? heartFrame(props.species(), current(), props.temperament())
      : frameAt(props.species(), current(), "idle", frameIndex("idle", props.clock(), props.behavior()));

  return (
    <box paddingTop={1}>
      <Portrait lines={lines} color={() => props.theme().accent} bubble={() => undefined}>
        <text fg={props.theme().text}>
          <b>{props.name}</b>
          <span style={{ fg: props.theme().textMuted }}> · {current()}</span>
        </text>
        <text fg={props.theme().textMuted}>{progress(props.career())}</text>
      </Portrait>
    </box>
  );
}
