import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIAN, SLOW_PER_FAST, STREAK_MIN, behavior, behaviorOf } from "../behavior.ts";
import { SCALE, draw, sheet, type Sheet } from "../sheet.ts";
import type { Species } from "../species.ts";

/** A Sheet with every Stat at `value`. */
const flat = (value: number): Sheet => ({ cheerful: value, sarcastic: value, stoic: value, dreamy: value, energy: value, chatter: value, sensitivity: value, patience: value });

test("a median Sheet gives MEDIAN, the constants the plugin had before the Sheet", () => {
  assert.deepEqual(MEDIAN, { sleepMs: 120_000, fastMs: 500, slowMs: 2_000, quietMs: 10_000, bubbleMs: 5_000, hurtMs: 3_000, streakCount: 3, longWorkMs: 300_000 });
  assert.deepEqual(behaviorOf(flat(SCALE.median)), MEDIAN);
});

test("min and max halve or double every field in the direction of its Stat", () => {
  assert.deepEqual(behaviorOf(flat(SCALE.min)), { sleepMs: 60_000, fastMs: 1_000, slowMs: 4_000, quietMs: 20_000, bubbleMs: 2_500, hurtMs: 1_500, streakCount: 6, longWorkMs: 150_000 });
  assert.deepEqual(behaviorOf(flat(SCALE.max)), { sleepMs: 240_000, fastMs: 250, slowMs: 1_000, quietMs: 5_000, bubbleMs: 10_000, hurtMs: 6_000, streakCount: 2, longWorkMs: 600_000 });
});

test("each Stat moves its own fields only", () => {
  const brisk = behaviorOf({ ...flat(SCALE.median), energy: SCALE.max });
  assert.deepEqual(brisk, { ...MEDIAN, sleepMs: 240_000, fastMs: 250, slowMs: 1_000 });
  const chatty = behaviorOf({ ...flat(SCALE.median), chatter: SCALE.max });
  assert.deepEqual(chatty, { ...MEDIAN, quietMs: 5_000, bubbleMs: 10_000 });
  const tender = behaviorOf({ ...flat(SCALE.median), sensitivity: SCALE.max });
  assert.deepEqual(tender, { ...MEDIAN, hurtMs: 6_000, streakCount: 2 });
  const patient = behaviorOf({ ...flat(SCALE.median), patience: SCALE.max });
  assert.deepEqual(patient, { ...MEDIAN, longWorkMs: 600_000 });
});

test("slow stays a whole multiple of fast on every energy, and streakCount never drops under STREAK_MIN", () => {
  assert.equal(SLOW_PER_FAST, 4);
  assert.equal(STREAK_MIN, 2);
  for (let v = SCALE.min; v <= SCALE.max; v++) {
    const b = behaviorOf({ ...flat(SCALE.median), energy: v, sensitivity: v });
    assert.equal(b.slowMs, b.fastMs * SLOW_PER_FAST, `energy ${v}`);
    assert.ok(Number.isInteger(b.fastMs) && Number.isInteger(b.sleepMs) && Number.isInteger(b.hurtMs), `energy ${v}: whole milliseconds`);
    assert.ok(b.streakCount >= STREAK_MIN, `sensitivity ${v}`);
  }
});

test("milliseconds are rounded, and slow derives from the rounded fast", () => {
  const b = behaviorOf({ ...flat(SCALE.median), energy: 9 });
  assert.equal(b.fastMs, 287); // 500 / 2^0.8
  assert.equal(b.slowMs, 1_148, "4 × 287; rounding 2000 / 2^0.8 on its own would give 1149");
  assert.equal(b.sleepMs, 208_932);
  const tender = behaviorOf({ ...flat(SCALE.median), sensitivity: 7 });
  assert.equal(tender.hurtMs, 3_959);
  assert.equal(tender.streakCount, 2); // round(3 / 1.32) = 2
});

test("behavior reads a Career: a date drawn all median gives MEDIAN, the Species' Modifiers show", () => {
  assert.deepEqual(behavior({ hatchedAt: 1_006_599, species: "cat" }), MEDIAN); // draw(1_006_599) has every behavior Stat at 5
  assert.equal(draw(1_006_599).energy, SCALE.median, "the date above still draws median energy");
  const table: readonly Species[] = [
    { id: "cat", label: { en: "cat", fr: "chat" }, gender: "m", rarity: "common" },
    { id: "brisk", label: { en: "brisk", fr: "vif" }, gender: "m", rarity: "common", sheet: { energy: 3 } },
  ];
  assert.deepEqual(behavior({ hatchedAt: 1_006_599, species: "brisk" }, table), behaviorOf({ ...flat(SCALE.median), energy: 8 }));
  assert.equal(behavior({ hatchedAt: 1_006_599, species: "brisk" }, table).fastMs, 330);
});

test("the Behavior of a Career is derived once, and a table of its own never touches that cache", () => {
  const career = { hatchedAt: 1_789_113_932_488, species: "owl" };
  const cached = behavior(career);
  assert.equal(behavior(career), cached, "a window derives per event: the Career is what changes, not the Behavior");
  assert.notEqual(behavior({ ...career }), cached, "another Career object derives its own");

  const table: readonly Species[] = [{ id: "owl", label: { en: "owl", fr: "hibou" }, gender: "m", rarity: "common", sheet: { energy: 3 } }];
  assert.deepEqual(behavior(career, table), behaviorOf(sheet(career.hatchedAt, "owl", table)));
  assert.notDeepEqual(behavior(career, table), cached, "the owl of that table is brisker than the catalog's");
  assert.equal(behavior(career), cached, "and asking with a table of its own left the cache alone");
});
