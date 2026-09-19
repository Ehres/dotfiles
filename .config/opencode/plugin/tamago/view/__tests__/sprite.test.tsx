/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { RGBA } from "@opentui/core";
import { createSignal } from "solid-js";
import { frameAt, heartFrame } from "../../core/appearance/sprites.ts";
import { tamago } from "../../core/tamago.ts";
import { Sprite } from "../sprite.tsx";
import { OWNER } from "./fixtures.ts";
import { mount, trim } from "./render.tsx";

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
