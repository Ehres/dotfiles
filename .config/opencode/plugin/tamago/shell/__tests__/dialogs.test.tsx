/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer, type Career } from "../../core/career/career.ts";
import { CHOSEN_ELSEWHERE, NOTHING_TO_CHOOSE } from "../../core/text/traits.ts";
import { adopt, freshWindow } from "../../core/window.ts";
import { frame } from "../../view/__tests__/render.tsx";
import { createActions } from "../actions.ts";
import { createDialogs } from "../dialogs.tsx";
import { createMirror } from "../mirror.ts";
import { fakeApi } from "./fakes.tsx";

const grown: Career = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

function harness(career: Career = grown) {
  const { api, toasts, shown, select } = fakeApi();
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
  return { dialogs, toasts, shown, select, mirror };
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

test("choosing through the dialog keeps the Pick, clears the dialog and never says chosen elsewhere", async () => {
  const { dialogs, toasts, shown, select, mirror } = harness();
  const first = mirror.active().choices[0];
  expect(first).toBeDefined();
  if (first === undefined) throw new Error("no Draw pending");
  const milestone = first.milestone.id;
  createRoot(() => dialogs.askChoice());
  const node = shown();
  expect(node).toBeDefined();
  await frame(node ?? (() => null));
  const props = select();
  expect(props).toBeDefined();
  const option = props?.options[0];
  expect(option).toBeDefined();
  if (option === undefined) throw new Error("no Trait offered");
  props?.onSelect?.(option);
  expect(mirror.career().picks[milestone]).toEqual({ trait: option.value, at: 42 });
  expect(shown()).toBeUndefined();
  expect(toasts.some((toast) => toast.message === CHOSEN_ELSEWHERE)).toBe(false);
});

test("a Pick landing from another window closes the dialog and says so, exactly once", async () => {
  const { dialogs, toasts, shown, mirror } = harness();
  const first = mirror.active().choices[0];
  expect(first).toBeDefined();
  if (first === undefined) throw new Error("no Draw pending");
  const milestone = first.milestone.id;
  const trait = first.draw[0];
  expect(trait).toBeDefined();
  if (trait === undefined) throw new Error("no Trait drawn");
  createRoot(() => dialogs.askChoice());
  const node = shown();
  expect(node).toBeDefined();
  await frame(node ?? (() => null));
  // The disk hands back a Career with the Milestone already picked: the same path index.tsx's
  // persist() takes when a re-read shows another window flushed first.
  const remoteCareer: Career = { ...mirror.career(), picks: { ...mirror.career().picks, [milestone]: { trait, at: 99 } } };
  mirror.run(adopt(mirror.current(), remoteCareer, 100));
  expect(shown()).toBeUndefined();
  expect(toasts.filter((toast) => toast.message === CHOSEN_ELSEWHERE)).toHaveLength(1);
});
