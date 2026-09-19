/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { Index } from "solid-js";
import { age, progress, sheetLines, speciesLine } from "../core/appearance/card.ts";
import { fmt } from "../core/appearance/format.ts";
import { describe } from "../core/creature/character.ts";
import type { Tamago } from "../core/tamago.ts";
import { DialogFrame } from "./dialog.tsx";
import { Sprite } from "./sprite.tsx";
import { useTheme } from "./theme.tsx";

/**
 * Everything a card shows under its title row, for any Tamago: the idle
 * Portrait (or the heart), Species and Rarity, Stage and XP, age, the
 * Character, the Sheet bars, the XP bar. Everything is read from the Tamago
 * the shell derived from the Career, so the roster view can show a resting
 * Career too, by handing over the Tamago read from it.
 */
export function CardBody(props: { tamago: Tamago; clock: number; heart: boolean; now: number }): JSX.Element {
  const theme = useTheme();
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <Sprite tamago={props.tamago} activity="idle" clock={props.clock} heart={props.heart} color={theme.current.accent} />
        <box flexDirection="column" justifyContent="center">
          <text fg={theme.current.textMuted}>{speciesLine(props.tamago)}</text>
          <text fg={theme.current.textMuted}>
            {props.tamago.stage} · {fmt(props.tamago.xp)} xp
          </text>
          <text fg={theme.current.textMuted}>{age(props.tamago.career.hatchedAt, props.now)}</text>
        </box>
      </box>
      <text fg={theme.current.textMuted}>{describe(props.tamago.character)}</text>
      <box flexDirection="column">
        <Index each={sheetLines(props.tamago)}>{(line) => <text fg={theme.current.textMuted}>{line()}</text>}</Index>
      </box>
      <text fg={theme.current.textMuted}>{progress(props.tamago)}</text>
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
  tamago: Tamago;
  clock: number;
  heart: boolean;
  now: number;
}): JSX.Element {
  return (
    <DialogFrame title={props.name}>
      <CardBody tamago={props.tamago} clock={props.clock} heart={props.heart} now={props.now} />
    </DialogFrame>
  );
}
