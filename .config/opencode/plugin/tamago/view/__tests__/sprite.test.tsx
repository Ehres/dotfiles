/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { createSignal } from "solid-js";
import { frameAt, heartFrame } from "../../core/appearance/sprites.ts";
import type { Frame } from "../../core/appearance/pixels.ts";
import { MARK } from "../../core/appearance/marks.ts";
import { tamago } from "../../core/tamago.ts";
import { Sprite, glyphOf, mixed, skinOf } from "../sprite.tsx";
import { ThemeProvider } from "../theme.tsx";
import { OWNER } from "./fixtures.ts";
import { frame as frameSnapshot, mount, trim } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

const adult = tamago(OWNER);
/** Wide and tall enough for the 21 x 10 Frame. */
const SIZE = { width: 24, height: 12 };

/** The glyphs a Frame draws, ignoring colour: what `captureCharFrame` can compare against. */
function plain(shown: Frame): string {
  return shown.map((row) => row.map((cell) => glyphOf(cell).glyph).join("")).join("\n");
}

test("a cell with two opaque pixels of the same Role is a full block with no bg", () => {
  expect(glyphOf({ top: "primary", bottom: "primary" })).toEqual({ glyph: "█", fg: "primary", bg: null });
});

test("a cell with two opaque pixels of different Roles is an upper half with a bg", () => {
  expect(glyphOf({ top: "outline", bottom: "primary" })).toEqual({ glyph: "▀", fg: "outline", bg: "primary" });
});

test("a bg is never set when the bottom pixel is transparent", () => {
  expect(glyphOf({ top: "primary", bottom: null })).toEqual({ glyph: "▀", fg: "primary", bg: null });
  expect(glyphOf({ top: null, bottom: "primary" })).toEqual({ glyph: "▄", fg: "primary", bg: null });
});

test("an empty cell is a space with no colour at all", () => {
  expect(glyphOf({ top: null, bottom: null })).toEqual({ glyph: " ", fg: null, bg: null });
});

test("mixing toward a colour by 0 keeps it, by 1 replaces it", () => {
  expect(mixed("#000000", "#ffffff", 0)).toBe("#000000");
  expect(mixed("#000000", "#ffffff", 1)).toBe("#ffffff");
  expect(mixed("#000000", "#ffffff", 0.5)).toBe("#808080");
});

test("the theme variant is part of what a painted Sprite depends on", () => {
  // Review Focus: theme.mode() can flip mid-session.
  expect(skinOf("cat", "dark")).not.toEqual(skinOf("cat", "light"));
});

test("draws the frame of the Activity at the clock, and the heart while petted", async () => {
  const [clock, setClock] = createSignal(0);
  const [heart, setHeart] = createSignal(false);
  const { frame } = await mount(
    () => (
      <Sprite
        tamago={adult}
        activity="working"
        clock={clock()}
        heart={heart()}
        variant="dark"
        theme={TUI_THEME.current}
        badge={false}
      />
    ),
    SIZE,
  );
  expect(trim(await frame())).toBe(trim(plain(frameAt("cat", "adult", "working", 0))));
  setClock(adult.behavior.fastMs);
  expect(trim(await frame())).toBe(trim(plain(frameAt("cat", "adult", "working", 1))));
  setHeart(true);
  expect(trim(await frame())).toBe(trim(plain(heartFrame("cat", "adult", adult.temperament))));
});

test("a held Trait marks the sprite's top-left cell", async () => {
  const kept = { ...OWNER, picks: { "evolution:hatchling": { trait: "proud", at: 1 } } };
  const shown = await frameSnapshot(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <Sprite
          tamago={tamago(kept)}
          activity="idle"
          clock={0}
          heart={false}
          variant="dark"
          theme={TUI_THEME.current}
          badge={false}
        />
      </ThemeProvider>
    ),
    SIZE,
  );
  const mark = MARK.proud;
  if (mark === undefined) throw new Error('no mark for "proud" in MARK');
  expect(trim(shown)).toBe(trim(plain(frameAt("cat", "adult", "idle", 0, "proud"))));
  expect(shown).toMatchSnapshot();
});

test("the badge prop reaches the Frame: a pending Draw paints the top-right cell", async () => {
  const without = await frameSnapshot(
    () => (
      <Sprite tamago={adult} activity="idle" clock={0} heart={false} variant="dark" theme={TUI_THEME.current} badge={false} />
    ),
    SIZE,
  );
  const withBadge = await frameSnapshot(
    () => (
      <Sprite tamago={adult} activity="idle" clock={0} heart={false} variant="dark" theme={TUI_THEME.current} badge={true} />
    ),
    SIZE,
  );
  expect(trim(without)).toBe(trim(plain(frameAt("cat", "adult", "idle", 0, undefined, false))));
  expect(trim(withBadge)).toBe(trim(plain(frameAt("cat", "adult", "idle", 0, undefined, true))));
  expect(withBadge).not.toBe(without);
});
