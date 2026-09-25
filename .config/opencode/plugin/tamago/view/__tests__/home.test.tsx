/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { BADGE_SLOT } from "../../core/appearance/marks.ts";
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

/**
 * The BADGE_SLOT corner of the rendered Sprite, read directly out of the frame
 * text rather than diffed against another frame — a fixture that also moves
 * MARK_SLOT (the other corner) must not be able to fake this. HomeView wraps
 * the Sprite in a `paddingTop={1}` box, so BADGE_SLOT's pixel rows 0-2 land on
 * text lines 1-2; `frame()` trims trailing spaces per line, so a blank corner
 * can end a line early, hence the `padEnd` before slicing.
 */
function badgeCorner(shown: string): string {
  const lines = shown.split("\n");
  const paddingTop = 1;
  const firstRow = Math.floor(BADGE_SLOT.y / 2);
  const lastRow = Math.floor((BADGE_SLOT.y + BADGE_SLOT.h - 1) / 2);
  const width = BADGE_SLOT.x + BADGE_SLOT.w;
  const rows: string[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    const line = lines[paddingTop + row] ?? "";
    rows.push(line.padEnd(width).slice(BADGE_SLOT.x, width));
  }
  return rows.join("|");
}

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
  expect(withDraw).not.toContain(CHOICE_BADGE);

  const blank = "   |   ";
  expect(badgeCorner(withoutDraw)).toBe(blank);
  expect(badgeCorner(withDraw)).not.toBe(blank);
});
