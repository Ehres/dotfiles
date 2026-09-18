import { test } from "node:test";
import assert from "node:assert/strict";
import { behavior } from "./behavior.ts";
import type { Addressed } from "./events.ts";
import { HURT_MS, SLEEP_MS } from "./events.ts";
import { speakerOf } from "./sheet.ts";
import { STAGES, WEIGHTS } from "./stage.ts";
import { EMPTY_DELTA, freshCareer, isEmpty, type Career } from "./state.ts";
import { phrase } from "./voice.ts";
import { adopt, flushed, freshWindow, receive, rename, setMuted, tick, type Window } from "./window.ts";

const T0 = 1_000_000;
const to = (id: string, event: Addressed["event"]): Addressed => ({ target: { type: "session", id }, event });
const every = (event: Addressed["event"]): Addressed => ({ target: { type: "every" }, event });
const none = (event: Addressed["event"]): Addressed => ({ target: { type: "none" }, event });

/** Career of the reference cat at a given hatch date. */
const cat = (at: number): Career => ({ ...freshCareer(at), species: "cat" });

/** A Window with two Sessions already moving, so "every" has someone to reach. */
function twoSessions(): Window {
  let w = freshWindow(cat(T0));
  w = receive(w, to("a", { type: "prompt_sent" }), T0).window;
  w = receive(w, to("b", { type: "prompt_sent" }), T0).window;
  return w;
}

/** Sessions worth exactly the XP of `stage`, so one more prompt crosses into it. */
function careerJustBelow(stage: (typeof STAGES)[number]["id"]): Career {
  const threshold = STAGES.find((entry) => entry.id === stage)?.xp ?? 0;
  return { ...cat(T0), sessions: (threshold - WEIGHTS.prompts) / WEIGHTS.sessions };
}

test("an event addressed to a Session moves that Session only and counts once", () => {
  const w = twoSessions();
  const { window: next } = receive(w, to("a", { type: "tool_started" }), T0 + 1);
  assert.equal(next.sessions.a?.activity, "working");
  assert.equal(next.sessions.b?.activity, "thinking");
  assert.equal(next.pending.prompts, 2, "the two prompts counted once each");
  assert.equal(next.career.prompts, 2, "shown at once in the Career");
});

test("an event addressed to every Session moves them all but counts once", () => {
  const w = twoSessions();
  const { window: next } = receive(w, every({ type: "session_error" }), T0 + 1);
  assert.equal(next.sessions.a?.activity, "hurt");
  assert.equal(next.sessions.b?.activity, "hurt");
  assert.equal(next.pending.errors, 1);
});

test("an event addressed to nobody counts and moves no Session", () => {
  const w = twoSessions();
  const { window: next } = receive(w, none({ type: "tool_finished", kind: "bash" }), T0 + 1);
  assert.equal(next.sessions, w.sessions, "same Sessions object");
  assert.equal(next.pending.tools.bash, 1);
});

test("session_gone forgets the Session and its Voice", () => {
  let w = twoSessions();
  w = receive(w, to("a", { type: "permission_asked" }), T0 + 1).window;
  assert.ok(w.voices.a?.bubble, "a spoke");
  const { window: next } = receive(w, to("a", { type: "session_gone" }), T0 + 2);
  assert.deepEqual(Object.keys(next.sessions), ["b"]);
  assert.deepEqual(Object.keys(next.voices), ["b"]);
  assert.ok(isEmpty(EMPTY_DELTA) && next.pending === w.pending, "nothing counted");
});

test("a quiet tick returns the very same Window", () => {
  const w = twoSessions();
  assert.equal(tick(w, T0 + 1), w);
});

test("a tick lets a Bubble expire and a hurt Session recover", () => {
  let w = twoSessions();
  w = receive(w, to("a", { type: "permission_asked" }), T0).window;
  w = receive(w, to("b", { type: "tool_failed" }), T0).window;
  const bubbleMs = behavior(w.career).bubbleMs;
  const later = tick(w, T0 + bubbleMs + 3_000);
  assert.equal(later.voices.a?.bubble, undefined);
  assert.equal(later.sessions.b?.activity, "working");
});

test("adopting a Career that crosses a Stage reports the Evolution and every Session hears it", () => {
  let w = freshWindow(careerJustBelow("hatchling"));
  w = receive(w, to("a", { type: "session_busy" }), T0).window; // moves, counts nothing
  w = receive(w, to("b", { type: "session_busy" }), T0).window;
  const evolved = { ...w.career, prompts: w.career.prompts + 1 };
  const step = adopt(w, evolved, T0 + 1);
  assert.deepEqual(step.effects, [{ type: "evolved", stage: "hatchling" }]);
  assert.equal(step.window.voices.a?.bubble?.cue, "hatched");
  assert.equal(step.window.voices.b?.bubble?.cue, "hatched");
});

test("earning the crossing Delta through receive reports the Evolution too", () => {
  const w = freshWindow(careerJustBelow("hatchling"));
  const step = receive(w, to("a", { type: "prompt_sent" }), T0);
  assert.deepEqual(step.effects, [{ type: "evolved", stage: "hatchling" }]);
});

test("adopting an equal Career changes nothing and reports nothing", () => {
  const w = twoSessions();
  const step = adopt(w, { ...w.career }, T0 + 1);
  assert.equal(step.window, w);
  assert.deepEqual(step.effects, []);
});

test("a rename is shown at once, kept pending, and reported so the palette can follow", () => {
  const w = twoSessions();
  const step = rename(w, "  Momo  ", T0 + 5);
  assert.equal(step.window.career.name?.value, "Momo");
  assert.deepEqual(step.window.pending.rename, { value: "Momo", at: T0 + 5 });
  assert.deepEqual(step.effects, [{ type: "renamed" }]);
});

test("an empty rename, or the current Name again, changes nothing", () => {
  let w = twoSessions();
  assert.equal(rename(w, "   ", T0).window, w);
  w = rename(w, "Momo", T0).window;
  assert.equal(rename(w, "Momo", T0 + 1).window, w);
});

test("muting silences every Cue and clears the Bubbles on screen; unmuting lets them speak again", () => {
  let w = twoSessions();
  w = receive(w, to("a", { type: "permission_asked" }), T0).window;
  const quiet = setMuted(w, true);
  assert.equal(quiet.voices.a?.bubble, undefined);
  const still = receive(quiet, to("b", { type: "permission_asked" }), T0 + 1).window;
  assert.equal(still.voices.b?.bubble, undefined);
  assert.equal(still.sessions.b?.activity, "waiting", "the Session still moves");
  const loud = receive(setMuted(still, false), to("b", { type: "permission_asked" }), T0 + 200_000).window;
  assert.equal(loud.voices.b?.bubble?.cue, "permission");
});

test("flushed adopts the merged Career and forgets the pending Delta", () => {
  const w = twoSessions();
  const onDisk = { ...w.career, prompts: 40 };
  const step = flushed(w, onDisk, T0 + 1);
  assert.ok(isEmpty(step.window.pending));
  assert.equal(step.window.career.prompts, 40);
});

test("renaming to the Name already shown, even the plugin default that the Career never stored, changes nothing", () => {
  const w = twoSessions();
  assert.equal(w.career.name, undefined);
  assert.equal(rename(w, "Tamago", T0, "Tamago").window, w);
});

test("adopting a Career hatched at another time is a Switch: no Evolution, no Bubble, the Session stays", () => {
  let w = freshWindow(cat(T0));
  w = receive(w, to("a", { type: "session_busy" }), T0).window; // idle → thinking, counts nothing
  const elder: Career = { ...cat(T0 + 1), sessions: 2_000, name: { value: "Momo", at: 1 } }; // 20,000 xp
  const step = adopt(w, elder, T0 + 2);
  assert.deepEqual(step.effects, [{ type: "switched" }]);
  assert.equal(step.window.career, elder);
  assert.equal(step.window.voices.a?.bubble, undefined, "a Switch is not an Evolution: nobody speaks");
  assert.equal(step.window.sessions.a?.activity, "thinking", "the OpenCode session goes on");
});

test("a Switch that changes the Name reports switched alone, not renamed", () => {
  const w = freshWindow({ ...cat(T0), name: { value: "Pixel", at: 1 } });
  const step = adopt(w, { ...cat(T0 + 1), name: { value: "Momo", at: 2 } }, T0 + 3);
  assert.deepEqual(step.effects, [{ type: "switched" }]);
});

test("flushed with another active Career is a Switch and forgets the pending Delta", () => {
  let w = freshWindow(cat(T0));
  w = receive(w, to("a", { type: "prompt_sent" }), T0).window;
  assert.equal(isEmpty(w.pending), false);
  const step = flushed(w, cat(T0 + 5), T0 + 6);
  assert.deepEqual(step.effects, [{ type: "switched" }]);
  assert.equal(isEmpty(step.window.pending), true);
  assert.equal(step.window.career.hatchedAt, T0 + 5);
});

/**
 * Hatch dates whose draw pins a behavior Stat, found once by search over
 * draw(); asserted below so a formula change fails loudly rather than here.
 */
const THIN_SKIN = 1_000_005; // sensitivity 0: hurt lasts 1.5 s
const SLEEPY = 1_000_015; // energy 0: falls asleep after 60 s
const EVEN = 1_006_599; // every behavior Stat at 5: MEDIAN

test("the Sheet of the Career sets how fast hurt heals", () => {
  assert.equal(behavior({ hatchedAt: THIN_SKIN, species: "cat" }).hurtMs, 1_500);
  let w = freshWindow({ ...freshCareer(THIN_SKIN), species: "cat" });
  w = receive(w, to("a", { type: "tool_failed" }), T0).window;
  assert.equal(tick(w, T0 + 1_499).sessions.a?.activity, "hurt");
  assert.equal(tick(w, T0 + 1_500).sessions.a?.activity, "idle", `heals before HURT_MS (${HURT_MS})`);
});

test("the Sheet of the Career sets when idle falls asleep", () => {
  assert.equal(behavior({ hatchedAt: SLEEPY, species: "cat" }).sleepMs, 60_000);
  let w = freshWindow({ ...freshCareer(SLEEPY), species: "cat" });
  w = receive(w, to("a", { type: "prompt_sent" }), T0).window;
  w = receive(w, to("a", { type: "session_idle" }), T0 + 1).window;
  assert.equal(tick(w, T0 + 1 + 59_999).sessions.a?.activity, "idle");
  assert.equal(tick(w, T0 + 1 + 60_000).sessions.a?.activity, "sleeping", `sleeps before SLEEP_MS (${SLEEP_MS})`);
});

test("after a Switch the next tick applies the Behavior of the new Career", () => {
  assert.deepEqual(behavior({ hatchedAt: EVEN, species: "cat" }).hurtMs, HURT_MS);
  let w = freshWindow({ ...freshCareer(EVEN), species: "cat" });
  w = receive(w, to("a", { type: "tool_failed" }), T0).window;
  assert.equal(tick(w, T0 + 1_500).sessions.a?.activity, "hurt", "a median Career heals at HURT_MS");
  const step = adopt(w, { ...freshCareer(THIN_SKIN), species: "cat" }, T0 + 1);
  assert.deepEqual(step.effects, [{ type: "switched" }]);
  assert.equal(tick(step.window, T0 + 1_500).sessions.a?.activity, "idle", "the thin-skinned Career heals at 1.5 s");
});

test("the Voice speaks as the Career's Speaker: the phrase of its Species, Temperaments and hatch date", () => {
  const career: Career = { ...freshCareer(T0), species: "owl" };
  let w = freshWindow(career);
  w = receive(w, to("a", { type: "prompt_sent" }), T0).window;
  w = receive(w, to("a", { type: "session_idle" }), T0 + 1).window;
  w = tick(w, T0 + 1 + SLEEP_MS);
  assert.equal(w.sessions.a?.activity, "sleeping");
  const bubbleMs = behavior(career).bubbleMs;
  w = receive(w, to("a", { type: "prompt_sent" }), T0 + 2 + SLEEP_MS + bubbleMs + 10_000).window;
  assert.equal(w.voices.a?.bubble?.cue, "woke");
  assert.equal(w.voices.a?.bubble?.text, phrase("woke", speakerOf(career), 0));
});
