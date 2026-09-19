import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT } from "../bubble.ts";
import { TEMPERAMENTS } from "../../creature/sheet.ts";
import { CUES, type Cue } from "../cue.ts";
import { FLAVOR, PHRASES } from "../phrases.ts";

test("every phrase fits in MAX_TEXT and every Cue has at least one", () => {
  for (const cue of Object.keys(CUES) as Cue[]) {
    assert.ok(PHRASES[cue].length >= 1, cue);
    for (const text of PHRASES[cue]) assert.ok(text.length <= MAX_TEXT, `${cue}: ${JSON.stringify(text)}`);
  }
});

test("every Temperament flavors every Cue with at least two phrases that fit in MAX_TEXT, in printable ASCII", () => {
  for (const temperament of TEMPERAMENTS) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      const phrases = FLAVOR[temperament][cue];
      assert.ok(phrases.length >= 2, `${temperament}/${cue}`);
      for (const text of phrases) {
        assert.ok(text.length <= MAX_TEXT, `${temperament}/${cue}: ${JSON.stringify(text)}`);
        assert.match(text, /^[\x20-\x7e]+$/, `${temperament}/${cue}: ${JSON.stringify(text)}`);
      }
    }
  }
});
