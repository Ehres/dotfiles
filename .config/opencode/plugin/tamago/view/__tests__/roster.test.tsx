/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { idOf } from "../../core/roster/roster.ts";
import { tamago, type Tamago } from "../../core/tamago.ts";
import { BAR_WIDTH, progress, sheetLines } from "../../core/text/card.ts";
import { line } from "../../core/text/roster.ts";
import { LanguageProvider } from "../language.tsx";
import { RosterView } from "../roster.tsx";
import { ThemeProvider } from "../theme.tsx";
import { EGG, OWNER } from "./fixtures.ts";
import { mount, trim } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

// Failing since the Sprite grew to 32 x 32 (task 2): a 16-row Sprite no longer fits DIALOG's
// fixture height of 26 alongside two roster lines and a Sheet, even with neither a held Trait nor
// a fifth Career — see the two overflow comments below ("the roster at five Careers" and "the
// roster at two Careers... holding one Trait"), which park the same defect and the same fix:
// DIALOG's real value is the user's to measure against the running TUI, not this fixture's to grow.
// This test throws before reaching either of its two toMatchSnapshot calls, so task 2's
// --update-snapshots run deleted both of its committed snapshot entries rather than updating them;
// they return once the overflow is settled, not before.
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

/**
 * Unlike the five-Careers overflow above, this needs no unbounded list: a
 * roster of just two Careers already overflows DIALOG once the selected one
 * holds a Trait, because the Trait block on its CardBody costs two extra
 * lines (view/card.tsx). It asserts on both roster lines and on every Sheet
 * bar, not just the tail, because at this height the corruption is not the
 * tail: the list's own two lines overlay into one — "Tamago 1" disappears —
 * and the Sheet's first bar ("energy") is silently dropped, while the last
 * Sheet bar and the xp bar beneath it stay intact. Asserting on the tail
 * alone would have passed while missing both.
 */
test("the roster at two Careers, the selected one holding one Trait: both roster lines and every Sheet bar", async () => {
  const kept = { ...OWNER, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } };
  const careers = [kept, { ...OWNER, hatchedAt: OWNER.hatchedAt + 1 }];
  const activeId = idOf(OWNER);
  const shown = careers.map((career) => tamago(career));
  const lines = careers.map((career, i) => line(career, `Tamago ${i + 1}`, activeId, "en"));
  const selected = shown[0] ?? tamago(kept);
  const { frame } = await mount(() => (
    <ThemeProvider theme={TUI_THEME}>
      <RosterView tamagos={shown} lines={lines} clock={0} now={0} onSelect={() => {}} />
    </ThemeProvider>
  ));
  const shownFrame = trim(await frame());
  for (const text of lines) expect(shownFrame).toContain(text);
  for (const bar of sheetLines(selected, "en")) expect(shownFrame).toContain(bar);
  expect(shownFrame).toContain(progress(selected, BAR_WIDTH, "en"));
});

// Overflowing too, and this one used to pass: a roster of one Career drops "énergie" just as the
// two-Career case above drops "energy", but nothing asserted on the Sheet, so the snapshot was
// regenerated around the missing bar and recorded the damage as correct. It asserts on every Sheet
// bar and the xp bar now, like its English neighbour, so it fails for the same honest reason. Its
// snapshot entry is deleted rather than kept: it comes back when the overflow is settled.
test("the roster reads in French", async () => {
  const one = tamago(OWNER);
  const shown = [one];
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
  for (const bar of sheetLines(one, "fr")) expect(shownFrame).toContain(bar);
  expect(shownFrame).toContain(progress(one, BAR_WIDTH, "fr"));
  expect(shownFrame).toMatchSnapshot();
});
