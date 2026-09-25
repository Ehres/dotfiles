/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import { CardView } from "../card.tsx";
import { LanguageProvider } from "../language.tsx";
import { ThemeProvider } from "../theme.tsx";
import { DAY_MS } from "../../core/text/card.ts";
import { EGG, OWNER } from "./fixtures.ts";
import { frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

test("the card of an adult: title row, species, age, character, four bars, xp bar", async () => {
  const now = OWNER.hatchedAt + 12 * DAY_MS;
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <CardView name="Tamago" tamago={tamago(OWNER)} clock={0} heart={false} now={now} />
    </ThemeProvider>
  ));
  expect(shown).toContain("esc");
  expect(shown).toContain("cat · common");
  expect(shown).toContain("12 days old");
  expect(shown).toContain("cheerful · bold shell");
  expect(shown).toContain("energy");
  expect(shown).toMatchSnapshot();
});

test("the card of an adult reads in French", async () => {
  const now = OWNER.hatchedAt + 12 * DAY_MS;
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <LanguageProvider language="fr">
        <CardView name="Tamago" tamago={tamago(OWNER)} clock={0} heart={false} now={now} />
      </LanguageProvider>
    </ThemeProvider>
  ));
  expect(shown).toContain("chat · commun");
  expect(shown).toContain("12 jours");
  expect(shown).toContain("énergie");
  expect(shown).toMatchSnapshot();
});

test("the card of an egg hides the species and the stats", async () => {
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <CardView name="Egg" tamago={tamago(EGG)} clock={0} heart={false} now={0} />
    </ThemeProvider>
  ));
  expect(shown).toContain("still an egg");
  expect(shown).toContain("stats show at hatching");
  expect(shown).toContain("hatched today");
  expect(shown).toMatchSnapshot();
});

test("the card carries what the sidebar dropped: name, species, stage, xp, age and mood", async () => {
  const now = OWNER.hatchedAt + 12 * DAY_MS;
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <CardView name="Tamago" tamago={tamago(OWNER)} clock={0} heart={false} now={now} />
    </ThemeProvider>
  ));
  expect(shown).toContain("Tamago");
  expect(shown).toContain("cat · common");
  expect(shown).toContain("adult · 9,166 xp");
  expect(shown).toContain("chilling");
});

test("the card lists the Traits held, with their marks", async () => {
  const kept = { ...OWNER, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } };
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <CardView name="Tamago" tamago={tamago(kept)} clock={0} heart={false} now={OWNER.hatchedAt} />
    </ThemeProvider>
  ));
  expect(shown).toContain("Hardy");
  expect(shown).toMatchSnapshot();
});
