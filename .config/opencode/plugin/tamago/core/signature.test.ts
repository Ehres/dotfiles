import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT } from "./bubble.ts";
import { SIGNATURE, SIGNATURE_MAX_CUES } from "./signature.ts";
import { SPECIES } from "./species.ts";

test("every Species of the table has a Signature, and every Signature names a Species of the table", () => {
  for (const entry of SPECIES) assert.ok(SIGNATURE[entry.id], `${entry.id} has no Signature`);
  for (const id of Object.keys(SIGNATURE)) assert.ok(SPECIES.some((entry) => entry.id === id), `${id} is not a Species`);
});

test("a Signature covers hatched and at most SIGNATURE_MAX_CUES Cues, each with at least two phrases that fit in MAX_TEXT", () => {
  assert.equal(SIGNATURE_MAX_CUES, 3);
  for (const [id, signature] of Object.entries(SIGNATURE)) {
    const cues = Object.keys(signature ?? {});
    assert.ok(cues.includes("hatched"), `${id} does not speak at the hatch`);
    assert.ok(cues.length <= SIGNATURE_MAX_CUES, `${id} covers ${cues.length} Cues`);
    for (const [cue, phrases] of Object.entries(signature ?? {})) {
      assert.ok(phrases && phrases.length >= 2, `${id}/${cue}`);
      for (const text of phrases ?? []) assert.ok(text.length <= MAX_TEXT, `${id}/${cue}: ${JSON.stringify(text)}`);
    }
  }
});
