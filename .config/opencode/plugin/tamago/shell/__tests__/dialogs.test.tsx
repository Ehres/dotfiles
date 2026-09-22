/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer, type Career } from "../../core/career/career.ts";
import { NOTHING_TO_CHOOSE } from "../../core/text/traits.ts";
import { freshWindow } from "../../core/window.ts";
import { frame } from "../../view/__tests__/render.tsx";
import { createActions } from "../actions.ts";
import { createDialogs } from "../dialogs.tsx";
import { createMirror } from "../mirror.ts";
import { fakeApi } from "./fakes.tsx";

const grown: Career = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

function harness(career: Career = grown) {
  const { api, toasts, shown } = fakeApi();
  const mirror = createMirror(freshWindow(career), "Tamago", () => {});
  const actions = createActions({ api, store: {} as never, mirror, warnCorrupt: () => {}, guard: (fn) => fn, now: () => 42 });
  const dialogs = createDialogs({
    api,
    store: {} as never,
    mirror,
    actions,
    clock: () => 0,
    started: 0,
    defaultName: "Tamago",
    warnCorrupt: () => {},
    guard: (fn) => fn,
  });
  return { dialogs, toasts, shown, mirror };
}

test("the Draw dialog offers the Traits of the first pending Milestone", async () => {
  const { dialogs, shown } = harness();
  createRoot(() => dialogs.askChoice());
  const node = shown();
  expect(node).toBeDefined();
  const drawn = await frame(node ?? (() => null));
  expect(drawn).toContain("Keep one");
  expect(drawn).toContain("Hardy");
});

test("with nothing pending the command toasts instead of opening a dialog", () => {
  const { dialogs, toasts, shown } = harness(freshCareer(1_700_000_000_000));
  createRoot(() => dialogs.askChoice());
  expect(shown()).toBeUndefined();
  expect(toasts.at(-1)?.message).toBe(NOTHING_TO_CHOOSE);
});
