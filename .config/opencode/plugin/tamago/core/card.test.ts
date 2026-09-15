import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, age, progress } from "./card.ts";
import { freshCareer, type Career } from "./state.ts";

const career: Career = {
  sessions: 12,
  prompts: 340,
  tools: { read: 500, edit: 120, bash: 90, other: 7 },
  filesEdited: 60,
  errors: 9,
  questions: 0,
  hatchedAt: 0,
};

test("age counts whole days since hatching", () => {
  assert.equal(age(0, 0), "hatched today");
  assert.equal(age(0, DAY_MS - 1), "hatched today");
  assert.equal(age(0, DAY_MS), "1 day old");
  assert.equal(age(0, 12 * DAY_MS + 5), "12 days old");
  assert.equal(age(10, 0), "hatched today", "a clock set back never goes negative");
});

test("progress shows the bar towards the next stage", () => {
  assert.equal(progress(career, 10), "[#---------] 2,147 / 6,000 xp → adult");
  assert.equal(progress(freshCareer(0), 4), "[----] 0 / 200 xp → hatchling");
});

test("an elder has reached its final form", () => {
  const elder: Career = { ...career, prompts: 20_000 };
  assert.equal(progress(elder, 4), "[####] 41,467 xp · final form");
});
