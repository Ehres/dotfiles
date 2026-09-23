import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer, type Career } from "../../core/career/career.ts";
import { freshWindow } from "../../core/window.ts";
import { createActions, type Actions } from "../actions.ts";
import { createMirror, type Mirror } from "../mirror.ts";
import { fakeApi, type Kv } from "./fakes.tsx";

/** Past every Milestone, so every Draw is pending. */
const grown = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

/** The fake api, the Mirror over a fresh Window and the Actions over both, built the same way for every test. */
function harness(deps: { onLanguage?: () => void; career?: Career } = {}): { actions: Actions; mirror: Mirror; kv: Kv } {
  const { api, kv } = fakeApi();
  const mirror = createMirror(freshWindow(deps.career ?? grown), "Tamago", () => {});
  const actions = createActions({
    api,
    store: {} as never,
    mirror,
    warnCorrupt: () => {},
    guard: (fn) => fn,
    now: () => 42,
    onLanguage: deps.onLanguage ?? (() => {}),
  });
  return { actions, mirror, kv };
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

test("choosing a Language commits it, stores it and refreshes the palette", () => {
  let registered = 0;
  const { actions, mirror, kv } = harness({ onLanguage: () => registered++ });

  actions.setLanguage("fr");

  expect(mirror.language()).toBe("fr");
  expect(kv.get("tamago.language")).toBe("fr");
  expect(registered).toBe(1); // the palette titles are fixed at registration, so they must be rebuilt
});
