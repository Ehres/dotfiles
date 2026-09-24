import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPERAMENTS, type Sheet, type Speaker, type Temperament } from "../../creature/sheet.ts";
import { SPECIES, signatureOf } from "../../creature/catalog.ts";
import { REGISTER, phrase } from "../register.ts";
import { ACCENT, type Accent } from "../accent.ts";
import { FLAVOR, PHRASES } from "../phrases.ts";
import { CUES, TRAIT_CUES, type AnyCue, type Cue, type Phrases, type TraitCue } from "../cue.ts";
import type { TraitId } from "../../career/pick.ts";

/** A Sheet at the median everywhere but where `patch` says. */
const sheetOf = (patch: Partial<Sheet>): Sheet => ({ cheerful: 0, sarcastic: 0, stoic: 0, dreamy: 0, energy: 5, chatter: 5, sensitivity: 5, patience: 5, ...patch });
/** A stoic cat, the default Speaker of these tests. */
const STOIC: Speaker = { hatchedAt: 1, species: "cat", sheet: sheetOf({ stoic: 8 }), traits: [] };
const DRAGON: Speaker = { hatchedAt: 3, species: "dragon", sheet: sheetOf({ cheerful: 7 }), traits: [] };

/** `phrase`, asserted non-undefined: every Cue below is a plain Cue, never a Trait-opened one whose table owns no phrases for it. English only: the Language itself is exercised by "a Language changes the words, never which phrase is drawn" below. */
function say(cue: Cue, speaker: Speaker, times: number): string {
  const text = phrase(cue, speaker, times, "en");
  assert.ok(text !== undefined, `${cue} unexpectedly said nothing`);
  return text;
}

/** Which Register a text of `cue` belongs to, for a Speaker whose pools are pairwise disjoint. */
function registerOf(text: string, cue: Cue, species: string): "species" | Temperament | "neutral" | undefined {
  if (signatureOf(species)?.[cue].some((phrase) => phrase.en === text)) return "species";
  for (const temperament of TEMPERAMENTS) if (FLAVOR[temperament][cue].some((phrase) => phrase.en === text)) return temperament;
  if (PHRASES[cue].some((phrase) => phrase.en === text)) return "neutral";
  return undefined;
}

/** Fails unless the Species, the four Temperaments and the neutral phrases share no text for `cue`: the tests below classify by membership. */
function assertDisjoint(cue: Cue, species: string): void {
  const pools = [signatureOf(species)?.[cue] ?? [], ...TEMPERAMENTS.map((temperament) => FLAVOR[temperament][cue]), PHRASES[cue]];
  const all = pools.flat().map((phrase) => phrase.en);
  assert.equal(new Set(all).size, all.length, `${species}/${cue}: the pools overlap, pick another Cue for this test`);
}

test("REGISTER gives the Species the floor, the Temperament a nuance, the neutral phrases a common ground", () => {
  assert.deepEqual(REGISTER, { species: 70, temperament: 25, neutral: 5 });
});

test("phrase is deterministic, comes from one of the three Registers, and varies with the count", () => {
  assert.equal(say("compacted", STOIC, 3), say("compacted", STOIC, 3));
  const seen = new Set<string>();
  for (let times = 0; times < 30; times++) {
    const text = say("compacted", STOIC, times);
    assert.notEqual(registerOf(text, "compacted", "cat"), undefined, text);
    seen.add(text);
  }
  assert.ok(seen.size >= 3, "thirty occurrences say at least three different things");
});

test("over a thousand occurrences the Species speaks about 70 %, the Temperament 25 %, the neutral phrases 5 %", () => {
  assertDisjoint("compacted", "cat");
  const counts = { species: 0, temperament: 0, neutral: 0 };
  for (let times = 0; times < 1000; times++) {
    const register = registerOf(say("compacted", STOIC, times), "compacted", "cat");
    if (register === "species" || register === "neutral") counts[register]++;
    else counts.temperament++;
  }
  assert.ok(counts.species >= 650 && counts.species <= 750, `species ${counts.species}`);
  assert.ok(counts.temperament >= 200 && counts.temperament <= 300, `temperament ${counts.temperament}`);
  assert.ok(counts.neutral >= 30 && counts.neutral <= 70, `neutral ${counts.neutral}`);
});

test("among the Temperament's phrases, each Temperament speaks at the weight of its Stat", () => {
  assertDisjoint("compacted", "cat");
  const mixed: Speaker = { hatchedAt: 9, species: "cat", sheet: sheetOf({ sarcastic: 9, dreamy: 3 }), traits: [] };
  const counts: Record<string, number> = {};
  for (let times = 0; times < 4000; times++) {
    const register = registerOf(say("compacted", mixed, times), "compacted", "cat");
    if (register !== undefined && register !== "species" && register !== "neutral") counts[register] = (counts[register] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.ok(total >= 800, `about a quarter of 4000 belongs to the Temperament, got ${total}`);
  assert.equal(counts.cheerful ?? 0, 0, "a Stat at 0 never speaks");
  assert.equal(counts.stoic ?? 0, 0, "a Stat at 0 never speaks");
  const sarcastic = (counts.sarcastic ?? 0) / total;
  assert.ok(sarcastic >= 0.65 && sarcastic <= 0.85, `sarcastic 9 against dreamy 3 speaks about 75 %, got ${(sarcastic * 100).toFixed(1)} %`);
});

test("at the hatch the Species always speaks, and the phrase still varies", () => {
  const seen = new Set<string>();
  for (let times = 0; times < 50; times++) {
    const text = say("hatched", DRAGON, times);
    assert.ok(signatureOf("dragon")?.hatched.some((phrase) => phrase.en === text), text);
    seen.add(text);
  }
  assert.ok(seen.size >= 2);
});

test("a Species this build does not know speaks with its Temperament where the Species would", () => {
  assertDisjoint("compacted", "cat");
  const unknown: Speaker = { hatchedAt: 5, species: "nope", sheet: sheetOf({ dreamy: 8 }), traits: [] };
  for (let times = 0; times < 200; times++) {
    const register = registerOf(say("compacted", unknown, times), "compacted", "cat");
    assert.ok(register === "dreamy" || register === "neutral", `${times}: ${register}`);
  }
});

test("a Temperament Stat pushed below zero by a Modifier weighs nothing, and a Sheet with every Temperament at zero speaks its Temperament", () => {
  assertDisjoint("compacted", "cat");
  const negative: Speaker = { hatchedAt: 11, species: "cat", sheet: sheetOf({ stoic: 6, cheerful: -1 }), traits: [] };
  const flat: Speaker = { hatchedAt: 12, species: "cat", sheet: sheetOf({}), traits: [] };
  for (let times = 0; times < 300; times++) {
    const one = registerOf(say("compacted", negative, times), "compacted", "cat");
    assert.ok(one === "species" || one === "neutral" || one === "stoic", `${times}: ${one}`);
    const two = registerOf(say("compacted", flat, times), "compacted", "cat");
    assert.ok(two === "species" || two === "neutral" || two === "cheerful", `${times}: ${two}`);
  }
});

test("a Trait that takes a Cue silences the Species and the Temperament there", () => {
  const plain = { ...STOIC, traits: [] };
  const held = { ...STOIC, traits: ["hardy"] };
  const said = new Set<string>();
  for (let times = 0; times < 30; times++) said.add(say("streak", held, times));
  for (const text of said) assert.ok(ACCENT.hardy?.phrases.streak?.some((phrase) => phrase.en === text), `${text} is not hardy's`);
  assert.notDeepEqual(say("streak", plain, 0), say("streak", held, 0));
});

/**
 * Every Phrase the Voice can draw, indexed by its English. Two Phrases that
 * carry one English must carry one French, or a draw could not be followed
 * from one Language to the other by its words alone.
 */
function frenchByEnglish(): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  const add = (phrases: Phrases, where: string): void => {
    for (const one of phrases) {
      const french = one.fr;
      const already = index.get(one.en);
      assert.ok(already === undefined || already === french, `${where}: ${JSON.stringify(one.en)} is ${JSON.stringify(already)} elsewhere and ${JSON.stringify(french)} here`);
      index.set(one.en, french);
    }
  };
  for (const cue of Object.keys(CUES) as Cue[]) {
    add(PHRASES[cue], `neutral/${cue}`);
    for (const temperament of TEMPERAMENTS) add(FLAVOR[temperament][cue], `${temperament}/${cue}`);
    for (const one of SPECIES) add(one.signature[cue], `${one.id}/${cue}`);
  }
  for (const [id, accent] of Object.entries(ACCENT)) {
    for (const cue of [...accent.takes, ...accent.opens]) {
      const phrases = accent.phrases[cue];
      assert.ok(phrases !== undefined, `${id} claims ${cue} without phrases`);
      add(phrases, `${id}/${cue}`);
    }
  }
  return index;
}

test("a Language changes the words, never which phrase is drawn", () => {
  const french = frenchByEnglish();
  const holders: readonly Speaker[] = Object.keys(ACCENT).map((trait, index) => ({ hatchedAt: 30 + index, species: "owl", sheet: sheetOf({ cheerful: 6, stoic: 4 }), traits: [trait] }));
  const speakers: readonly Speaker[] = [
    STOIC,
    DRAGON,
    { hatchedAt: 21, species: "cat", sheet: sheetOf({ sarcastic: 9, dreamy: 3 }), traits: [] },
    { hatchedAt: 22, species: "nope", sheet: sheetOf({ dreamy: 8 }), traits: [] },
    ...holders,
  ];
  const cues: readonly AnyCue[] = [...(Object.keys(CUES) as Cue[]), ...(Object.keys(TRAIT_CUES) as TraitCue[])];
  let checked = 0;
  for (const speaker of speakers) {
    for (const cue of cues) {
      for (let times = 0; times < 24; times++) {
        const english = phrase(cue, speaker, times, "en");
        const said = phrase(cue, speaker, times, "fr");
        if (english === undefined) {
          assert.equal(said, undefined, `${cue}/${times}: English said nothing and French spoke`);
          continue;
        }
        // the same draw: the French said here is the French of the English said there
        assert.equal(said, french.get(english), `${cue}/${times}: the two Languages drew different phrases`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 1000, `the draws must reach every Register, only ${checked} checked`);
});

test("phrase says nothing, and never throws, when a held Trait's table opens a Cue it owns no phrases for", () => {
  const broken: Record<TraitId, Accent> = { watchful: { takes: [], opens: ["branch"], phrases: {} } };
  const seer = { ...STOIC, traits: ["watchful"] };
  assert.doesNotThrow(() => phrase("branch", seer, 0, "en", broken));
  assert.equal(phrase("branch", seer, 0, "en", broken), undefined);
});
