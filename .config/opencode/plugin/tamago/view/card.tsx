/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import { behavior } from "../core/creature/behavior.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import { age, progress, sheetLines, speciesLine } from "../core/appearance/card.ts";
import { character, describe } from "../core/creature/character.ts";
import { fmt } from "../core/appearance/format.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import { stage, xp } from "../core/career/stage.ts";
import type { Career } from "../core/career/career.ts";

/**
 * Everything a card shows under its title row, for any Career: the idle
 * Portrait (or the heart), Species and Rarity, Stage and XP, age, the
 * Character, the Sheet bars, the XP bar. Species, Temperament, Behavior and
 * Character are derived from the Career here, the way index.tsx derives them
 * for the active one, so the roster view can show a resting Career too.
 */
export function CardBody(props: {
  theme: () => TuiThemeCurrent;
  career: () => Career;
  clock: () => number;
  heart: () => boolean;
  now: () => number;
}): JSX.Element {
  const current = createMemo(() => stage(props.career()));
  const persona = createMemo(() => character(props.career()));
  const lines = createMemo(() =>
    props.heart()
      ? heartFrame(props.career().species, current(), persona().temperament)
      : frameAt(props.career().species, current(), "idle", frameIndex("idle", props.clock(), behavior(props.career()))),
  );
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <box flexDirection="column" flexShrink={0}>
          <Index each={lines()}>{(line) => <text fg={props.theme().accent}>{line()}</text>}</Index>
        </box>
        <box flexDirection="column" justifyContent="center">
          <text fg={props.theme().textMuted}>{speciesLine(props.career())}</text>
          <text fg={props.theme().textMuted}>
            {current()} · {fmt(xp(props.career()))} xp
          </text>
          <text fg={props.theme().textMuted}>{age(props.career().hatchedAt, props.now())}</text>
        </box>
      </box>
      <text fg={props.theme().textMuted}>{describe(persona())}</text>
      <box flexDirection="column">
        <Index each={sheetLines(props.career())}>{(line) => <text fg={props.theme().textMuted}>{line()}</text>}</Index>
      </box>
      <text fg={props.theme().textMuted}>{progress(props.career())}</text>
    </box>
  );
}

/**
 * The card opened from the palette. OpenCode's dialog stack wraps it in its
 * own centered Dialog, so this only lays out the inside, like DialogAlert:
 * title row with the esc hint, then the CardBody.
 */
export function CardView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  clock: () => number;
  heart: () => boolean;
  now: () => number;
}): JSX.Element {
  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.theme().text}>
          <b>{props.name}</b>
        </text>
        <text fg={props.theme().textMuted}>esc</text>
      </box>
      <CardBody theme={props.theme} career={props.career} clock={props.clock} heart={props.heart} now={props.now} />
    </box>
  );
}
