/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import type { Bubble } from "../../core/speech/voice.ts";
import { CHOICE_BADGE } from "../../core/text/traits.ts";
import { LanguageProvider } from "../language.tsx";
import { SidebarView } from "../sidebar.tsx";
import { ThemeProvider } from "../theme.tsx";
import { EGG, FOOTER, OWNER, session } from "./fixtures.ts";
import { SIDEBAR, frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

const adult = tamago(OWNER);
const egg = tamago(EGG);

test("idle adult: sprite, name, stage and xp, mood, footer", async () => {
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Tamago" session={session("idle")} tamago={adult} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(shown).toContain("Tamago");
  expect(shown).toContain("adult · 9,166 xp");
  expect(shown).toContain("chilling");
  expect(shown).toContain("~/projects/");
  expect(shown).toMatchSnapshot();
});

test("idle adult reads in French: mood and grouped xp", async () => {
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <LanguageProvider language="fr">
          <SidebarView name="Tamago" session={session("idle")} tamago={adult} clock={0} footer={FOOTER} heart={false} />
        </LanguageProvider>
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(shown).toContain("adulte · 9 166 xp");
  expect(shown).toContain("tranquille");
  expect(shown).toMatchSnapshot();
});

test("hurt egg says ouch and draws the egg", async () => {
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Egg" session={session("hurt")} tamago={egg} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(shown).toContain("ouch");
  expect(shown).toContain("egg · 0 xp");
  expect(shown).toMatchSnapshot();
});

test("a Bubble sits above the sprite, the heart replaces the eyes", async () => {
  const bubble: Bubble = { cue: "permission", text: "May I?", since: 0, until: 5_000 };
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView
          name="Tamago"
          session={session("waiting")}
          tamago={adult}
          clock={0}
          footer={FOOTER}
          bubble={bubble}
          heart={true}
        />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(shown).toContain("( May I? )");
  expect(shown).toContain("♥");
  expect(shown).toContain("needs you");
  expect(shown).toMatchSnapshot();
});

test("a pending Draw puts a badge after the name; none without one", async () => {
  const waiting = { ...OWNER, sessions: 10_000 };
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <SidebarView name="Tamago" session={session("idle")} tamago={tamago(waiting)} clock={0} footer={FOOTER} heart={false} />
    </ThemeProvider>
  ));
  expect(shown).toContain(`Tamago ${CHOICE_BADGE}`);
  expect(shown).toMatchSnapshot();
});
