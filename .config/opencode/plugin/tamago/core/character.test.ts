import { test } from "node:test";
import assert from "node:assert/strict";
import { CRAFTS, STANCE, character, craft, describe, stance, temperament, vocation } from "./character.ts";
import { EMPTY_DELTA, freshCareer, type Career, type Counters } from "./career.ts";
import { TEMPERAMENTS, historical } from "./sheet.ts";
import { RARITY, REFERENCE, type Species } from "./species.ts";
import { STAGES, type Paced } from "./stage.ts";

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

const counters = (patch: Partial<Counters>, species = REFERENCE): Paced => ({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, species, ...patch });

test("temperament is deterministic and spread over the four", () => {
  assert.equal(temperament(owner.hatchedAt), temperament(owner.hatchedAt));
  // the owner's Tamago, pinned so the hash never silently changes
  assert.equal(temperament(1789113932488), "cheerful");
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  for (let t = 1_789_000_000_000; t < 1_789_000_000_000 + 10_000_000; t += 1_000) {
    const value = temperament(t);
    seen.add(value);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  assert.deepEqual([...seen].sort(), [...TEMPERAMENTS].sort());
  for (const value of TEMPERAMENTS) assert.ok((counts[value] ?? 0) >= 1500, `${value} was only ${counts[value] ?? 0} of 10000`);
});

test("craft is the highest weighted score, ties to table order", () => {
  assert.equal(craft(owner), "shell", "shell 2376 beats sage 2342 and scribe 2139");
  assert.equal(craft({ ...owner, tools: { ...owner.tools, read: 3000 } }), "sage");
  assert.equal(craft(counters({ tools: { read: 0, edit: 100, bash: 0, other: 0 } })), "scribe");
  assert.equal(craft(counters({})), Object.keys(CRAFTS)[0], "all zero: first entry");
});

test("stance is prudent from STANCE.questions questions per STANCE.prompts prompts", () => {
  const ratio = STANCE.questions / STANCE.prompts; // 20: one question per 20 prompts is the threshold
  assert.equal(stance(counters({ prompts: 100, questions: 5 })), "prudent");
  assert.equal(stance(counters({ prompts: 100, questions: 4 })), "bold");
  assert.equal(stance(counters({ prompts: 0, questions: 0 })), "bold", "nothing asked yet");
  assert.equal(stance(counters({ prompts: ratio, questions: 1 })), "prudent");
});

test("no vocation before young, one from young on", () => {
  assert.equal(vocation(freshCareer(0)), undefined);
  const young = STAGES.find((entry) => entry.id === "young")!;
  const justYoung = counters({ prompts: young.xp / 2 }); // prompts weigh 2 xp
  assert.deepEqual(vocation(justYoung), { craft: Object.keys(CRAFTS)[0], stance: "bold" });
  assert.deepEqual(vocation(counters({ prompts: young.xp / 2 - 1 })), undefined);
});

test("character and describe", () => {
  const full = character(owner);
  assert.equal(full.temperament, temperament(owner.hatchedAt));
  assert.deepEqual(full.vocation, { craft: "shell", stance: "bold" });
  assert.equal(describe(full), `${full.temperament} · bold shell`);
  const egg = character({ ...freshCareer(owner.hatchedAt), species: "cat" });
  assert.equal(describe(egg), full.temperament);
});

test("vocation waits for young in growth, so a rare species gets it later", () => {
  const young = STAGES.find((entry) => entry.id === "young")!;
  assert.notEqual(vocation(counters({ prompts: young.xp / 2 })), undefined, "a cat is young");
  assert.equal(vocation(counters({ prompts: young.xp / 2 }, "dragon")), undefined, "a dragon at the same counters is not");
  assert.notEqual(vocation(counters({ prompts: young.xp / 2 / RARITY.legendary.pace }, "dragon")), undefined);
});

test("the owner's Tamago keeps its Temperament through the Sheet; the same hatch date as an owl or a dragon reads its Species", () => {
  assert.equal(character(owner).temperament, "cheerful");
  assert.equal(temperament(owner.hatchedAt, "owl"), "stoic", "stoic 7 + 2 beats cheerful 8 − 1");
  assert.equal(temperament(owner.hatchedAt, "dragon"), "cheerful", "sarcastic 5 + 3 ties cheerful 8: order wins");
});

test("without Modifiers the Temperament is the historical one; a Species only weighs", () => {
  let flipped = 0;
  for (let t = 1_789_000_000_000; t < 1_789_000_000_000 + 10_000_000; t += 1_000) {
    assert.equal(temperament(t), historical(t), `${t}`);
    if (temperament(t, "owl") !== historical(t)) flipped++;
  }
  assert.ok(flipped > 500 && flipped < 3_500, `${flipped} owls of 10000 took their Species' Temperament`);
});

test("a Species with a Modifier out of reach always has that Temperament", () => {
  const table: readonly Species[] = [{ id: "always", label: "always", rarity: "common", sheet: { stoic: 12 } }];
  for (let t = 0; t < 1_000; t++) assert.equal(temperament(t * 997, "always", table), "stoic");
});
