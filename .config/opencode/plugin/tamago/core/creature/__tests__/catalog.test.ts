import { test } from "node:test";
import assert from "node:assert/strict";
import { MARK_COLUMN, MARK_LINE } from "../../appearance/marks.ts";
import { frames, heartFrame } from "../../appearance/sprites.ts";
import { STAGES } from "../../career/stage.ts";
import { assertSayable } from "../../speech/__tests__/sayable.ts";
import { CUES, type Cue } from "../../speech/cue.ts";
import { ACTIVITIES } from "../../moment/session.ts";
import { TEMPERAMENTS } from "../sheet.ts";
import { REFERENCE, SPECIES, bodiesOf, known, signatureOf } from "../catalog.ts";
import { COMMON } from "../species/common.ts";
import { UNCOMMON } from "../species/uncommon.ts";
import { RARE } from "../species/rare.ts";

test("SPECIES keeps the draw order: common first, then by Rarity, twenty ids, the reference among the common", () => {
  assert.deepEqual(
    SPECIES.map((one) => one.id),
    ["cat", "owl", "frog", "duck", "hamster", "snail", "fox", "penguin", "octopus", "bat", "hedgehog", "axolotl", "robot", "ghost", "jellyfish", "chameleon", "phoenix", "kraken", "unicorn", "dragon"],
  );
  assert.equal(SPECIES.find((one) => one.id === REFERENCE)?.rarity, "common");
});

test("bodiesOf falls back to the reference and known says which ids are the build's own; signatureOf has no fallback", () => {
  assert.equal(bodiesOf("no-such-species"), bodiesOf(REFERENCE));
  assert.equal(known("no-such-species"), false);
  assert.equal(known("__proto__"), false);
  assert.equal(known(REFERENCE), true);
  assert.equal(signatureOf("no-such-species"), undefined);
  assert.notEqual(signatureOf(REFERENCE), undefined);
});

test("every body draws every Stage past the egg", () => {
  for (const { id, bodies } of SPECIES) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      assert.equal(typeof bodies[stage], "function", `${id}/${stage}`);
    }
  }
});

test("no two Species share a body at any Stage, and no Species draws two Stages alike", () => {
  const seen = new Map<string, string>();
  for (const { id, bodies } of SPECIES) {
    const own = new Set<string>();
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const frame = bodies[stage]("o o", " ").join("\n");
      assert.ok(!own.has(frame), `${id} draws two Stages alike (${stage})`);
      own.add(frame);
      const key = `${stage}\n${frame}`;
      const other = seen.get(key);
      assert.equal(other, undefined, `${id} and ${other} share the ${stage} body`);
      seen.set(key, id);
    }
  }
});

test("a Signature covers every Cue with at least three phrases", () => {
  for (const { id, signature } of SPECIES) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      const phrases = signature[cue];
      assert.ok(phrases && phrases.length >= 3, `${id}/${cue}`);
      for (const phrase of phrases ?? []) assertSayable(phrase, `${id}/${cue}`);
    }
  }
});

test("a phrase belongs to one Species only", () => {
  const owner = new Map<string, string>();
  const collisions: string[] = [];
  for (const { id, signature } of SPECIES) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const phrase of signature[cue] ?? []) {
        const text = phrase.en;
        const existing = owner.get(text);
        if (existing !== undefined && existing !== id) collisions.push(`"${text}" is said by both ${existing} and ${id}`);
        else owner.set(text, id);
      }
    }
  }
  assert.deepEqual(collisions, []);
});

test("every Species leaves the overlay cell free at every Stage and Activity, and on the petted frame for every Temperament, so a Trait mark never covers a body", () => {
  for (const one of SPECIES) {
    for (const stage of ["egg", "hatchling", "young", "adult", "elder"] as const) {
      for (const activity of ACTIVITIES) {
        for (const frame of frames(one.id, stage, activity)) {
          assert.equal((frame[MARK_LINE] ?? "")[MARK_COLUMN], " ", `${one.id}/${stage}/${activity} fills the overlay cell`);
        }
      }
      for (const temperament of TEMPERAMENTS) {
        const frame = heartFrame(one.id, stage, temperament);
        assert.equal((frame[MARK_LINE] ?? "")[MARK_COLUMN], " ", `${one.id}/${stage} heartFrame/${temperament} fills the overlay cell`);
      }
    }
  }
});

test("every common Species is written in French: label, gender and all thirteen Cues", () => {
  for (const entry of COMMON) {
    assert.ok(entry.label.fr !== undefined, `${entry.id}: no French label`);
    assert.ok(entry.gender !== undefined, `${entry.id}: no gender, so French cannot agree`);
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const phrase of entry.signature[cue]) {
        assert.ok(phrase.fr !== undefined, `${entry.id}/${cue}: ${JSON.stringify(phrase.en)} has no French`);
        assertSayable(phrase, `${entry.id}/${cue}`);
      }
    }
  }
});

test("every rare Species is written in French: label, gender and all thirteen Cues", () => {
  for (const entry of RARE) {
    assert.ok(entry.label.fr !== undefined, `${entry.id}: no French label`);
    assert.ok(entry.gender !== undefined, `${entry.id}: no gender, so French cannot agree`);
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const phrase of entry.signature[cue]) {
        assert.ok(phrase.fr !== undefined, `${entry.id}/${cue}: ${JSON.stringify(phrase.en)} has no French`);
        assertSayable(phrase, `${entry.id}/${cue}`);
      }
    }
  }
});

test("every uncommon Species is written in French: label, gender and all thirteen Cues", () => {
  for (const entry of UNCOMMON) {
    assert.ok(entry.label.fr !== undefined, `${entry.id}: no French label`);
    assert.ok(entry.gender !== undefined, `${entry.id}: no gender, so French cannot agree`);
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const phrase of entry.signature[cue]) {
        assert.ok(phrase.fr !== undefined, `${entry.id}/${cue}: ${JSON.stringify(phrase.en)} has no French`);
        assertSayable(phrase, `${entry.id}/${cue}`);
      }
    }
  }
});
