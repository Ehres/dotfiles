import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, type Phrase } from "../../language.ts";
import { STAGES } from "../../career/stage.ts";
import { RARITIES } from "../../creature/species.ts";
import { BEHAVIOR_STATS, TEMPERAMENTS } from "../../creature/sheet.ts";
import { CRAFTS, type Stance } from "../../creature/character.ts";
import { ALLOWED } from "../../speech/__tests__/sayable.ts";
import { CRAFT_TEXT, RARITY_TEXT, STAGE_TEXT, STANCE_TEXT, STAT_TEXT, TEMPERAMENT_TEXT } from "../tables.ts";
import type { Word } from "../word.ts";

/**
 * No independent `Stance[]` array exists anywhere in the codebase (unlike
 * `STAGES`, `RARITIES`, `BEHAVIOR_STATS`, `TEMPERAMENTS`, `CRAFTS`). This is a
 * test-local literal, the same pattern `word.test.ts`'s `COMMON`/`RARE`
 * fixtures already use: it must NOT be derived from `STANCE_TEXT` itself, or
 * the totality test below could never fail no matter what `STANCE_TEXT` is
 * missing.
 */
const STANCES: readonly Stance[] = ["prudent", "bold"];

function assertWord(w: Word, where: string): void {
  assert.ok(w.en.length > 0, `${where} [en]`);
  assert.match(w.en, ALLOWED.en, `${where} [en]`);
  assert.equal(w.en, w.en.normalize("NFC"), `${where} [en] must be NFC`);
  for (const gender of ["m", "f"] as const) {
    const written = w.fr[gender];
    assert.ok(written.length > 0, `${where} [fr/${gender}]`);
    assert.match(written, ALLOWED.fr, `${where} [fr/${gender}]`);
    assert.equal(written, written.normalize("NFC"), `${where} [fr/${gender}] must be NFC`);
    assert.doesNotMatch(written, /[^ ][?!:]/, `${where} [fr/${gender}] needs a space before ? ! and :`);
  }
}

function assertPhrase(phrase: Phrase, where: string): void {
  for (const language of LANGUAGES) {
    const written = phrase[language];
    assert.ok(written.length > 0, `${where} [${language}]`);
    assert.match(written, ALLOWED[language], `${where} [${language}]`);
    assert.equal(written, written.normalize("NFC"), `${where} [${language}] must be NFC`);
    if (language === "fr") assert.doesNotMatch(written, /[^ ][?!:]/, `${where} [fr] needs a space before ? ! and :`);
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

test("CRAFT_TEXT is total over the Craft keys", () => {
  for (const craft of Object.keys(CRAFTS) as (keyof typeof CRAFTS)[]) assertPhrase(CRAFT_TEXT[craft].text, craft);
});

test("STANCE_TEXT is total over the Stance keys", () => {
  for (const stance of STANCES) assertWord(STANCE_TEXT[stance], stance);
});

test("invariable French Words agree with themselves: the masculine and feminine forms are the same string", () => {
  for (const [w, label] of [
    [RARITY_TEXT.rare, "rare"],
    [RARITY_TEXT.epic, "epic"],
    [RARITY_TEXT.legendary, "legendary"],
    [STAGE_TEXT.egg, "egg"],
    [STAGE_TEXT.young, "young"],
    [STAGE_TEXT.adult, "adult"],
  ] as const) {
    assertWord(w, label);
    assert.equal(w.fr.m, w.fr.f, label);
  }
});
