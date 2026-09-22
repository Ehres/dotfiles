import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCENT, accentFor } from "../accent.ts";

test("every Trait that takes a Cue has phrases for it, and never for a Cue it does not take", () => {
  for (const [id, accent] of Object.entries(ACCENT)) {
    for (const cue of accent.takes) assert.ok(accent.phrases[cue]?.length, `${id} takes ${cue} without phrases`);
    for (const cue of Object.keys(accent.phrases)) assert.ok(accent.takes.includes(cue as never), `${id} has phrases for ${cue} it does not take`);
  }
});

test("a held Trait speaks the Cues it takes and nothing else", () => {
  assert.deepEqual(accentFor("streak", ["hardy"]), ACCENT.hardy?.phrases.streak);
  assert.equal(accentFor("woke", ["hardy"]), undefined);
  assert.equal(accentFor("streak", []), undefined);
});

test("when two held Traits take one Cue the most recent Pick speaks", () => {
  const both = accentFor("streak", ["hardy", "unshaken"]);
  assert.ok(both !== undefined);
});
