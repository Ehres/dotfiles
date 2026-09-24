import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, say } from "../../language.ts";
import { STAGES } from "../../career/stage.ts";
import { RARITIES } from "../../creature/species.ts";
import { BEHAVIOR_STATS, TEMPERAMENTS } from "../../creature/sheet.ts";
import { CRAFTS } from "../../creature/character.ts";
import { CRAFT_TEXT, RARITY_TEXT, STAGE_TEXT, STANCE_TEXT, STAT_TEXT, TEMPERAMENT_TEXT } from "../tables.ts";
import type { Word } from "../word.ts";

/** French words in this table must stay inside the phrase charset, in NFC, and non-empty. Unlike spoken phrases, MAX_TEXT does not bound an interface label. */
const FRENCH_CHARSET = /^[\x20-\x7eÀ-ÿŒœ]+$/;

function assertWord(w: Word, where: string): void {
  assert.ok(w.en.length > 0, `${where} [en]`);
  assert.match(w.en, /^[\x20-\x7e]+$/, `${where} [en]`);
  assert.equal(w.en, w.en.normalize("NFC"), `${where} [en] must be NFC`);
  for (const gender of ["m", "f"] as const) {
    const written = w.fr[gender];
    assert.ok(written.length > 0, `${where} [fr/${gender}]`);
    assert.match(written, FRENCH_CHARSET, `${where} [fr/${gender}]`);
    assert.equal(written, written.normalize("NFC"), `${where} [fr/${gender}] must be NFC`);
  }
}

function assertPhrase(phrase: { en: string; fr?: string }, where: string): void {
  for (const language of LANGUAGES) {
    const written = phrase[language];
    if (written === undefined) continue;
    assert.ok(written.length > 0, `${where} [${language}]`);
    assert.match(written, language === "en" ? /^[\x20-\x7e]+$/ : FRENCH_CHARSET, `${where} [${language}]`);
    assert.equal(written, written.normalize("NFC"), `${where} [${language}] must be NFC`);
    assert.equal(say(phrase, language), written);
  }
}

test("STAGE_TEXT is total over STAGES", () => {
  for (const { id } of STAGES) assertWord(STAGE_TEXT[id], id);
});

test("RARITY_TEXT is total over RARITIES", () => {
  for (const rarity of RARITIES) assertWord(RARITY_TEXT[rarity], rarity);
});

test("STAT_TEXT is total over BEHAVIOR_STATS", () => {
  for (const stat of BEHAVIOR_STATS) assertPhrase(STAT_TEXT[stat], stat);
});

test("TEMPERAMENT_TEXT is total over TEMPERAMENTS", () => {
  for (const temperament of TEMPERAMENTS) assertPhrase(TEMPERAMENT_TEXT[temperament], temperament);
});

test("CRAFT_TEXT is total over the Craft keys and carries the noun's gender", () => {
  for (const craft of Object.keys(CRAFTS) as (keyof typeof CRAFTS)[]) {
    const entry = CRAFT_TEXT[craft];
    assertPhrase(entry.text, craft);
    assert.ok(entry.gender === "m" || entry.gender === "f", craft);
  }
});

test("STANCE_TEXT is total over the Stance keys", () => {
  for (const stance of Object.keys(STANCE_TEXT) as (keyof typeof STANCE_TEXT)[]) assertWord(STANCE_TEXT[stance], stance);
});

test("an invariable French Word is still written twice in the tables", () => {
  assertWord(RARITY_TEXT.rare, "rare");
  assert.equal(RARITY_TEXT.rare.fr.m, RARITY_TEXT.rare.fr.f);
});
