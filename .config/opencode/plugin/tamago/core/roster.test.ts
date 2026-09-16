import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS } from "./card.ts";
import { blocked, blockers, entry, growing, idOf, stepsIn, switchable, type Roster } from "./roster.ts";
import { freshCareer, type Career } from "./state.ts";

const T0 = 1_700_000_000_000;
/** 2,000 sessions weigh 20,000 XP: elder for a cat. */
const elder = (hatchedAt: number, patch: Partial<Career> = {}): Career => ({ ...freshCareer(hatchedAt), species: "cat", sessions: 2_000, ...patch });
const egg = (hatchedAt: number, patch: Partial<Career> = {}): Career => ({ ...freshCareer(hatchedAt), species: "cat", ...patch });

test("a Career is identified by its hatch date", () => {
  assert.equal(idOf(freshCareer(T0)), T0);
});

test("growing is true below elder, false at elder, and follows the pace of the species", () => {
  assert.equal(growing(egg(T0)), true);
  assert.equal(growing(elder(T0)), false);
  assert.equal(growing({ ...elder(T0), species: "dragon" }), true, "20,000 xp is 5,000 growth for a dragon");
});

test("blockers lists every growing Career, the active one first, and is empty when the whole Roster is elder", () => {
  const all: Roster = { active: elder(T0), resting: [elder(T0 - 1), elder(T0 - 2)] };
  assert.deepEqual(blockers(all), []);
  const activeGrows: Roster = { active: egg(T0), resting: [elder(T0 - 1)] };
  assert.deepEqual(blockers(activeGrows).map(idOf), [T0]);
  const restingGrows: Roster = { active: elder(T0), resting: [elder(T0 - 2), egg(T0 - 1)] };
  assert.deepEqual(blockers(restingGrows).map(idOf), [T0 - 1]);
});

test("switchable is the resting Careers by hatch date, never the active one", () => {
  const roster: Roster = { active: elder(T0), resting: [elder(T0 - 1), elder(T0 - 3), elder(T0 - 2)] };
  assert.deepEqual(switchable(roster).map(idOf), [T0 - 3, T0 - 2, T0 - 1]);
  assert.deepEqual(switchable({ active: elder(T0), resting: [] }), []);
});

test("entry names the Tamago, its species and rarity, its stage and its age; an egg keeps its secret", () => {
  const momo = elder(T0, { species: "owl", name: { value: "Momo", at: 1 } });
  assert.equal(entry(momo, "Tamago", T0 + 12 * DAY_MS), "Momo · owl · common · elder · 12 days old");
  assert.equal(entry(elder(T0), "Tamago", T0), "Tamago · cat · common · elder · hatched today");
  assert.equal(entry(egg(T0), "Tamago", T0 + DAY_MS), "Tamago · still an egg · 1 day old");
});

test("blocked names who is still growing and what to wait for", () => {
  assert.equal(blocked(egg(T0, { name: { value: "Momo", at: 1 } }), "Tamago"), "Momo is still an egg. Hatch when every Tamago is elder.");
  assert.equal(blocked({ ...egg(T0), sessions: 20 }, "Tamago"), "Tamago is still hatchling. Hatch when every Tamago is elder.");
});

test("stepsIn announces a new egg or the Tamago that comes to the front", () => {
  assert.equal(stepsIn(egg(T0), "Tamago"), "A new egg.");
  assert.equal(stepsIn(elder(T0, { name: { value: "Momo", at: 1 } }), "Tamago"), "Momo steps in.");
  assert.equal(stepsIn(elder(T0), "Tamago"), "Tamago steps in.");
});
