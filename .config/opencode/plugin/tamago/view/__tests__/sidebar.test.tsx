/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { tamago } from "../../core/tamago.ts";
import type { Bubble } from "../../core/speech/voice.ts";
import { SidebarView } from "../sidebar.tsx";
import { EGG, FOOTER, OWNER, session } from "./fixtures.ts";
import { SIDEBAR, frame } from "./render.tsx";
import { THEME } from "./theme.ts";

const adult = tamago(OWNER);
const egg = tamago(EGG);

test("idle adult: sprite, name, stage and xp, mood, footer", async () => {
  const shown = await frame(
    () => (
      <SidebarView
        name="Tamago"
        theme={() => THEME}
        session={() => session("idle")}
        tamago={() => adult}
        clock={() => 0}
        footer={() => FOOTER}
        bubble={() => undefined}
        heart={() => false}
      />
    ),
    SIDEBAR,
  );
  expect(shown).toContain("Tamago");
  expect(shown).toContain("adult · 9,166 xp");
  expect(shown).toContain("chilling");
  expect(shown).toContain("~/projects/");
  expect(shown).toMatchSnapshot();
});

test("hurt egg says ouch and draws the egg", async () => {
  const shown = await frame(
    () => (
      <SidebarView
        name="Egg"
        theme={() => THEME}
        session={() => session("hurt")}
        tamago={() => egg}
        clock={() => 0}
        footer={() => FOOTER}
        bubble={() => undefined}
        heart={() => false}
      />
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
      <SidebarView
        name="Tamago"
        theme={() => THEME}
        session={() => session("waiting")}
        tamago={() => adult}
        clock={() => 0}
        footer={() => FOOTER}
        bubble={() => bubble}
        heart={() => true}
      />
    ),
    SIDEBAR,
  );
  expect(shown).toContain("( May I? )");
  expect(shown).toContain("♥");
  expect(shown).toContain("needs you");
  expect(shown).toMatchSnapshot();
});
