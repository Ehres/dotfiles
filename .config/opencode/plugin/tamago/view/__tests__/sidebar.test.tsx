/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import type { Bubble } from "../../core/speech/voice.ts";
import { SidebarView } from "../sidebar.tsx";
import { ThemeProvider } from "../theme.tsx";
import { EGG, FOOTER, OWNER, session } from "./fixtures.ts";
import { SIDEBAR, frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

const adult = tamago(OWNER);
const egg = tamago(EGG);

function sidebar() {
  return frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Tamago" session={session("idle")} tamago={adult} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
}

test("idle adult: the creature and the footer", async () => {
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Tamago" session={session("idle")} tamago={adult} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(shown).toContain("~/projects/");
  expect(shown).toMatchSnapshot();
});

test("the sidebar's content stays inside the real 37 columns", async () => {
  // Rendered wider than the real sidebar on purpose: at exactly 37 the viewport
  // clips an overflow instead of revealing it, so the assertion could never fail.
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Tamago" session={session("idle")} tamago={adult} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    { width: 60, height: SIDEBAR.height },
  );
  for (const line of shown.split("\n")) expect(line.length).toBeLessThanOrEqual(37);
});

test("the sidebar holds no name, no stage, no xp and no mood", async () => {
  const shown = await sidebar();
  expect(shown).not.toContain("Tamago");
  expect(shown).not.toContain("adult · 9,166 xp");
  expect(shown).not.toContain("chilling");
});

test("hurt egg: draws the egg, no mood or xp text, and the footer", async () => {
  const shown = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Egg" session={session("hurt")} tamago={egg} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(shown).not.toContain("ouch");
  expect(shown).not.toContain("egg · 0 xp");
  expect(shown).toContain("~/projects/");
  expect(shown).toMatchSnapshot();
});

test("a Bubble sits above the sprite; petting changes the drawn sprite", async () => {
  const bubble: Bubble = { cue: "permission", text: "May I?", since: 0, until: 5_000 };
  const render = (heart: boolean) =>
    frame(
      () => (
        <ThemeProvider theme={TUI_THEME}>
          <SidebarView
            name="Tamago"
            session={session("waiting")}
            tamago={adult}
            clock={0}
            footer={FOOTER}
            bubble={bubble}
            heart={heart}
          />
        </ThemeProvider>
      ),
      SIDEBAR,
    );
  const petted = await render(true);
  const notPetted = await render(false);
  expect(petted).toContain("( May I? )");
  expect(petted).not.toContain("needs you");
  expect(petted).not.toBe(notPetted);
  expect(petted).toMatchSnapshot();
});

test("a pending Draw changes the drawn sprite; none without one", async () => {
  const waiting = { ...OWNER, sessions: 10_000 };
  const withoutDraw = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Tamago" session={session("idle")} tamago={adult} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  const withDraw = await frame(
    () => (
      <ThemeProvider theme={TUI_THEME}>
        <SidebarView name="Tamago" session={session("idle")} tamago={tamago(waiting)} clock={0} footer={FOOTER} heart={false} />
      </ThemeProvider>
    ),
    SIDEBAR,
  );
  expect(withDraw).not.toBe(withoutDraw);
  expect(withDraw).toMatchSnapshot();
});
