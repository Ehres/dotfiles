/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { idOf } from "../../core/roster/roster.ts";
import { tamago, type Tamago } from "../../core/tamago.ts";
import { line } from "../../core/text/roster.ts";
import { LanguageProvider } from "../language.tsx";
import { RosterView } from "../roster.tsx";
import { ThemeProvider } from "../theme.tsx";
import { EGG, OWNER } from "./fixtures.ts";
import { mount, trim } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

test("the roster highlights the first line, moves with the arrows, selects with return", async () => {
  const shown = [tamago(OWNER), tamago(EGG)];
  const lines = ["Tamago · cat · adult · active", "Egg · egg"];
  let chosen: Tamago | undefined;
  const { frame, mockInput } = await mount(() => (
    <ThemeProvider theme={TUI_THEME}>
      <RosterView tamagos={shown} lines={lines} clock={0} now={0} onSelect={(one) => (chosen = one)} />
    </ThemeProvider>
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

/**
 * Parked, not fixed: a real machine's roster is unbounded (adapter/store.ts
 * reads every resting Career file with no limit), so past two entries this
 * overflows DIALOG, and the overflow corrupts rather than clips — the list's
 * first two lines overlay into one, and the sheet's first bar ("energy") is
 * silently dropped, while the xp bar below it survives untouched. Choosing
 * among scrolling, a list cap, or a shorter roster card body is a product
 * decision on a surface this branch was told not to touch, so it is left to
 * the user; this test only pins what happens today so the defect is not
 * forgotten, and does not demand it keep happening.
 */
test("the roster at five Careers: a known overflow, pinned here until it is decided", async () => {
  const careers = Array.from({ length: 5 }, (_, i) => ({ ...OWNER, hatchedAt: OWNER.hatchedAt + i }));
  const activeId = idOf(OWNER);
  const shown = careers.map((career) => tamago(career));
  const lines = careers.map((career, i) => line(career, `Tamago ${i + 1}`, activeId, "en"));
  const { frame } = await mount(() => (
    <ThemeProvider theme={TUI_THEME}>
      <RosterView tamagos={shown} lines={lines} clock={0} now={0} onSelect={() => {}} />
    </ThemeProvider>
  ));
  const shownFrame = trim(await frame());
  expect(shownFrame).toContain("9,166 / 20,000 xp → elder");
  expect(shownFrame).toMatchSnapshot();
});

test("the roster reads in French", async () => {
  const shown = [tamago(OWNER)];
  const lines = [line(OWNER, "Tamago", OWNER.hatchedAt, "fr")];
  const { frame } = await mount(() => (
    <ThemeProvider theme={TUI_THEME}>
      <LanguageProvider language="fr">
        <RosterView tamagos={shown} lines={lines} clock={0} now={0} onSelect={() => {}} />
      </LanguageProvider>
    </ThemeProvider>
  ));
  const shownFrame = trim(await frame());
  expect(shownFrame).toContain("Tamago · chat · adulte · actif");
  expect(shownFrame).toContain("chat · commun");
  expect(shownFrame).toMatchSnapshot();
});
