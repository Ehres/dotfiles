import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer } from "../../core/career/career.ts";
import { freshWindow } from "../../core/window.ts";
import { createActions } from "../actions.ts";
import { createMirror } from "../mirror.ts";
import { fakeApi } from "./fakes.tsx";

/** Past every Milestone, so every Draw is pending. */
const grown = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

test("choosing keeps the Trait, shows it at once and leaves it pending for the flush", () => {
  createRoot((dispose) => {
    const { api } = fakeApi();
    const mirror = createMirror(freshWindow(grown), "Tamago", () => {});
    const actions = createActions({ api, store: {} as never, mirror, warnCorrupt: () => {}, guard: (fn) => fn, now: () => 42 });
    const first = mirror.active().choices[0];
    expect(first).toBeDefined();
    const trait = first?.draw[0] ?? "";
    actions.choose(first?.milestone.id ?? "", trait);
    expect(mirror.career().picks[first?.milestone.id ?? ""]).toEqual({ trait, at: 42 });
    expect(mirror.current().pending.picks?.[first?.milestone.id ?? ""]?.trait).toBe(trait);
    dispose();
  });
});
