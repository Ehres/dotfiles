/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago, type Tamago } from "../../core/tamago.ts";
import { RosterView } from "../roster.tsx";
import { EGG, OWNER } from "./fixtures.ts";
import { mount, trim } from "./render.tsx";
import { THEME } from "./theme.ts";

test("the roster highlights the first line, moves with the arrows, selects with return", async () => {
  const shown = [tamago(OWNER), tamago(EGG)];
  const lines = ["Tamago · cat · adult · active", "Egg · egg"];
  let chosen: Tamago | undefined;
  const { frame, mockInput } = await mount(() => (
    <RosterView theme={THEME} tamagos={shown} lines={lines} clock={0} now={0} onSelect={(one) => (chosen = one)} />
  ));
  const first = trim(await frame());
  expect(first).toContain("> Tamago · cat · adult · active");
  expect(first).toContain("  Egg · egg");
  expect(first).toContain("cat · common");
  expect(first).toMatchSnapshot();

  await mockInput.pressKey("ARROW_DOWN");
  const second = trim(await frame());
  expect(second).toContain("> Egg · egg");
  expect(second).toContain("still an egg");
  expect(second).toMatchSnapshot();

  await mockInput.pressKey("RETURN");
  expect(chosen).toBe(shown[1]);
});
