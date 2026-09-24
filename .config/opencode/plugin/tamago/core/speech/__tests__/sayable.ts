import assert from "node:assert/strict";
import { LANGUAGES, say, type Phrase } from "../../language.ts";
import { MAX_TEXT } from "../bubble.ts";

/** What every phrase must satisfy, in every Language it carries. Exported so other tests can check the same charset without redefining it. */
export const ALLOWED: Record<(typeof LANGUAGES)[number], RegExp> = {
  en: /^[\x20-\x7e]+$/,
  fr: /^[\x20-\x7eÀ-ÿŒœ]+$/,
};

export function assertSayable(phrase: Phrase, where: string): void {
  for (const language of LANGUAGES) {
    const written = phrase[language];
    const shown = `${where} [${language}]: ${JSON.stringify(written)}`;
    assert.ok(written.length > 0, shown);
    assert.ok(written.length <= MAX_TEXT, `${shown} is ${written.length} long, MAX_TEXT is ${MAX_TEXT}`);
    assert.match(written, ALLOWED[language], shown);
    assert.equal(written, written.normalize("NFC"), `${shown} must be NFC: length is measured in UTF-16 units`);
    assert.equal(say(phrase, language), written);
  }
}
