/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import { HomeView } from "../home.tsx";
import { ThemeProvider } from "../theme.tsx";
import { OWNER } from "./fixtures.ts";
import { HOME, frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

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
