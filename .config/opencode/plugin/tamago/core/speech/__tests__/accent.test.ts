import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCENT, accentFor, opensCue, type Accent } from "../accent.ts";
import { MAX_TEXT } from "../bubble.ts";
import type { AnyCue } from "../cue.ts";
import type { TraitId } from "../../career/pick.ts";

test("every Cue a Trait takes or opens has phrases, and every phrase belongs to a Cue it takes or opens", () => {
  for (const [id, accent] of Object.entries(ACCENT)) {
    const owned: readonly AnyCue[] = [...accent.takes, ...accent.opens];
    for (const cue of owned) assert.ok(accent.phrases[cue]?.length, `${id} claims ${cue} without phrases`);
    const names = new Set<string>(owned);
    for (const cue of Object.keys(accent.phrases)) assert.ok(names.has(cue), `${id} has phrases for ${cue} it never speaks`);
  }
});

test("every phrase in ACCENT fits in MAX_TEXT, in printable ASCII", () => {
  for (const [id, accent] of Object.entries(ACCENT)) {
    for (const cue of [...accent.takes, ...accent.opens]) {
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

test("a held Trait speaks the Cues it opens and nothing else", () => {
  assert.deepEqual(accentFor("branch", ["watchful"]), ACCENT.watchful?.phrases.branch);
  assert.deepEqual(accentFor("stir", ["restless"]), ACCENT.restless?.phrases.stir);
  assert.equal(accentFor("stir", ["watchful"]), undefined);
  assert.equal(accentFor("branch", []), undefined);
});

test("when two held Traits take one Cue the most recent Pick speaks", () => {
  const table: Record<TraitId, Accent> = {
    first: { takes: ["streak"], opens: [], phrases: { streak: ["First's phrase."] } },
    second: { takes: ["streak"], opens: [], phrases: { streak: ["Second's phrase."] } },
  };
  assert.deepEqual(accentFor("streak", ["first", "second"], table), table.second?.phrases.streak);
  assert.deepEqual(accentFor("streak", ["second", "first"], table), table.first?.phrases.streak);
});

test("when two held Traits open one Cue the most recent Pick speaks", () => {
  const table: Record<TraitId, Accent> = {
    first: { takes: [], opens: ["branch"], phrases: { branch: ["First's phrase."] } },
    second: { takes: [], opens: ["branch"], phrases: { branch: ["Second's phrase."] } },
  };
  assert.deepEqual(accentFor("branch", ["first", "second"], table), table.second?.phrases.branch);
  assert.deepEqual(accentFor("branch", ["second", "first"], table), table.first?.phrases.branch);
});

test("opensCue is true only when a held Trait opens that Cue", () => {
  assert.equal(opensCue(["watchful"], "branch"), true);
  assert.equal(opensCue(["watchful"], "worktree"), true);
  assert.equal(opensCue(["watchful"], "stir"), false);
  assert.equal(opensCue([], "branch"), false);
  assert.equal(opensCue(["restless"], "stir"), true);
});
