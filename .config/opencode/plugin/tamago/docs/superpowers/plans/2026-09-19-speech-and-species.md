# Speech and Species Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `core/speech/voice.ts` (300 lines: Cue vocabulary, phrase tables, Register draw, Voice machine) into four modules, and replace the three per-concern Species tables (`SPECIES` line, `bodies/<rarity>.ts`, `signatures/<rarity>.ts`) by one file per Rarity holding the complete definition of each Species, so that adding a Species is one entry in one file and a missing body or Signature is a compile error.

**Architecture:** Pure data and pure functions, unchanged. `speech/cue.ts` (Cue, Phrases, CUES), `speech/phrases.ts` (neutral and Temperament phrases), `speech/register.ts` (who speaks: the Register draw and `phrase`), `speech/voice.ts` (the Voice memory: `listen`, `speak`). The weighted-choice helper shared by the Register draw and the Rarity draw moves to `creature/random.ts`. `creature/species/<rarity>.ts` hold `readonly SpeciesDef[]` (id, label, rarity, Modifiers, bodies, signature); `creature/catalog.ts` concatenates them in today's draw order and exposes `SPECIES`, `REFERENCE`, `bodiesOf`, `signatureOf`; `creature/species.ts` keeps Rarity, paces and the `hatch` draw. `appearance/bodies.ts` and `speech/signature.ts` keep only their types.

**Tech Stack:** TypeScript under Node 24 type stripping, `node:test`; views untouched (`bun test view shell` and the eight snapshots must stay identical).

**Spec:** the two remaining candidates of the architecture reviews of 2026-09-18 (split `voice.ts`; one place per Species), with the user's decisions of 2026-09-19: TypeScript not JSON; one file per Rarity with complete definitions, not one per Species; consumers read bodies and Signature through the catalog; one `phrases.ts`.

## Global Constraints

- Work in `.config/opencode/plugin/tamago/`. Verify after every task: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"`, `bun test view shell`, `./node_modules/.bin/tsc --noEmit`, then `./scripts/doctor.sh --quick` from the repository root.
- **No behavior change.** The Species draw is pinned (`hatch` test "the owner's hatch date always gives the same Species"): the catalog must list the twenty Species in exactly today's `SPECIES` order. Every phrase, body and Modifier is copied verbatim. The eight view snapshots stay byte-identical; never `bun test -u`.
- An unknown Species id still draws as the reference and still speaks with its Temperament where the Species would (no Signature).
- Every relative import keeps its `.ts` extension; type-only imports use `import type` or inline `type`. No `enum`, no class parameter properties.
- Vocabulary from `CONTEXT.md`: Cue, Register, Signature, Voice, Bubble, Species, Rarity, Sprite. Never "state".
- Use `git mv` when a file moves so history follows. Move test bodies verbatim.
- Commit messages in Angular format, scope `opencode`. **Ask the user before every commit**; the user reviews each diff before it is applied.

---

### Task 1: Split `core/speech/voice.ts`

**Files:**
- Create: `core/speech/cue.ts`, `core/speech/phrases.ts`, `core/speech/register.ts`
- Modify: `core/speech/voice.ts` (keeps Bubble, Voice, `listen`, `speak`), `core/speech/signature.ts` (types from `cue.ts`), `core/creature/random.ts` (gains `weighted`), `core/creature/species.ts` (`rarityAt` uses `weighted`)
- Create tests: `core/speech/__tests__/phrases.test.ts`, `core/speech/__tests__/register.test.ts`; modify `core/speech/__tests__/voice.test.ts`, `core/speech/__tests__/signature.test.ts`, `core/__tests__/window.test.ts`, `core/creature/__tests__/random.test.ts`
- Modify: `README.md` (three sentences), `IDEAS.md` (one path)

**Interfaces:**
- `core/speech/cue.ts`: `type Cue` (the twelve), `type Phrases = readonly [string, ...string[]]`, `CUES: Record<Cue, { priority: number; cooldown: number }>` (verbatim).
- `core/speech/phrases.ts`: `PHRASES: Record<Cue, Phrases>` (neutral), `FLAVOR: Record<Temperament, Record<Cue, Phrases>>` (verbatim).
- `core/speech/register.ts`: `type Register`, `REGISTER`, `phrase(cue, speaker, times): string` (verbatim bodies of `pool`, `domain`, `phrase`; `REGISTERS` private).
- `core/speech/voice.ts`: `type Bubble`, `type Voice`, `REPLY_MS`, `BIG_DIFF_FILES`, `STREAK_MS`, `initialVoice`, `speak` (and private `listen`), importing `phrase` from `./register.ts` and `CUES, type Cue` from `./cue.ts`.
- `core/creature/random.ts`: `weighted<K extends string>(r: number, keys: readonly K[], weight: (key: K) => number): K` (verbatim body of today's `weighted` in voice.ts, exported).
- `core/creature/species.ts`: `rarityAt(roll, weights)` becomes `weighted(roll, RARITIES, (rarity) => weights[rarity])` (same cumulative walk, same last-key fallback; the pinned hatch tests prove it).

- [ ] **Step 1: `cue.ts` and `phrases.ts`**

Cut lines 9-22 (`Cue`), 67 (`Phrases`), 51-65 (`CUES`) of today's `voice.ts` into `core/speech/cue.ts`, comments included, no other import needed. Cut `PHRASES` (70-84) and `FLAVOR` (86-144) into `core/speech/phrases.ts` with:

```ts
import type { Temperament } from "../creature/sheet.ts";
import type { Cue, Phrases } from "./cue.ts";
```

- [ ] **Step 2: `weighted` to `random.ts`, `register.ts`**

Append to `core/creature/random.ts` (exported, doc comment kept): today's `weighted` (voice.ts 151-161). In `core/creature/species.ts`, replace the body of `rarityAt` with `return weighted(roll, RARITIES, (rarity) => weights[rarity]);` and import `weighted` from `./random.ts`; keep its doc comment.

`core/speech/register.ts`:

```ts
import { generator, seed, weighted } from "../creature/random.ts";
import { TEMPERAMENTS, temperamentOf, type Speaker, type Temperament } from "../creature/sheet.ts";
import type { Cue, Phrases } from "./cue.ts";
import { FLAVOR, PHRASES } from "./phrases.ts";
import { SIGNATURE } from "./signature.ts";

/** Who speaks a Cue: the Species, one of the four Temperaments, or nobody in particular. */
export type Register = "species" | "temperament" | "neutral";
/** Tuning table: the share of each Register, out of their sum. The Species first, so a Tamago is recognized by ear; the Temperament as a nuance; the neutral phrases as a common ground. */
export const REGISTER: Record<Register, number> = { species: 70, temperament: 25, neutral: 5 };
const REGISTERS: readonly Register[] = ["species", "temperament", "neutral"];
```

then `pool`, `domain`, `phrase` verbatim from today's voice.ts (163-197).

- [ ] **Step 3: `voice.ts` keeps the Voice**

Delete what moved; the header becomes:

```ts
import { MEDIAN, type Behavior } from "../creature/behavior.ts";
import type { Speaker } from "../creature/sheet.ts";
import type { TamagoEvent } from "../moment/events.ts";
import type { Session } from "../moment/session.ts";
import { CUES, type Cue } from "./cue.ts";
import { phrase } from "./register.ts";
```

`core/speech/signature.ts`: `import type { Cue, Phrases } from "./cue.ts";` instead of `./voice.ts`.

Other importers: `core/__tests__/window.test.ts` imports `phrase` from `../speech/register.ts`; `core/speech/__tests__/signature.test.ts` imports `CUES, type Cue` from `../cue.ts`. `view/sidebar.tsx` (`type Bubble`), `shell/mirror.ts` (`type Voice`), `core/window.ts` (`initialVoice, speak, type Voice`) do not change.

- [ ] **Step 4: Split the tests by module**

- `core/speech/__tests__/phrases.test.ts`: the tests `"every phrase fits in MAX_TEXT and every Cue has at least one"` and `"every Temperament flavors every Cue with at least two phrases that fit in MAX_TEXT, in printable ASCII"`, bodies verbatim, importing `PHRASES, FLAVOR` from `../phrases.ts`, `MAX_TEXT` from `../bubble.ts`, `TEMPERAMENTS` from `../../creature/sheet.ts`, `CUES` from `../cue.ts` if a body uses it.
- `core/speech/__tests__/register.test.ts`: the tests from `"REGISTER gives the Species the floor…"` through `"a Temperament Stat pushed below zero…"` (six tests), bodies verbatim, importing `REGISTER, phrase` from `../register.ts`, `SIGNATURE` from `../signature.ts`, `FLAVOR, PHRASES` from `../phrases.ts`, the `sheetOf` helper copied from voice.test.ts (it is a test helper; a copy in each file is fine).
- `core/speech/__tests__/voice.test.ts`: the rest; drop the imports that became unused; `phrase` now comes from `../register.ts`, `CUES`/`type Cue` from `../cue.ts`.
- `core/creature/__tests__/random.test.ts`: add

```ts
test("weighted lands on the key whose cumulative weight covers r, in keys order, and on the last key at r = 1", () => {
  const weight = (key: "a" | "b" | "c") => ({ a: 70, b: 25, c: 5 })[key];
  assert.equal(weighted(0, ["a", "b", "c"], weight), "a");
  assert.equal(weighted(0.699, ["a", "b", "c"], weight), "a");
  assert.equal(weighted(0.7, ["a", "b", "c"], weight), "b");
  assert.equal(weighted(0.949, ["a", "b", "c"], weight), "b");
  assert.equal(weighted(0.95, ["a", "b", "c"], weight), "c");
  assert.equal(weighted(1, ["a", "b", "c"], weight), "c", "r = 1 cannot happen from a generator; the last key is the fallback");
});
```

- [ ] **Step 5: Docs**

`README.md`: "Tuning lives in `core/speech/voice.ts`." → "Cue priorities and cooldowns live in `core/speech/cue.ts`, the Voice memory in `core/speech/voice.ts`."; "Each temperament has its flavor for every cue, in `core/speech/voice.ts`, next to the neutral phrases." → "…in `core/speech/phrases.ts`, next to the neutral phrases; which register speaks is drawn in `core/speech/register.ts`." `IDEAS.md:108` keeps `core/speech/voice.ts` (it is about the Voice machine) — leave.

- [ ] **Step 6: Verify**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts" && bun test view shell && ./node_modules/.bin/tsc --noEmit`
Expected: 340 node tests (339 + the `weighted` test; the split moves tests, it adds none), 14 bun, 0 snapshots updated, tsc clean. `wc -l core/speech/voice.ts` under 140. `grep -n "function weighted" core -r` shows `creature/random.ts` only.

- [ ] **Step 7: Commit (after the user's go)**

```bash
git add -A core/ README.md
git commit -m "refactor(opencode): split the tamago voice into cue, phrases, register and voice"
```

---

### Task 2: One file per Rarity, the whole Species in each entry

**Files:**
- Create: `core/creature/species/common.ts`, `uncommon.ts`, `rare.ts`, `epic.ts`, `legendary.ts`; `core/creature/catalog.ts`
- Modify: `core/creature/species.ts` (types and the draw; `SPECIES`/`REFERENCE` leave), `core/appearance/bodies.ts` (types only), `core/speech/signature.ts` (type only), `core/appearance/sprites.ts` (reads `bodiesOf`), `core/speech/register.ts` (reads `signatureOf`)
- Delete: `core/appearance/bodies/*.ts`, `core/speech/signatures/*.ts` (their content moves into the five Species files)
- Modify importers of `SPECIES`/`REFERENCE`: `core/career/career.ts`, `core/career/hydrate.ts`, `core/tamago.ts`, `core/creature/sheet.ts`, `core/creature/behavior.ts`, `core/creature/character.ts`, and the tests that import them
- Tests: create `core/creature/__tests__/catalog.test.ts` (the coverage and uniqueness tests of `bodies.test.ts` and `signature.test.ts`, over `SPECIES`); delete those two files; adjust `species.test.ts`, `sprites.test.ts`, `sheet.test.ts`, `character.test.ts`, `career.test.ts`, `hydrate.test.ts`, `text` tests that import `REFERENCE`/`SPECIES`
- Modify: `AGENTS.md` (the "new Species" rule), `README.md` (two sentences), `IDEAS.md` (one path)

**Interfaces:**

```ts
// core/creature/species.ts — what a Species is and how one is drawn. No data.
export type Rarity = …; export const RARITIES; export const RARITY;        // unchanged
export type SpeciesId = string;
/** The light record every derivation reads: id, label, Rarity, Modifiers. */
export type Species = { id: SpeciesId; label: string; rarity: Rarity; sheet?: Modifiers };
/** A catalog entry: the Species plus what it draws and what it says. Missing either is a compile error. */
export type SpeciesDef = Species & { bodies: Bodies; signature: Signature };
export function species(id, table = SPECIES): Species;   // unchanged, SPECIES/REFERENCE imported from ./catalog.ts
export function pace(id, table = SPECIES): number;       // unchanged
export function hatch(hatchedAt, table = SPECIES, weights = weightsAt(0)): SpeciesId;  // unchanged

// core/creature/catalog.ts — the data, in draw order.
export const SPECIES: readonly SpeciesDef[] = [...COMMON, ...UNCOMMON, ...RARE, ...EPIC, ...LEGENDARY];
/** The Species of a Career that recorded none: the creature drawn before Species existed. */
export const REFERENCE: SpeciesId = "cat";
/** The bodies to draw for an id: the reference's for an id this build does not know. */
export function bodiesOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Bodies;
/** Whether this build knows that Species by itself (drives the sprite cache key). */
export function known(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): boolean;
/** The Signature of an id; undefined for a Species this build does not know, so its Temperament speaks instead. */
export function signatureOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Signature | undefined;

// core/creature/species/common.ts (and the four others)
export const COMMON: readonly SpeciesDef[] = [ { id: "cat", label: "cat", rarity: "common", bodies: {…}, signature: {…} }, … ];

// core/appearance/bodies.ts — types only: Grown, Body, Bodies (doc comment kept).
// core/speech/signature.ts — type only: Signature = Record<Cue, Phrases>.
```

Import directions: `species/<rarity>.ts` import only types (`SpeciesDef` from `../species.ts`); `catalog.ts` imports the five tables (value) and types; `species.ts` imports `SPECIES, REFERENCE` from `./catalog.ts` (value) and `type Bodies`, `type Signature` (types). No value cycle: `catalog.ts` never imports a value from `species.ts`.

- [ ] **Step 1: Types**

`core/appearance/bodies.ts` becomes types only: delete the five imports and `BODIES`; keep `Grown`, `Body`, `Bodies` and the doc comment, reworded: "The bodies of every Species live in `core/creature/species/<rarity>.ts`, one entry per Species with its Signature. Every body fits in SPRITE_WIDTH × SPRITE_HEIGHT, puts the eyes in `( e )` on line 1 and the mark at column 10 of line 0; the hatchling holds in four lines. Tests in sprites.test.ts and catalog.test.ts enforce the size."

`core/speech/signature.ts` becomes: the `Signature` type with its comment reworded the same way ("…live in `core/creature/species/<rarity>.ts`…"); delete the imports and `SIGNATURE`.

`core/creature/species.ts`: add `import type { Bodies } from "../appearance/bodies.ts";`, `import type { Signature } from "../speech/signature.ts";`, `import { REFERENCE, SPECIES } from "./catalog.ts";`; add `export type SpeciesDef = Species & { bodies: Bodies; signature: Signature };` under `Species`; delete the `SPECIES` table (its big comment moves to `catalog.ts`) and `REFERENCE`; `species`, `pace`, `hatch` unchanged otherwise.

- [ ] **Step 2: The five Species files**

For each Rarity, `core/creature/species/<rarity>.ts`:

```ts
import type { SpeciesDef } from "../species.ts";

/** The common Species: everyday creatures. */
export const COMMON: readonly SpeciesDef[] = [
  {
    id: "cat",
    label: "cat",
    rarity: "common",
    bodies: {
      hatchling: (e, m) => [
        `   .---.  ${m}`,
        `  ( ${e} )`,
        "   \\ ^ /",
        "    '-'",
        "",
      ],
      young: …, adult: …, elder: …,   // verbatim from core/appearance/bodies/common.ts
    },
    signature: {
      permission: ["Mrow? May I?", "Paw on it. Yes?", "Say yes, human."],
      …                                // verbatim from core/speech/signatures/common.ts
    },
  },
  { id: "owl", label: "owl", rarity: "common", sheet: { stoic: 2, cheerful: -1, energy: -2, chatter: -1, patience: 2 }, bodies: {…}, signature: {…} },
  …
];
```

Order inside each file: today's `SPECIES` order (common: cat, owl, frog, duck, hamster, snail; uncommon: fox, penguin, octopus, bat, hedgehog, axolotl; rare: robot, ghost, jellyfish, chameleon; epic: phoenix, kraken, unicorn; legendary: dragon). `sheet` copied from today's `SPECIES` line (absent for cat). The per-Rarity doc comments of today's bodies files ("The common Species: everyday creatures.", "The legendary Species: the dragon alone, so it keeps its standing.", …) head each file. Then `git rm -r core/appearance/bodies core/speech/signatures`.

- [ ] **Step 3: `catalog.ts`**

```ts
import type { Bodies } from "../appearance/bodies.ts";
import type { Signature } from "../speech/signature.ts";
import type { SpeciesDef, SpeciesId } from "./species.ts";
import { COMMON } from "./species/common.ts";
import { EPIC } from "./species/epic.ts";
import { LEGENDARY } from "./species/legendary.ts";
import { RARE } from "./species/rare.ts";
import { UNCOMMON } from "./species/uncommon.ts";

/**
 * Every Species that can hatch, one file per Rarity, each entry complete:
 * Modifiers, bodies and Signature. Order within a Rarity is the order of the
 * draw: never reorder once shipped. Tune a `sheet` line before that Species
 * has hatched anywhere: the Sheet is derived, so changing it changes the
 * Temperament and Behavior of every Tamago of that Species already alive.
 * Once one lives, leave its line alone and add a sibling Species instead. The
 * reference entry has no Modifier and never will: that is what keeps every
 * Career from before the Sheet unchanged.
 */
export const SPECIES: readonly SpeciesDef[] = [...COMMON, ...UNCOMMON, ...RARE, ...EPIC, ...LEGENDARY];

/** The Species of a Career that recorded none: the creature drawn before Species existed. */
export const REFERENCE: SpeciesId = "cat";

function entry(id: SpeciesId, table: readonly SpeciesDef[]): SpeciesDef | undefined {
  return table.find((one) => one.id === id);
}

/** Whether this build draws that Species itself; anything else draws as the reference. */
export function known(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): boolean {
  return entry(id, table) !== undefined;
}

/** The bodies to draw: the Species' own, else the reference's for a Species this build does not know. */
export function bodiesOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Bodies {
  const found = entry(id, table) ?? entry(REFERENCE, table);
  if (found === undefined) throw new Error(`no reference Species "${REFERENCE}" in the table`);
  return found.bodies;
}

/** The Signature of a Species; undefined when this build does not know it, so its Temperament speaks in its place. */
export function signatureOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Signature | undefined {
  return entry(id, table)?.signature;
}
```

- [ ] **Step 4: Consumers**

`core/appearance/sprites.ts`: replace `import { BODIES, type Body } from "./bodies.ts";` with `import type { Body } from "./bodies.ts";` and `import { REFERENCE, bodiesOf, known } from "../creature/catalog.ts";`; delete the local `known`; `body()` becomes `if (stage === "egg") return EGG; return bodiesOf(species)[stage];`; `keyOf` unchanged (uses `known(species)` from the catalog and `REFERENCE`).

`core/speech/register.ts`: replace `import { SIGNATURE } from "./signature.ts";` with `import { signatureOf } from "../creature/catalog.ts";`; in `pool`, `SIGNATURE[speaker.species]?.[cue]` → `signatureOf(speaker.species)?.[cue]`.

`SPECIES`/`REFERENCE` importers switch to `./catalog.ts` / `../creature/catalog.ts`: `core/career/career.ts` (`SPECIES`), `core/career/hydrate.ts` (`REFERENCE`), `core/tamago.ts` (`SPECIES`), `core/creature/sheet.ts` (`SPECIES`), `core/creature/behavior.ts` (`SPECIES`), `core/creature/character.ts` (`REFERENCE, SPECIES`). Keep their `type Species` imports from `species.ts`. `tsc` names any missed one.

- [ ] **Step 5: Tests**

`core/creature/__tests__/catalog.test.ts` (new):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../../career/stage.ts";
import { MAX_TEXT } from "../../speech/bubble.ts";
import { CUES, type Cue } from "../../speech/cue.ts";
import { REFERENCE, SPECIES, bodiesOf, known, signatureOf } from "../catalog.ts";
```

then, bodies verbatim and adapted to iterate `SPECIES`: from `bodies.test.ts` the tests "every body draws every Stage past the egg" and "no two Species share a body at any Stage, and no Species draws two Stages alike"; from `signature.test.ts` "a Signature covers every Cue with at least three phrases that fit in MAX_TEXT, in printable ASCII" and "a phrase belongs to one Species only". The two "every Species of the table has a …, and every … names a Species of the table" tests are deleted: the type does it now. Add:

```ts
test("SPECIES keeps the draw order: common first, then by Rarity, twenty ids, the reference among the common", () => {
  assert.deepEqual(
    SPECIES.map((one) => one.id),
    ["cat", "owl", "frog", "duck", "hamster", "snail", "fox", "penguin", "octopus", "bat", "hedgehog", "axolotl", "robot", "ghost", "jellyfish", "chameleon", "phoenix", "kraken", "unicorn", "dragon"],
  );
  assert.equal(SPECIES.find((one) => one.id === REFERENCE)?.rarity, "common");
});

test("bodiesOf falls back to the reference and known says which ids are the build's own; signatureOf has no fallback", () => {
  assert.equal(bodiesOf("no-such-species"), bodiesOf(REFERENCE));
  assert.equal(known("no-such-species"), false);
  assert.equal(known("__proto__"), false);
  assert.equal(known(REFERENCE), true);
  assert.equal(signatureOf("no-such-species"), undefined);
  assert.notEqual(signatureOf(REFERENCE), undefined);
});
```

`git rm core/appearance/__tests__/bodies.test.ts core/speech/__tests__/signature.test.ts`. In `species.test.ts`, `sprites.test.ts`, `sheet.test.ts`, `character.test.ts`, `career.test.ts`, `hydrate.test.ts`, `text/__tests__/card.test.ts`, `text/__tests__/roster.test.ts`, `register.test.ts` (`SIGNATURE` → `signatureOf(id)!` where a body indexed `SIGNATURE[id]`): switch `SPECIES`/`REFERENCE` imports to `catalog.ts`; bodies unchanged. Tests that build a fake `table: readonly Species[]` (species.test, sheet.test, character.test) keep working: `species()`, `pace()`, `hatch()`, `sheet()` still take `readonly Species[]`.

- [ ] **Step 6: Docs**

`AGENTS.md` rule: "A new Species is one line in `SPECIES` (with its Modifiers), four bodies in `core/appearance/bodies/<rarity>.ts` and a full Signature in `core/speech/signatures/<rarity>.ts`. The tests fail at the first table that lacks it." → "A new Species is one entry in `core/creature/species/<rarity>.ts`: id, label, Rarity, Modifiers, four bodies and a full Signature. A missing body or Signature does not compile; the order of the entries is the draw order and never changes once shipped. The rarity weights live in `core/creature/luck.ts`, never in the Species files."

`README.md`: "Bodies live in `core/appearance/bodies/<rarity>.ts`, signatures in `core/speech/signatures/<rarity>.ts`." → "Each species lives whole, body and signature, in `core/creature/species/<rarity>.ts`."; "Each species has a signature: its own phrases for every cue, in `core/speech/signature.ts` and one file per rarity under `core/speech/signatures/`." → "Each species has a signature: its own phrases for every cue, in its entry of `core/creature/species/<rarity>.ts`."; "Tables live in `core/species.ts`" (the pace sentence, if still present as `core/creature/species.ts`) stays. `IDEAS.md:327-328`: `core/speech/signature.ts`, one file per Rarity under `core/speech/signatures/` → `core/creature/species/<rarity>.ts`. README Layout: `core/creature/` description gains "the Species catalog".

- [ ] **Step 7: Verify**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts" && bun test view shell && ./node_modules/.bin/tsc --noEmit`
Expected: 340 − 2 (coverage tests now type-level) + 2 (order, fallbacks) = 340 node tests pass, including the pinned `hatch` test and "an unknown species draws like the reference"; 14 bun, 0 snapshots updated; tsc clean. `ls core/appearance core/speech` shows no `bodies/` or `signatures/` folder. `grep -rn "BODIES\|SIGNATURE\b" core view shell index.tsx` prints nothing. From the repository root, `./scripts/doctor.sh --quick` green.

- [ ] **Step 8: Commit (after the user's go)**

```bash
git add -A core/ AGENTS.md README.md IDEAS.md
git commit -m "refactor(opencode): define each tamago species whole in one file per rarity"
```
