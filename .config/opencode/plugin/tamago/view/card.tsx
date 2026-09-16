/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import { frameIndex } from "../core/cadence.ts";
import { age, progress } from "../core/card.ts";
import { describe, type Character, type Temperament } from "../core/character.ts";
import { fmt } from "../core/format.ts";
import type { SpeciesId } from "../core/species.ts";
import { frameAt, heartFrame } from "../core/sprites.ts";
import { stage, xp } from "../core/stage.ts";
import type { Career } from "../core/state.ts";

/**
 * The card opened from the palette. OpenCode's dialog stack wraps it in its
 * own centered Dialog, so this only lays out the inside, like DialogAlert:
 * title row with the esc hint, the idle Portrait, the Character, the XP bar.
 */
export function CardView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  species: () => SpeciesId;
  clock: () => number;
  heart: () => boolean;
  temperament: () => Temperament;
  character: () => Character;
  now: () => number;
}): JSX.Element {
  const current = createMemo(() => stage(props.career()));
  const lines = createMemo(() =>
    props.heart()
      ? heartFrame(props.species(), current(), props.temperament())
      : frameAt(props.species(), current(), "idle", frameIndex("idle", props.clock())),
  );
  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.theme().text}>
          <b>{props.name}</b>
        </text>
        <text fg={props.theme().textMuted}>esc</text>
      </box>
      <box flexDirection="row" gap={2}>
        <box flexDirection="column" flexShrink={0}>
          <Index each={lines()}>{(line) => <text fg={props.theme().accent}>{line()}</text>}</Index>
        </box>
        <box flexDirection="column" justifyContent="center">
          <text fg={props.theme().textMuted}>
            {current()} · {fmt(xp(props.career()))} xp
          </text>
          <text fg={props.theme().textMuted}>{age(props.career().hatchedAt, props.now())}</text>
        </box>
      </box>
      <text fg={props.theme().textMuted}>{describe(props.character())}</text>
      <text fg={props.theme().textMuted}>{progress(props.career())}</text>
    </box>
  );
}
