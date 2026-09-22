import { test } from "node:test";
import assert from "node:assert/strict";
import { freshCareer, type Career } from "../career/career.ts";
import { growth, stage, xp } from "../career/stage.ts";
import { behavior } from "../creature/behavior.ts";
import { describe, temperament } from "../creature/character.ts";
import { sheet, temperamentOf } from "../creature/sheet.ts";
import { species } from "../creature/species.ts";
import { tamago } from "../tamago.ts";

/** The owner's real career on 2026-09-15, plus questions. */
const owner: Career = {
  sessions: 30,
  prompts: 492,
  tools: { read: 2342, edit: 83, bash: 1188, other: 1025 },
  filesEdited: 378,
  errors: 109,
  questions: 0,
  hatchedAt: 1789113932488,
  species: "cat",
  picks: {},
};

test("a Tamago is every derivation of its Career, each equal to the function it comes from", () => {
  const t = tamago(owner);
  assert.equal(t.career, owner, "the Career itself, not a copy");
  assert.deepEqual(t.species, species(owner.species));
  assert.equal(t.stage, stage(owner));
  assert.equal(t.xp, xp(owner));
  assert.equal(t.growth, growth(owner));
  assert.deepEqual(t.sheet, sheet(owner.hatchedAt, owner.species));
  assert.equal(t.temperament, temperamentOf(t.sheet));
  assert.equal(t.temperament, temperament(owner.hatchedAt, owner.species));
  assert.deepEqual(t.behavior, behavior(owner));
});

test("character and describe", () => {
  const full = tamago(owner).character;
  assert.equal(full.temperament, temperament(owner.hatchedAt));
  assert.deepEqual(full.vocation, { craft: "shell", stance: "bold" });
  assert.equal(describe(full), `${full.temperament} · bold shell`);
  const egg = tamago({ ...freshCareer(owner.hatchedAt), species: "cat" }).character;
  assert.deepEqual(egg, { temperament: full.temperament }, "no vocation key at all before young");
  assert.equal(describe(egg), full.temperament);
});

test("an unknown Species reads as the reference: no Modifier, common, pace 1", () => {
  const t = tamago({ ...owner, species: "from-a-newer-build" });
  assert.equal(t.species.rarity, "common");
  assert.deepEqual(t.sheet, sheet(owner.hatchedAt, "cat"));
  assert.equal(t.growth, t.xp);
});

test("a Tamago carries the Traits it holds and the Draws awaiting a Pick", () => {
  const fresh = tamago(owner);
  assert.deepEqual(fresh.traits, []);
  assert.deepEqual(fresh.choices.map((one) => one.milestone.id), ["evolution:hatchling", "evolution:young", "evolution:adult"]);
  const kept = tamago({ ...owner, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } });
  assert.deepEqual(kept.traits, ["hardy"]);
  assert.deepEqual(kept.choices.map((one) => one.milestone.id), ["evolution:young", "evolution:adult"]);
});
