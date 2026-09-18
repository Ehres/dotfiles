/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import { age, progress, sheetLines, speciesLine } from "../core/appearance/card.ts";
import { fmt } from "../core/appearance/format.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import { describe } from "../core/creature/character.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import type { Tamago } from "../core/tamago.ts";

/**
 * Everything a card shows under its title row, for any Tamago: the idle
 * Portrait (or the heart), Species and Rarity, Stage and XP, age, the
 * Character, the Sheet bars, the XP bar. Everything is read from the Tamago
 * the shell derived from the Career, so the roster view can show a resting
 * Career too, by handing over the Tamago read from it.
 */
export function CardBody(props: {
  theme: () => TuiThemeCurrent;
  tamago: () => Tamago;
  clock: () => number;
  heart: () => boolean;
  now: () => number;
}): JSX.Element {
  const lines = createMemo(() => {
    const t = props.tamago();
    return props.heart()
      ? heartFrame(t.species.id, t.stage, t.temperament)
      : frameAt(t.species.id, t.stage, "idle", frameIndex("idle", props.clock(), t.behavior));
  });
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <box flexDirection="column" flexShrink={0}>
          <Index each={lines()}>{(line) => <text fg={props.theme().accent}>{line()}</text>}</Index>
        </box>
        <box flexDirection="column" justifyContent="center">
          <text fg={props.theme().textMuted}>{speciesLine(props.tamago())}</text>
          <text fg={props.theme().textMuted}>
            {props.tamago().stage} · {fmt(props.tamago().xp)} xp
          </text>
          <text fg={props.theme().textMuted}>{age(props.tamago().career.hatchedAt, props.now())}</text>
        </box>
      </box>
      <text fg={props.theme().textMuted}>{describe(props.tamago().character)}</text>
      <box flexDirection="column">
        <Index each={sheetLines(props.tamago())}>{(line) => <text fg={props.theme().textMuted}>{line()}</text>}</Index>
      </box>
      <text fg={props.theme().textMuted}>{progress(props.tamago())}</text>
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
  tamago: () => Tamago;
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
      <CardBody theme={props.theme} tamago={props.tamago} clock={props.clock} heart={props.heart} now={props.now} />
    </box>
  );
}
