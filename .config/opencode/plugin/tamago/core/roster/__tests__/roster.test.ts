import { test } from "node:test";
import assert from "node:assert/strict";
import { ROSTER_KEYS, blockers, growing, idOf, luck, ordered, rosterAction, step, switchable, type Roster } from "../roster.ts";
import { freshCareer, type Career } from "../../career/career.ts";

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

test("luck sums the points of the elders, whatever their place, and ignores whoever still grows", () => {
  assert.equal(luck([]), 0);
  assert.equal(luck([elder(T0)]), 1, "one common elder");
  assert.equal(luck([elder(T0), elder(T0 - 1, { species: "owl" })]), 2, "two common elders");
  assert.equal(luck([egg(T0), elder(T0 - 1)]), 1, "an egg weighs nothing");
  // 20,000 XP is 5,000 growth for a dragon: still growing. 80,000 XP is elder.
  assert.equal(luck([elder(T0, { species: "dragon" })]), 0);
  assert.equal(luck([elder(T0, { species: "dragon", sessions: 8_000 })]), 5);
  assert.equal(luck([elder(T0), elder(T0 - 1), elder(T0 - 2, { species: "dragon", sessions: 8_000 })]), 7);
  assert.equal(luck([elder(T0, { species: "nope" })]), 1, "an unknown Species counts as the reference");
});

test("ordered lists the active Career first, then the resting ones by hatch date", () => {
  const roster: Roster = { active: elder(T0), resting: [elder(T0 - 1), elder(T0 - 3), elder(T0 - 2)] };
  assert.deepEqual(ordered(roster).map(idOf), [T0, T0 - 3, T0 - 2, T0 - 1]);
  assert.deepEqual(ordered({ active: elder(T0), resting: [] }).map(idOf), [T0]);
});

test("rosterAction maps the arrow and vim keys to a move, return to select, and anything else to nothing", () => {
  assert.equal(rosterAction("up"), "up");
  assert.equal(rosterAction("k"), "up");
  assert.equal(rosterAction("down"), "down");
  assert.equal(rosterAction("j"), "down");
  assert.equal(rosterAction("return"), "select");
  assert.equal(rosterAction("escape"), undefined);
  assert.equal(rosterAction("x"), undefined);
  assert.deepEqual(Object.keys(ROSTER_KEYS).sort(), ["down", "j", "k", "return", "up"]);
});

test("step moves the cursor by one and stops at both ends", () => {
  assert.equal(step(0, "up", 3), 0);
  assert.equal(step(1, "up", 3), 0);
  assert.equal(step(1, "down", 3), 2);
  assert.equal(step(2, "down", 3), 2);
  assert.equal(step(0, "down", 1), 0);
  assert.equal(step(0, "up", 1), 0);
});
