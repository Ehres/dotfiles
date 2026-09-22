/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { RGBA } from "@opentui/core";
import { createSignal } from "solid-js";
import { frameAt, heartFrame } from "../../core/appearance/sprites.ts";
import { MARK } from "../../core/appearance/marks.ts";
import { tamago } from "../../core/tamago.ts";
import { Sprite } from "../sprite.tsx";
import { ThemeProvider } from "../theme.tsx";
import { OWNER } from "./fixtures.ts";
import { frame as frameSnapshot, mount, trim } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

const INK = RGBA.fromHex("#ffffff");
const adult = tamago(OWNER);
const SIZE = { width: 12, height: 6 };

test("draws the frame of the Activity at the clock, and the heart while petted", async () => {
  const [clock, setClock] = createSignal(0);
  const [heart, setHeart] = createSignal(false);
  const { frame } = await mount(() => <Sprite tamago={adult} activity="working" clock={clock()} heart={heart()} color={INK} />, SIZE);
  expect(trim(await frame())).toBe(trim(frameAt("cat", "adult", "working", 0).join("\n")));
  setClock(adult.behavior.fastMs);
  expect(trim(await frame())).toBe(trim(frameAt("cat", "adult", "working", 1).join("\n")));
  setHeart(true);
  expect(trim(await frame())).toBe(trim(heartFrame("cat", "adult", adult.temperament).join("\n")));
});

test("a held Trait marks the sprite's top-left cell", async () => {
  const kept = { ...OWNER, picks: { "evolution:hatchling": { trait: "proud", at: 1 } } };
  const shown = await frameSnapshot(() => (
    <ThemeProvider theme={TUI_THEME}>
      <Sprite tamago={tamago(kept)} activity="idle" clock={0} heart={false} color={TUI_THEME.current.accent} />
    </ThemeProvider>
  ));
  expect(shown).toContain(MARK.proud!);
  expect(shown).toMatchSnapshot();
});
