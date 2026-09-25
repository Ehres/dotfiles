/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import { paletteOf } from "../core/creature/catalog.ts";
import type { Variant } from "../core/appearance/palette.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import type { Cell, Frame, Role } from "../core/appearance/pixels.ts";
import { MARK, markOf } from "../core/appearance/marks.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import type { Activity } from "../core/moment/session.ts";
import type { Tamago } from "../core/tamago.ts";

const FULL = "█";
const UPPER = "▀";
const LOWER = "▄";

/** The whole rendering rule. A bg is set only under an opaque bottom pixel, so no rectangle ever shows. */
export function glyphOf(cell: Cell): { glyph: string; fg: Role | null; bg: Role | null } {
  if (cell.top !== null && cell.bottom !== null) {
    return cell.top === cell.bottom ? { glyph: FULL, fg: cell.top, bg: null } : { glyph: UPPER, fg: cell.top, bg: cell.bottom };
  }
  if (cell.top !== null) return { glyph: UPPER, fg: cell.top, bg: null };
  if (cell.bottom !== null) return { glyph: LOWER, fg: cell.bottom, bg: null };
  return { glyph: " ", fg: null, bg: null };
}

/** Moves a hex colour toward another by `amount` in [0, 1]. Lowercase `#rrggbb` in, the same out. */
export function mixed(from: string, towards: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const a = parse(from);
  const b = parse(towards);
  const channel = (i: number) => Math.round((a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * amount);
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, "0")).join("")}`;
}

export function skinOf(species: string, variant: Variant) {
  return paletteOf(species, variant);
}

/**
 * Which theme colour an Activity pulls the Palette toward, and how far. Only
 * the three keys `TuiThemeCurrent` actually offers here are legal, so
 * `props.theme[tint.color]` is an `RGBA` with no cast needed.
 */
type Tint = { color: "warning" | "error" | "textMuted"; amount: number };

/** One row per Activity: a new Activity with no row here is a compile error, never a silent fallback. */
export const TINT: Record<Activity, Tint | null> = {
  idle: null,
  thinking: null,
  working: null,
  waiting: { color: "warning", amount: 0.45 },
  hurt: { color: "error", amount: 0.45 },
  sleeping: { color: "textMuted", amount: 0.45 },
};

function hex(color: RGBA): string {
  const [r, g, b] = color.toInts();
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The Sprite of a Tamago for an Activity at a moment of the clock: the heart
 * while petted, else the Frame the Behavior's cadence lands on. Frames are
 * cached in core, so the memo hands back the same reference for the same
 * frame and a tick that changes nothing re-renders nothing. The colour a Role
 * paints as is its own memo: the Palette tinted toward the theme, computed
 * once per variant/theme/activity change, never per cell.
 */
export function Sprite(props: {
  tamago: Tamago;
  activity: Activity;
  clock: number;
  heart: boolean;
  variant: Variant;
  theme: TuiThemeCurrent;
  badge: boolean;
}): JSX.Element {
  const frame = createMemo((): Frame => {
    const t = props.tamago;
    const mark = markOf(t.traits);
    return props.heart
      ? heartFrame(t.species.id, t.stage, t.temperament, mark, props.badge)
      : frameAt(t.species.id, t.stage, props.activity, frameIndex(props.activity, props.clock, t.behavior), mark, props.badge);
  });

  const colours = createMemo((): Record<Role, RGBA> => {
    const skin = paletteOf(props.tamago.species.id, props.variant);
    const tint = TINT[props.activity];
    const shade = (value: string) => RGBA.fromHex(tint === null ? value : mixed(value, hex(props.theme[tint.color]), tint.amount));
    // The mark itself carries no colour (core is colour-free): the Trait it marks names a theme key,
    // and this is the one place that key becomes an RGBA.
    const marked = markOf(props.tamago.traits);
    const markColor = marked === undefined ? "success" : (MARK[marked]?.color ?? "success");
    return {
      outline: shade(skin.outline),
      primary: shade(skin.primary),
      secondary: shade(skin.secondary),
      accent: shade(skin.accent),
      eye: shade(skin.eye),
      mark: props.theme[markColor],
      badge: props.theme.warning,
      heart: props.theme.error,
    };
  });

  return (
    <box flexDirection="column" flexShrink={0}>
      <Index each={frame()}>
        {(row) => (
          <text>
            <Index each={row()}>
              {(cell) => {
                // Index hands back a signal, not a value: reading it in a plain
                // statement here would freeze on the first Frame forever. Each of
                // these must be its own memo so `cell()` is read inside a tracked
                // scope and the span keeps repainting as the Frame changes.
                const drawn = createMemo(() => glyphOf(cell()));
                const style = createMemo(() => {
                  const shown = drawn();
                  const palette = colours();
                  return {
                    ...(shown.fg === null ? {} : { fg: palette[shown.fg] }),
                    ...(shown.bg === null ? {} : { bg: palette[shown.bg] }),
                  };
                });
                return <span style={style()}>{drawn().glyph}</span>;
              }}
            </Index>
          </text>
        )}
      </Index>
    </box>
  );
}
