import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCENT, accentFor, type Accent } from "../accent.ts";
import { MAX_TEXT } from "../bubble.ts";
import type { TraitId } from "../../career/pick.ts";

test("every Trait that takes a Cue has phrases for it, and never for a Cue it does not take", () => {
  for (const [id, accent] of Object.entries(ACCENT)) {
    for (const cue of accent.takes) assert.ok(accent.phrases[cue]?.length, `${id} takes ${cue} without phrases`);
    const taken = new Set<string>(accent.takes);
    for (const cue of Object.keys(accent.phrases)) assert.ok(taken.has(cue), `${id} has phrases for ${cue} it does not take`);
  }
});

test("every phrase in ACCENT fits in MAX_TEXT, in printable ASCII", () => {
  for (const [id, accent] of Object.entries(ACCENT)) {
    for (const cue of accent.takes) {
      for (const text of accent.phrases[cue] ?? []) {
        assert.ok(text.length <= MAX_TEXT, `${id}/${cue}: ${JSON.stringify(text)}`);
        assert.match(text, /^[\x20-\x7e]+$/, `${id}/${cue}: ${JSON.stringify(text)}`);
      }
    }
  }
});

test("a held Trait speaks the Cues it takes and nothing else", () => {
  assert.deepEqual(accentFor("streak", ["hardy"]), ACCENT.hardy?.phrases.streak);
  assert.equal(accentFor("woke", ["hardy"]), undefined);
  assert.equal(accentFor("streak", []), undefined);
});

test("when two held Traits take one Cue the most recent Pick speaks", () => {
  const table: Record<TraitId, Accent> = {
    first: { takes: ["streak"], phrases: { streak: ["First's phrase."] } },
    second: { takes: ["streak"], phrases: { streak: ["Second's phrase."] } },
  };
  assert.deepEqual(accentFor("streak", ["first", "second"], table), table.second?.phrases.streak);
  assert.deepEqual(accentFor("streak", ["second", "first"], table), table.first?.phrases.streak);
});
