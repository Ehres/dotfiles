/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import { CHOICE_BADGE } from "../../core/text/traits.ts";
import { HomeView } from "../home.tsx";
import { ThemeProvider } from "../theme.tsx";
import { OWNER } from "./fixtures.ts";
import { HOME, frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

/** OWNER with every reached Milestone picked: same stage and xp, but no Draw left pending. */
const PICKED = {
  ...OWNER,
  picks: {
    "evolution:hatchling": { trait: "watchful", at: 0 },
    "evolution:young": { trait: "watchful", at: 0 },
    "evolution:adult": { trait: "watchful", at: 0 },
  },
};

test("home: sprite left, name and stage, xp bar", async () => {
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <HomeView name="Tamago" tamago={tamago(OWNER)} clock={0} heart={false} />
      </ThemeProvider>
    ),
    HOME,
  );
  expect(shown).toContain("Tamago · adult");
  expect(shown).toContain("9,166 / 20,000 xp → elder");
  expect(shown).toMatchSnapshot();
});

test("a pending Draw shows on the Sprite, not beside the name", async () => {
  const withoutDraw = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <HomeView name="Tamago" tamago={tamago(PICKED)} clock={0} heart={false} />
      </ThemeProvider>
    ),
    HOME,
  );
  const withDraw = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <HomeView name="Tamago" tamago={tamago(OWNER)} clock={0} heart={false} />
      </ThemeProvider>
    ),
    HOME,
  );
  expect(withoutDraw).toContain("Tamago · adult");
  expect(withDraw).toContain("Tamago · adult");
  expect(withDraw).not.toBe(withoutDraw);
  expect(withDraw).not.toContain(CHOICE_BADGE);
});
