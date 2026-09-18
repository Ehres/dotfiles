import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, WEIGHTS, growth, next, stage, stageIndex, xp, evolution, type Paced } from "./stage.ts";
import { EMPTY_DELTA, freshCareer, type Counters } from "./state.ts";
import { RARITY, REFERENCE } from "./species.ts";

const counters = (patch: Partial<Counters>, species = REFERENCE): Paced => ({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, species, ...patch });

test("xp is the weighted sum from the WEIGHTS table", () => {
  const c = counters({
    prompts: 10,
    sessions: 2,
    filesEdited: 3,
    errors: 99,
    tools: { read: 4, edit: 5, bash: 6, other: 7 },
  });
  const expected =
    10 * WEIGHTS.prompts +
    2 * WEIGHTS.sessions +
    3 * WEIGHTS.filesEdited +
    4 * WEIGHTS.tools.read +
    5 * WEIGHTS.tools.edit +
    6 * WEIGHTS.tools.bash +
    7 * WEIGHTS.tools.other;
  assert.equal(xp(c), expected);
});

test("errors are worth nothing", () => {
  assert.equal(xp(counters({ errors: 1000 })), 0);
});

test("STAGES start at egg with 0 xp and are strictly ascending", () => {
  assert.equal(STAGES[0]?.id, "egg");
  assert.equal(STAGES[0]?.xp, 0);
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok((STAGES[i]?.xp ?? 0) > (STAGES[i - 1]?.xp ?? 0), `stage ${i} threshold`);
  }
});

test("stage picks the highest threshold reached", () => {
  // prompts weigh 2, so prompts = threshold / 2 lands exactly on a threshold.
  for (const entry of STAGES) {
    assert.equal(stage(counters({ prompts: entry.xp / WEIGHTS.prompts })), entry.id);
    if (entry.xp > 0) {
      assert.notEqual(stage(counters({ prompts: entry.xp / WEIGHTS.prompts - 1 })), entry.id);
    }
  }
});

test("stageIndex orders stages", () => {
  assert.equal(stageIndex("egg"), 0);
  assert.ok(stageIndex("elder") > stageIndex("adult"));
});

test("next reports the coming stage and progress inside the current band", () => {
  const hatch = STAGES[1]!;
  const young = STAGES[2]!;
  const midway = (hatch.xp + young.xp) / 2;
  const info = next(counters({ prompts: midway / WEIGHTS.prompts }));
  assert.ok(info);
  assert.equal(info.stage, "young");
  assert.equal(info.threshold, young.xp);
  assert.ok(Math.abs(info.progress - 0.5) < 1e-9);
});

test("next is undefined at the final stage", () => {
  const last = STAGES[STAGES.length - 1]!;
  assert.equal(next(counters({ prompts: last.xp / WEIGHTS.prompts })), undefined);
});

test("evolution names the stage reached when the career crosses a threshold upward", () => {
  const egg = { ...freshCareer(0), species: "cat" };
  const hatched = { ...egg, sessions: 20 }; // 200 xp
  const young = { ...egg, sessions: 150 }; // 1,500 xp
  assert.equal(evolution(egg, hatched), "hatchling");
  assert.equal(evolution(egg, young), "young", "skipping a stage still names the one reached");
});

test("evolution is silent when the stage is unchanged or goes down, as after a reset", () => {
  const egg = { ...freshCareer(0), species: "cat" };
  const young = { ...egg, sessions: 150 };
  assert.equal(evolution(egg, { ...egg, sessions: 1 }), undefined);
  assert.equal(evolution(young, { ...young, prompts: 1 }), undefined);
  assert.equal(evolution(young, egg), undefined);
});

test("growth is xp at pace 1 and scales with the pace of the species", () => {
  const c = counters({ prompts: 100 }); // 200 xp
  assert.equal(growth(c), xp(c));
  assert.equal(growth(counters({ prompts: 100 }, "dragon")), xp(c) * RARITY.legendary.pace);
  assert.equal(growth(counters({ prompts: 100 }, "unknown-species")), xp(c), "an unknown species grows at pace 1");
});

test("a rarer species is never at a higher stage for the same counters", () => {
  for (const entry of STAGES) {
    const common = counters({ prompts: entry.xp / WEIGHTS.prompts });
    const legendary = counters({ prompts: entry.xp / WEIGHTS.prompts }, "dragon");
    assert.ok(stageIndex(stage(legendary)) <= stageIndex(stage(common)), entry.id);
  }
  assert.equal(stage(counters({ prompts: 100 })), "hatchling", "200 xp hatches a cat");
  assert.equal(stage(counters({ prompts: 100 }, "dragon")), "egg", "200 xp is 50 growth for a dragon");
  assert.equal(stage(counters({ prompts: 400 }, "dragon")), "hatchling", "800 xp is 200 growth for a dragon");
});

test("next reports the raw xp threshold and the same progress for two species at the same growth", () => {
  const hatch = STAGES[1]!;
  const young = STAGES[2]!;
  const midway = (hatch.xp + young.xp) / 2; // growth
  const cat = next(counters({ prompts: midway / WEIGHTS.prompts }));
  const dragon = next(counters({ prompts: midway / RARITY.legendary.pace / WEIGHTS.prompts }, "dragon"));
  assert.ok(cat && dragon);
  assert.equal(cat.threshold, young.xp);
  assert.equal(dragon.threshold, Math.ceil(young.xp / RARITY.legendary.pace));
  assert.ok(Math.abs(cat.progress - dragon.progress) < 1e-9);
  assert.equal(dragon.stage, "young");
});

test("evolution across a species change is undefined when the stage does not rise", () => {
  const cat = { ...freshCareer(0), species: "cat", sessions: 20 }; // 200 xp, hatchling
  const dragon = { ...cat, species: "dragon" }; // 50 growth, egg
  assert.equal(evolution(cat, dragon), undefined);
  assert.equal(evolution(dragon, cat), "hatchling");
});
