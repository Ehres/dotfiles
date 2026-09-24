import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPERAMENTS } from "../../creature/sheet.ts";
import { CUES, type Cue } from "../cue.ts";
import { FLAVOR, PHRASES } from "../phrases.ts";
import { assertSayable } from "./sayable.ts";

test("every phrase fits in MAX_TEXT and every Cue has at least one", () => {
  for (const cue of Object.keys(CUES) as Cue[]) {
    assert.ok(PHRASES[cue].length >= 1, cue);
    for (const phrase of PHRASES[cue]) assertSayable(phrase, cue);
  }
});

test("the neutral Register and all four Temperaments are written in French", () => {
  for (const cue of Object.keys(CUES) as Cue[]) {
    for (const phrase of PHRASES[cue]) assert.ok(phrase.fr !== undefined, `neutral/${cue}: ${JSON.stringify(phrase.en)}`);
    for (const temperament of TEMPERAMENTS) {
      for (const phrase of FLAVOR[temperament][cue]) {
        assert.ok(phrase.fr !== undefined, `${temperament}/${cue}: ${JSON.stringify(phrase.en)}`);
      }
    }
  }
});

test("every Temperament flavors every Cue with at least two phrases", () => {
  for (const temperament of TEMPERAMENTS) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      const phrases = FLAVOR[temperament][cue];
      assert.ok(phrases.length >= 2, `${temperament}/${cue}`);
      for (const phrase of phrases) assertSayable(phrase, `${temperament}/${cue}`);
    }
  }
});
