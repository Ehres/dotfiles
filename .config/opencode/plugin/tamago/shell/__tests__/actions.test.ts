import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer, type Career } from "../../core/career/career.ts";
import { freshWindow } from "../../core/window.ts";
import { createActions, type Actions } from "../actions.ts";
import { createMirror, type Mirror } from "../mirror.ts";
import type { Prefs } from "../actions.ts";
import { fakeApi, fakePrefs } from "./fakes.tsx";

/** Past every Milestone, so every Draw is pending. */
const grown = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

/** The fake api, the Mirror over a fresh Window and the Actions over both, built the same way for every test. */
function harness(deps: { career?: Career } = {}): { actions: Actions; mirror: Mirror; prefs: Prefs } {
  const { api } = fakeApi();
  const { prefs, save } = fakePrefs();
  const mirror = createMirror(freshWindow(deps.career ?? grown), "Tamago", () => {});
  const actions = createActions({
    api,
    store: {} as never,
    mirror,
    warnCorrupt: () => {},
    guard: (fn) => fn,
    now: () => 42,
    savePrefs: save,
  });
  return { actions, mirror, prefs };
}

test("choosing keeps the Trait, shows it at once and leaves it pending for the flush", () => {
  createRoot((dispose) => {
    const { actions, mirror } = harness();
    const first = mirror.active().choices[0];
    expect(first).toBeDefined();
    const trait = first?.draw[0] ?? "";
    actions.choose(first?.milestone.id ?? "", trait);
    expect(mirror.career().picks[first?.milestone.id ?? ""]).toEqual({ trait, at: 42 });
    expect(mirror.current().pending.picks?.[first?.milestone.id ?? ""]?.trait).toBe(trait);
    dispose();
  });
});

test("choosing a Language commits it and stores it", () => {
  const { actions, mirror, prefs } = harness();

  actions.setLanguage("fr");

  expect(mirror.language()).toBe("fr");
  expect(prefs.language).toBe("fr");
});

test("muting commits it and stores it", () => {
  const { actions, mirror, prefs } = harness();

  actions.setMute(true);

  expect(mirror.muted()).toBe(true);
  expect(prefs.muted).toBe(true);
});
