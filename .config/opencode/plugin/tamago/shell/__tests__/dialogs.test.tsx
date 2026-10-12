/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer, type Career } from "../../core/career/career.ts";
import { say } from "../../core/language.ts";
import { CHOSEN_ELSEWHERE, NOTHING_TO_CHOOSE } from "../../core/text/traits.ts";
import { adopt, freshWindow } from "../../core/window.ts";
import { TUI_THEME } from "../../view/__tests__/theme.ts";
import { createActions } from "../actions.ts";
import { createDialogs } from "../dialogs.tsx";
import { createMirror } from "../mirror.ts";
import { fakeApi, fakePrefs } from "./fakes.tsx";

const grown: Career = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

function harness(career: Career = grown) {
  const { api, toasts, shown, select } = fakeApi();
  const mirror = createMirror(freshWindow(career), "Tamago", () => {});
  const actions = createActions({ api, store: {} as never, mirror, warnCorrupt: () => {}, guard: (fn) => fn, now: () => 42, savePrefs: fakePrefs().save });
  const dialogs = createDialogs({
    api,
    theme: TUI_THEME,
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

/** Lets the select's promise settle, as the next turn of OpenCode's event loop would. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the Draw dialog offers the Traits of the first pending Milestone", () => {
  const { dialogs, select } = harness();
  createRoot(() => dialogs.askChoice());
  const asked = select()?.options;
  expect(asked?.title).toBe("Keep one");
  expect(asked?.options.map((option) => option.title)).toContain("Hardy");
});

test("with nothing pending the command toasts instead of opening a dialog", () => {
  const { dialogs, toasts, select } = harness(freshCareer(1_700_000_000_000));
  createRoot(() => dialogs.askChoice());
  expect(select()).toBeUndefined();
  expect(toasts.at(-1)?.message).toBe(say(NOTHING_TO_CHOOSE, "en"));
});

test("choosing through the dialog keeps the Pick and never says chosen elsewhere", async () => {
  const { dialogs, toasts, select, mirror } = harness();
  const first = mirror.active().choices[0];
  expect(first).toBeDefined();
  if (first === undefined) throw new Error("no Draw pending");
  const milestone = first.milestone.id;
  createRoot(() => dialogs.askChoice());
  const asked = select();
  const option = asked?.options.options[0];
  expect(option).toBeDefined();
  if (asked === undefined || option === undefined) throw new Error("no Trait offered");
  asked.answer(option.value);
  await settled();
  expect(mirror.career().picks[milestone]).toEqual({ trait: option.value, at: 42 });
  expect(toasts.some((toast) => toast.message === say(CHOSEN_ELSEWHERE, "en"))).toBe(false);
});

test("a Pick landing from another window closes the dialog and says so, exactly once", async () => {
  const { dialogs, toasts, select, mirror } = harness();
  const first = mirror.active().choices[0];
  expect(first).toBeDefined();
  if (first === undefined) throw new Error("no Draw pending");
  const milestone = first.milestone.id;
  const trait = first.draw[0];
  expect(trait).toBeDefined();
  if (trait === undefined) throw new Error("no Trait drawn");
  createRoot(() => dialogs.askChoice());
  expect(select()).toBeDefined();
  // The disk hands back a Career with the Milestone already picked: the same path tui.tsx's
  // persist() takes when a re-read shows another window flushed first.
  const remoteCareer: Career = { ...mirror.career(), picks: { ...mirror.career().picks, [milestone]: { trait, at: 99 } } };
  mirror.run(adopt(mirror.current(), remoteCareer, 100));
  await settled();
  expect(select()).toBeUndefined();
  expect(mirror.career().picks[milestone]).toEqual({ trait, at: 99 }); // the cleared select chose nothing of ours
  expect(toasts.filter((toast) => toast.message === say(CHOSEN_ELSEWHERE, "en"))).toHaveLength(1);
});
