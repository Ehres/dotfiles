/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import { CardView } from "../card.tsx";
import { LanguageProvider } from "../language.tsx";
import { ThemeProvider } from "../theme.tsx";
import { BAR_WIDTH, DAY_MS, progress, sheetLines, traitLines } from "../../core/text/card.ts";
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

// Review Focus: the final review found the overflow's real trigger is Traits, not Careers — the
// card is documented (finding 2) to corrupt at four held Traits, the maximum a Tamago can hold (one
// per Milestone), against DIALOG's current 60x26. This does not change DIALOG (its real value is
// measured against the running TUI, not this fixture); it pins what happens at that height today.
//
// Asked to assert on the tail — the last Sheet bar and the xp bar, since that is what a silent
// overflow drops first. At this height it turns out the tail is NOT what drops: comparing this
// render against the same card in a tall (uncropped) fixture shows the xp bar and the last Sheet
// bar both survive, while three other rows silently vanish instead — the sprite's own top row, the
// oldest held Trait's title ("Hardy"), and the first Sheet bar ("energy"). A held Trait
// disappearing from the middle of the card is a worse failure than a truncated tail, so this
// asserts on every held Trait's title and every Sheet bar, not only the last one.
test("the card at four held Traits: every Trait's title, every Sheet bar and the xp bar", async () => {
  const now = OWNER.hatchedAt + 12 * DAY_MS;
  const fourTraits = {
    ...OWNER,
    picks: {
      "evolution:hatchling": { trait: "hardy", at: 1 },
      "evolution:young": { trait: "proud", at: 2 },
      "evolution:adult": { trait: "watchful", at: 3 },
      "evolution:elder": { trait: "unshaken", at: 4 },
    },
  };
  const t = tamago(fourTraits);
  expect(t.traits).toEqual(["hardy", "proud", "watchful", "unshaken"]);
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <CardView name="Tamago" tamago={t} clock={0} heart={false} now={now} />
    </ThemeProvider>
  ));
  expect(shown).toContain(progress(t, BAR_WIDTH, "en"));
  for (const line of sheetLines(t, "en")) expect(shown).toContain(line);
  for (const title of traitLines(t, "en")) expect(shown).toContain(title);
});
