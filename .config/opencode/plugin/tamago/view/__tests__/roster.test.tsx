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
 * A real machine's roster is unbounded (adapter/store.ts reads every resting
 * Career file with no limit), so five adult Careers — the worst case per
 * entry, one line each above a full CardBody — is a realistic size, not a
 * stress test. DIALOG (60x26) was only ever checked against two entries. This
 * pins what actually happens at five: the overflow does not clip cleanly off
 * the bottom, it corrupts. The xp bar survives at the very bottom, but the
 * sheet's first bar ("energy") is silently dropped, and the list itself
 * overlays its first two lines into one (the same character-overlay failure
 * mode Task 8 fixed for the sidebar, resurfacing here one row earlier than
 * this task's height check covered). See the snapshot for the full picture.
 */
test("the roster at a realistic size (five adult Careers) corrupts, rather than clips, the overflow", async () => {
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
  expect(shownFrame).not.toContain("energy");
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
