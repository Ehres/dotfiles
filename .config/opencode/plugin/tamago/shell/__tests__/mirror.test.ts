import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer } from "../../core/career/career.ts";
import { freshWindow, receive, setLanguage } from "../../core/window.ts";
import type { Effect } from "../../core/window.ts";
import { createMirror } from "../mirror.ts";

test("commit mirrors only the parts that changed, run performs the effects", () => {
  createRoot((dispose) => {
    const effects: Effect[] = [];
    const window = freshWindow(freshCareer(0));
    const mirror = createMirror(window, "Tamago", (effect) => effects.push(effect));
    expect(mirror.name()).toBe("Tamago");
    const sessionsBefore = mirror.sessions();
    const step = receive(window, { target: { type: "session", id: "a" }, event: { type: "prompt_sent" } }, 1);
    mirror.run(step);
    expect(mirror.current()).toBe(step.window);
    expect(mirror.sessions()).not.toBe(sessionsBefore);
    expect(mirror.sessions().a?.activity).toBe("thinking");
    expect(mirror.career().prompts).toBe(1);
    expect(mirror.active().career).toBe(step.window.career);
    expect(effects).toEqual([]);
    dispose();
  });
});

test("commit mirrors the language only when it changed", () => {
  createRoot((dispose) => {
    const window = freshWindow(freshCareer(0));
    const mirror = createMirror(window, "Tamago", () => {});
    expect(mirror.language()).toBe("en");

    mirror.commit(setLanguage(mirror.current(), "fr"));
    const afterChange = mirror.current();
    expect(mirror.language()).toBe("fr");

    mirror.commit(setLanguage(mirror.current(), "fr"));
    expect(mirror.current()).toBe(afterChange); // same Language again: setLanguage returns the same Window, so nobody is resignaled
    expect(mirror.language()).toBe("fr");
    dispose();
  });
});

test("a rename effect reaches onEffect with the new Name already readable", () => {
  createRoot((dispose) => {
    const seen: string[] = [];
    const window = freshWindow(freshCareer(0));
    const mirror = createMirror(window, "Tamago", () => seen.push(mirror.name()));
    mirror.run({ window: { ...window, career: { ...window.career, name: { value: "Mochi", at: 1 } } }, effects: [{ type: "renamed" }] });
    expect(seen).toEqual(["Mochi"]);
    dispose();
  });
});
