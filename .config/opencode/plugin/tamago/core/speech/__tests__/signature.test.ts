import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT } from "../bubble.ts";
import { SIGNATURE } from "../signature.ts";
import { SPECIES } from "../../creature/species.ts";
import { CUES, type Cue } from "../cue.ts";

test("every Species of the table has a Signature, and every Signature names a Species of the table", () => {
  for (const entry of SPECIES) assert.ok(SIGNATURE[entry.id], `${entry.id} has no Signature`);
  for (const id of Object.keys(SIGNATURE)) assert.ok(SPECIES.some((entry) => entry.id === id), `${id} is not a Species`);
});

test("a Signature covers every Cue with at least three phrases that fit in MAX_TEXT, in printable ASCII", () => {
  for (const [id, signature] of Object.entries(SIGNATURE)) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      const phrases = signature?.[cue];
      assert.ok(phrases && phrases.length >= 3, `${id}/${cue}`);
      for (const text of phrases ?? []) {
        assert.ok(text.length <= MAX_TEXT, `${id}/${cue}: ${JSON.stringify(text)}`);
        assert.match(text, /^[\x20-\x7e]+$/, `${id}/${cue}: ${JSON.stringify(text)}`);
      }
    }
  }
});

test("a phrase belongs to one Species only", () => {
  const owner = new Map<string, string>();
  const collisions: string[] = [];
  for (const [id, signature] of Object.entries(SIGNATURE)) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const text of signature?.[cue] ?? []) {
        const existing = owner.get(text);
        if (existing !== undefined && existing !== id) collisions.push(`"${text}" is said by both ${existing} and ${id}`);
        else owner.set(text, id);
      }
    }
  }
  assert.deepEqual(collisions, []);
});
