/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import { CardView } from "../card.tsx";
import { DAY_MS } from "../../core/appearance/card.ts";
import { EGG, OWNER } from "./fixtures.ts";
import { frame } from "./render.tsx";
import { THEME } from "./theme.ts";

test("the card of an adult: title row, species, age, character, four bars, xp bar", async () => {
  const now = OWNER.hatchedAt + 12 * DAY_MS;
  const shown = await frame(() => (
    <CardView name="Tamago" theme={() => THEME} tamago={() => tamago(OWNER)} clock={() => 0} heart={() => false} now={() => now} />
  ));
  expect(shown).toContain("esc");
  expect(shown).toContain("cat · common");
  expect(shown).toContain("12 days old");
  expect(shown).toContain("cheerful · bold shell");
  expect(shown).toContain("energy");
  expect(shown).toMatchSnapshot();
});

test("the card of an egg hides the species and the stats", async () => {
  const shown = await frame(() => (
    <CardView name="Egg" theme={() => THEME} tamago={() => tamago(EGG)} clock={() => 0} heart={() => false} now={() => 0} />
  ));
  expect(shown).toContain("still an egg");
  expect(shown).toContain("stats show at hatching");
  expect(shown).toContain("hatched today");
  expect(shown).toMatchSnapshot();
});
