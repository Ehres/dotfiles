import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, age, progress, reveal, speciesLine } from "./card.ts";
import { REFERENCE } from "./species.ts";
import { freshCareer, type Career } from "./state.ts";

const career: Career = {
  sessions: 12,
  prompts: 340,
  tools: { read: 500, edit: 120, bash: 90, other: 7 },
  filesEdited: 60,
  errors: 9,
  questions: 0,
  hatchedAt: 0,
  species: "cat",
  picks: {},
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

test("progress shows raw xp against a raw threshold farther away for a rarer species", () => {
  const dragon: Career = { ...career, species: "dragon" }; // 2,147 xp, 536.75 growth: hatchling
  const text = progress(dragon, 10);
  assert.ok(text.endsWith("2,147 / 6,000 xp → young"), text);
});

test("speciesLine hides the species while still an egg, then names it with its rarity", () => {
  assert.equal(speciesLine(freshCareer(0)), "still an egg");
  assert.equal(speciesLine({ ...freshCareer(0), species: "owl", sessions: 20 }), "owl · common"); // 200 xp: hatchling
  assert.equal(speciesLine({ ...career, species: "dragon" }), "dragon · legendary");
  assert.equal(speciesLine({ ...career, species: "nope" }), `${REFERENCE} · common`, "an unknown species reads as the reference");
});

test("reveal names the species with the right article", () => {
  assert.equal(reveal("Tamago", { ...career, species: "owl" }), "Tamago hatched: an owl, common!");
  assert.equal(reveal("Momo", { ...career, species: "dragon" }), "Momo hatched: a dragon, legendary!");
});
