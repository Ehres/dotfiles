import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../../career/stage.ts";
import { assertSayable } from "../../speech/__tests__/sayable.ts";
import { CUES, type Cue } from "../../speech/cue.ts";
import { REFERENCE, SPECIES, known, signatureOf } from "../catalog.ts";

test("SPECIES keeps the draw order: common first, then by Rarity, twenty ids, the reference among the common", () => {
  assert.deepEqual(
    SPECIES.map((one) => one.id),
    ["cat", "owl", "frog", "duck", "hamster", "snail", "fox", "penguin", "octopus", "bat", "hedgehog", "axolotl", "robot", "ghost", "jellyfish", "chameleon", "phoenix", "kraken", "unicorn", "dragon"],
  );
  assert.equal(SPECIES.find((one) => one.id === REFERENCE)?.rarity, "common");
});

test("known says which ids are the build's own; signatureOf has no fallback", () => {
  assert.equal(known("no-such-species"), false);
  assert.equal(known("__proto__"), false);
  assert.equal(known(REFERENCE), true);
  assert.equal(signatureOf("no-such-species"), undefined);
  assert.notEqual(signatureOf(REFERENCE), undefined);
});

test("no two Species share a map at a Stage, and no Species draws two Stages alike", () => {
  const seen = new Map<string, string>();
  for (const one of SPECIES) {
    const own = new Set<string>();
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const drawing = one.maps[stage].pixels.join("\n");
      assert.ok(!own.has(drawing), `${one.id} draws two Stages alike (${stage})`);
      own.add(drawing);
      const key = `${stage}\n${drawing}`;
      const other = seen.get(key);
      assert.equal(other, undefined, `${one.id} and ${other} share the ${stage} map`);
      seen.set(key, one.id);
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

// Stricter than the English test above on purpose: a Species may repeat its own English line
// across Cues (that reads as a verbal tic), but decision 8 forbids a second French for one
// English everywhere, so nothing here excuses a repeat by the same Species either.
test("a French phrase is written once in the whole catalog, whoever says it", () => {
  const owner = new Map<string, string>();
  const collisions: string[] = [];
  for (const { id, signature } of SPECIES) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const phrase of signature[cue] ?? []) {
        const text = phrase.fr;
        const existing = owner.get(text);
        if (existing !== undefined) collisions.push(`"${text}" is said by both ${existing} and ${id}/${cue}`);
        else owner.set(text, `${id}/${cue}`);
      }
    }
  }
  assert.deepEqual(collisions, []);
});
