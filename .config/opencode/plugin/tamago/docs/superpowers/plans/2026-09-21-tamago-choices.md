# Tamago Choices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the choices loop: at each of the four Evolutions the Tamago offers a Draw of Traits, the user keeps one from the palette, and the Pick marks the creature durably on its voice, on what it notices and on its Sprite.

**Architecture:** The pure tables and functions of `core/choices/` stop being empty and `core/tamago.ts` derives two more keys from the Career, so every view reads held Traits and pending Draws from the Tamago it already receives. A Pick is a Delta exactly like a rename. The Voice consults the held Traits before drawing a Register, the Sprite gets a one-character overlay, and the shell gains one palette command and one `DialogSelect`.

**Tech Stack:** TypeScript under Node 24 type stripping, `node:test` for core and adapter, `bun test` with `@opentui/solid` `testRender` for views and shell, Solid JSX compiled by OpenCode with `babel-preset-solid`.

**Spec:** `docs/superpowers/specs/2026-09-21-tamago-choices-design.md`

## Global Constraints

- Work in `.config/opencode/plugin/tamago/`. Verify after every task: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"`, `bun test view shell`, `./node_modules/.bin/tsc --noEmit`, then `./scripts/doctor.sh --quick` from the repository root.
- **Never commit without the user's explicit go.** The repository rule stands for every commit in this plan, including documentation. Show what would be committed and wait.
- No runtime dependency ever enters this package. `typescript` and `@types/node` are devDependencies used by the typechecker only.
- Every relative import keeps its `.ts` or `.tsx` extension; type-only imports use `import type` or an inline `type`. No `enum`, no `namespace`, no constructor parameter properties: `erasableSyntaxOnly` is on.
- Every user-visible phrase lives in `core/text/` or in a speech table under `core/speech/` and `core/creature/species/`. Views and shell hold none.
- Every Bubble phrase is English and at most `MAX_TEXT` (24) characters. `core/speech/__tests__/phrases.test.ts` and `core/creature/__tests__/catalog.test.ts` enforce it.
- Vocabulary from `CONTEXT.md`: Milestone, Draw, Pick, Trait, Cue, Register, Signature, Voice, Bubble, Sprite, Frame, Career, Delta. Never "achievement", "unlock", "perk", "buff", "card", "state".
- A changed view or shell snapshot must be named in the commit message body. Never run `bun test -u` blindly: read the diff first.
- Merge rules are law: counters add, the latest rename wins, the earliest Pick per Milestone wins, nothing is ever removed from a Career.

---

### Task 1: The Milestone and Trait tables

**Files:**
- Modify: `core/choices/milestone.ts` (the `MILESTONES` constant)
- Modify: `core/choices/trait.ts` (the `TRAITS` constant)
- Test: `core/choices/__tests__/milestone.test.ts`, `core/choices/__tests__/trait.test.ts`, `core/choices/__tests__/draw.test.ts`

**Interfaces:**
- Consumes: `Milestone`, `Trait`, `draw`, `pending` as they exist today.
- Produces: the Milestone ids `evolution:hatchling`, `evolution:young`, `evolution:adult`, `evolution:elder`, and the Trait ids `hardy`, `unshaken`, `proud`, `boastful`, `watchful`, `restless`. Every later task uses these exact strings.

- [ ] **Step 1: Replace the two "empty table" tests with the real ones**

In `core/choices/__tests__/milestone.test.ts`, replace the test named `"the shipped table is empty for now"` with:

```ts
test("the shipped Milestones are the four Evolutions, in Stage order", () => {
  assert.deepEqual(
    MILESTONES.map((one) => one.id),
    ["evolution:hatchling", "evolution:young", "evolution:adult", "evolution:elder"],
  );
  assert.deepEqual(MILESTONES.map((one) => ("stage" in one ? one.stage : undefined)), ["hatchling", "young", "adult", "elder"]);
});

test("an egg has reached nothing; an elder has reached all four", () => {
  assert.deepEqual(reached(counters({})), []);
  assert.deepEqual(reached(counters({ sessions: 10_000 })).length, 4);
});
```

In `core/choices/__tests__/trait.test.ts`, replace the test named `"the shipped table is empty for now"` with:

```ts
test("the shipped Traits are three families of two, the child needing its parent", () => {
  assert.deepEqual(
    TRAITS.map((one) => [one.id, [...one.needs]]),
    [
      ["hardy", []],
      ["unshaken", ["hardy"]],
      ["proud", []],
      ["boastful", ["proud"]],
      ["watchful", []],
      ["restless", ["watchful"]],
    ],
  );
});

test("only the three parents are eligible before any Pick", () => {
  const career = withPicks({});
  assert.deepEqual(eligible(career), ["hardy", "proud", "watchful"]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/choices/__tests__/*.test.ts"`
Expected: FAIL, the shipped tables are still empty.

- [ ] **Step 3: Fill the two tables**

In `core/choices/milestone.ts`, replace the `MILESTONES` constant, keeping the comment above it:

```ts
export const MILESTONES: readonly Milestone[] = [
  { id: "evolution:hatchling", stage: "hatchling" },
  { id: "evolution:young", stage: "young" },
  { id: "evolution:adult", stage: "adult" },
  { id: "evolution:elder", stage: "elder" },
];
```

In `core/choices/trait.ts`, replace the `TRAITS` constant, keeping the comment above it:

```ts
export const TRAITS: readonly Trait[] = [
  { id: "hardy", needs: [] },
  { id: "unshaken", needs: ["hardy"] },
  { id: "proud", needs: [] },
  { id: "boastful", needs: ["proud"] },
  { id: "watchful", needs: [] },
  { id: "restless", needs: ["watchful"] },
];
```

- [ ] **Step 4: Add the exhaustive Draw test**

In `core/choices/__tests__/draw.test.ts`, append. It walks every possible line of four Picks against the shipped tables, which is what guarantees no Milestone ever offers an empty Draw:

```ts
test("every line of four Picks keeps at least two candidates in every Draw", () => {
  const ids = MILESTONES.map((one) => one.id);
  const walk = (one: Career, depth: number): void => {
    if (depth === ids.length) return;
    const id = ids[depth];
    if (id === undefined) return;
    const offered = draw(one, id);
    assert.ok(offered.length >= 2, `${id} after ${JSON.stringify(one.picks)} offered ${offered.length}`);
    for (const trait of offered) walk({ ...one, picks: { ...one.picks, [id]: { trait, at: depth + 1 } } }, depth + 1);
  };
  walk(career(), 0);
});
```

Add `import { MILESTONES } from "../milestone.ts";` to that file's imports.

- [ ] **Step 5: Run the whole suite**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit`
Expected: PASS. No view or shell snapshot moves, since nothing reads the tables yet.

- [ ] **Step 6: Commit**

```bash
git add core/choices
git commit -m "feat(opencode): ship the four Evolution Milestones and six Traits"
```

---

### Task 2: The Sprite mark

**Files:**
- Create: `core/appearance/marks.ts`
- Modify: `core/appearance/sprites.ts` (overlay and its cache, `frameAt`, `heartFrame`)
- Test: `core/appearance/__tests__/marks.test.ts` (create), `core/creature/__tests__/catalog.test.ts` (free-cell test)

**Interfaces:**
- Consumes: `TraitId` from `core/career/pick.ts`, the Trait ids of Task 1.
- Produces: `MARK`, `MARK_LINE`, `MARK_COLUMN`, `markOf(held: readonly TraitId[]): string | undefined`; `frameAt(species, stage, activity, index, mark?)` and `heartFrame(species, stage, temperament, mark?)` with one optional trailing argument each.

- [ ] **Step 1: Write the failing tests**

Create `core/appearance/__tests__/marks.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MARK, markOf } from "../marks.ts";
import { frameAt, heartFrame } from "../sprites.ts";

test("every shipped Trait has a one-column mark", () => {
  for (const [id, mark] of Object.entries(MARK)) assert.equal(mark.length, 1, `${id} is not one column`);
});

test("the mark shown is the most recent Pick's; none without a held Trait", () => {
  assert.equal(markOf([]), undefined);
  assert.equal(markOf(["hardy"]), MARK.hardy);
  assert.equal(markOf(["hardy", "proud"]), MARK.proud);
  assert.equal(markOf(["hardy", "nonesuch"]), MARK.hardy); // an unknown Trait is ignored, never an error
});

test("the mark is overlaid on the top-left cell and nothing else moves", () => {
  const bare = frameAt("cat", "adult", "idle", 0);
  const marked = frameAt("cat", "adult", "idle", 0, "+");
  assert.equal(marked[0], `+${(bare[0] ?? "").slice(1)}`);
  assert.deepEqual(marked.slice(1), bare.slice(1));
  assert.equal(marked.length, bare.length);
});

test("a marked Frame is cached, so the same call gives the same reference", () => {
  assert.equal(frameAt("cat", "adult", "idle", 0, "+"), frameAt("cat", "adult", "idle", 0, "+"));
  assert.equal(heartFrame("cat", "adult", "cheerful", "+"), heartFrame("cat", "adult", "cheerful", "+"));
});

test("the heart and the mark live in different cells", () => {
  const petted = heartFrame("cat", "adult", "cheerful", "+");
  assert.equal((petted[0] ?? "")[0], "+");
  assert.ok((petted[0] ?? "").includes("♥"));
});
```

In `core/creature/__tests__/catalog.test.ts`, append the test that protects the overlay cell:

```ts
test("every Species leaves the overlay cell free at every Stage, so a Trait mark never covers a body", () => {
  for (const one of SPECIES) {
    for (const stage of ["egg", "hatchling", "young", "adult", "elder"] as const) {
      for (const frame of frames(one.id, stage, "idle")) {
        assert.equal((frame[MARK_LINE] ?? "")[MARK_COLUMN], " ", `${one.id}/${stage} fills the overlay cell`);
      }
    }
  }
});
```

Add to that file's imports: `import { frames } from "../../appearance/sprites.ts";` and `import { MARK_COLUMN, MARK_LINE } from "../../appearance/marks.ts";`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/appearance/__tests__/*.test.ts" "core/creature/__tests__/catalog.test.ts"`
Expected: FAIL, `../marks.ts` does not exist.

- [ ] **Step 3: Write `core/appearance/marks.ts`**

```ts
import type { TraitId } from "../career/pick.ts";

/**
 * Tune here, never in code paths. One column each: the mark is written over
 * one cell of the finished Frame. Every Pick marks the Sprite, whatever the
 * Trait's family, so a choice always shows.
 */
export const MARK: Record<TraitId, string> = {
  hardy: "+",
  unshaken: "#",
  proud: "*",
  boastful: "^",
  watchful: ":",
  restless: "~",
};

/** Where a mark is written: the top-left cell, free in every Species at every Stage (a test in catalog.test.ts keeps it so). */
export const MARK_LINE = 0;
export const MARK_COLUMN = 0;

/** The mark of the most recent Pick, so a new choice shows at once; undefined when no held Trait has one. `held` comes from `traits(career)`, oldest Pick first. */
export function markOf(held: readonly TraitId[]): string | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    const found = id === undefined ? undefined : MARK[id];
    if (found !== undefined) return found;
  }
  return undefined;
}
```

- [ ] **Step 4: Overlay the mark in `core/appearance/sprites.ts`**

Add the import `import { MARK_COLUMN, MARK_LINE } from "./marks.ts";`, then add below the `CACHE` declaration:

```ts
/** Writes `mark` over the overlay cell of a Frame. */
function overlay(frame: Frame, mark: string): Frame {
  return frame.map((line, index) => (index === MARK_LINE ? line.slice(0, MARK_COLUMN) + mark + line.slice(MARK_COLUMN + 1) : line));
}

const MARKED = new Map<string, readonly Frame[]>();

/** The Frames of an Activity with a Trait mark written on them, cached like the bare ones so identity stays stable. */
function markedFrames(species: SpeciesId, stage: StageId, activity: Activity, mark: string): readonly Frame[] {
  const key = `${keyOf(species, stage)}/${activity}/${mark}`;
  const hit = MARKED.get(key);
  if (hit) return hit;
  const built = frames(species, stage, activity).map((frame) => overlay(frame, mark));
  MARKED.set(key, built);
  return built;
}
```

Replace `frameAt` with:

```ts
export function frameAt(species: SpeciesId, stage: StageId, activity: Activity, index: number, mark?: string): Frame {
  const all = mark === undefined || mark === "" ? frames(species, stage, activity) : markedFrames(species, stage, activity, mark);
  const frame = all[((index % all.length) + all.length) % all.length];
  return frame ?? fit([]);
}
```

Replace `heartFrame` with the same shape, its cache key carrying the mark:

```ts
export function heartFrame(species: SpeciesId, stage: StageId, temperament: Temperament, mark?: string): Frame {
  const key = `${keyOf(species, stage)}/${temperament}/${mark ?? ""}`;
  const hit = HEARTS.get(key);
  if (hit) return hit;
  const drawn = fit(body(species, stage)(EYES[temperament], HEART));
  const built = mark === undefined || mark === "" ? drawn : overlay(drawn, mark);
  HEARTS.set(key, built);
  return built;
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test "core/**/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit` then `bun test view shell`
Expected: PASS everywhere, snapshots unchanged: no caller passes a mark yet.

- [ ] **Step 6: Commit**

```bash
git add core/appearance core/creature/__tests__/catalog.test.ts
git commit -m "feat(opencode): overlay a Trait mark on the sprite's free cell"
```

---

### Task 3: A Pick is a Delta

**Files:**
- Modify: `core/window.ts` (the `Effect` union, `adopt`, the new `pick`)
- Test: `core/__tests__/window.test.ts`

**Interfaces:**
- Consumes: `earn` and `adopt` as they are, `firstPicks`/`samePicks` from `core/career/pick.ts`, `TRAITS` from Task 1.
- Produces: `pick(window: Window, milestone: MilestoneId, trait: TraitId, now: number, table?: readonly Trait[]): Step` and the new effect `{ type: "chosen" }`.

- [ ] **Step 1: Write the failing tests**

Append to `core/__tests__/window.test.ts`:

```ts
test("a Pick is shown at once, stays pending until the flush, and raises `chosen`", () => {
  const start = freshWindow(career);
  const { window: after, effects } = pick(start, "evolution:hatchling", "hardy", 5);
  assert.deepEqual(after.career.picks, { "evolution:hatchling": { trait: "hardy", at: 5 } });
  assert.deepEqual(after.pending.picks, { "evolution:hatchling": { trait: "hardy", at: 5 } });
  assert.ok(effects.some((one) => one.type === "chosen"));
});

test("a Pick on a Milestone already picked, or of an unknown Trait, changes nothing", () => {
  const { window: once } = pick(freshWindow(career), "evolution:hatchling", "hardy", 5);
  assert.equal(pick(once, "evolution:hatchling", "proud", 9).window, once);
  assert.equal(pick(freshWindow(career), "evolution:hatchling", "nonesuch", 5).window.career.picks["evolution:hatchling"], undefined);
});

test("a Pick made in another window arrives through adopt and raises `chosen`", () => {
  const start = freshWindow(career);
  const elsewhere = { ...career, picks: { "evolution:hatchling": { trait: "proud", at: 3 } } };
  const { effects } = adopt(start, elsewhere, 10);
  assert.ok(effects.some((one) => one.type === "chosen"));
});
```

Use the `career` fixture already defined at the top of that file; add `pick` to the import from `../window.ts`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/__tests__/window.test.ts"`
Expected: FAIL, `pick` is not exported.

- [ ] **Step 3: Implement**

In `core/window.ts`, widen the `Effect` union:

```ts
export type Effect = { type: "evolved"; stage: StageId } | { type: "renamed" } | { type: "switched" } | { type: "chosen" };
```

In `adopt`, beside the rename comparison, push the effect whenever the Picks moved, so a Pick made in another window refreshes this one too:

```ts
if (!samePicks(window.career.picks, career.picks)) effects.push({ type: "chosen" });
```

Add at the end of the file:

```ts
/**
 * A Pick is a Delta, like a rename: shown at once here, flushed with the
 * counters, and the earliest Pick per Milestone wins across windows. A
 * Milestone already picked or a Trait this build does not know changes
 * nothing, so a stale dialog can never overwrite a choice.
 */
export function pick(window: Window, milestone: MilestoneId, trait: TraitId, now: number, table: readonly Trait[] = TRAITS): Step {
  if (window.career.picks[milestone] !== undefined) return { window, effects: [] };
  if (!table.some((entry) => entry.id === trait)) return { window, effects: [] };
  return earn(window, { ...EMPTY_DELTA, picks: { [milestone]: { trait, at: now } } }, now);
}
```

Add the imports: `import { samePicks, type MilestoneId, type TraitId } from "./career/pick.ts";` and `import { TRAITS, type Trait } from "./choices/trait.ts";`.

- [ ] **Step 4: Run the tests**

Run: `node --test "core/**/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/window.ts core/__tests__/window.test.ts
git commit -m "feat(opencode): make a Pick a Delta of the Career"
```

---

### Task 4: The Tamago derives its Traits and its pending Draws

**Files:**
- Modify: `core/tamago.ts` (two keys on `Tamago`)
- Modify: `core/creature/sheet.ts` (`Speaker` gains `traits`, `speakerOf` fills it)
- Test: `core/__tests__/tamago.test.ts`, `core/creature/__tests__/sheet.test.ts`

**Interfaces:**
- Consumes: `traits`/`eligible` from `core/choices/trait.ts`, `pending`/`Pending` from `core/choices/draw.ts`.
- Produces: `Tamago.traits: TraitId[]`, `Tamago.choices: Pending[]`, `Speaker.traits: readonly TraitId[]`. Tasks 6 to 10 read these three.

- [ ] **Step 1: Write the failing tests**

Append to `core/__tests__/tamago.test.ts`:

```ts
test("a Tamago carries the Traits it holds and the Draws awaiting a Pick", () => {
  const fresh = tamago(owner);
  assert.deepEqual(fresh.traits, []);
  assert.deepEqual(fresh.choices.map((one) => one.milestone.id), ["evolution:hatchling", "evolution:young", "evolution:adult"]);
  const kept = tamago({ ...owner, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } });
  assert.deepEqual(kept.traits, ["hardy"]);
  assert.deepEqual(kept.choices.map((one) => one.milestone.id), ["evolution:young", "evolution:adult"]);
});
```

`owner` is the adult cat fixture already declared at the top of that file: it
stands at `adult`, so exactly three Milestones are reached and the fourth,
`evolution:elder`, is not.

Append to `core/creature/__tests__/sheet.test.ts`:

```ts
test("the Speaker carries the held Traits, so the Voice never reads a Career", () => {
  const held = speakerOf({ ...career, picks: { "evolution:hatchling": { trait: "proud", at: 1 } } });
  assert.deepEqual(held.traits, ["proud"]);
  assert.deepEqual(speakerOf(career).traits, []);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/__tests__/tamago.test.ts" "core/creature/__tests__/sheet.test.ts"`
Expected: FAIL, `traits` and `choices` are not on the objects.

- [ ] **Step 3: Implement**

In `core/creature/sheet.ts`:

```ts
export type Speaker = { hatchedAt: number; species: SpeciesId; sheet: Sheet; traits: readonly TraitId[] };

export function speakerOf(career: Career, table: readonly Species[] = SPECIES): Speaker {
  return { hatchedAt: career.hatchedAt, species: career.species, sheet: sheet(career.hatchedAt, career.species, table), traits: traits(career) };
}
```

with `import { traits } from "../choices/trait.ts";` and `import type { TraitId } from "../career/pick.ts";`.

In `core/tamago.ts`, add the two keys to the `Tamago` type and fill them once:

```ts
export type Tamago = {
  // ...existing keys...
  /** The Traits held, oldest Pick first. */
  traits: TraitId[];
  /** The Draws awaiting a Pick, in Milestone order; the first is the one the palette offers. */
  choices: Pending[];
};
```

```ts
export function tamago(career: Career, table: readonly Species[] = SPECIES): Tamago {
  const sheet = sheetOf(career.hatchedAt, career.species, table);
  const temperament = temperamentOf(sheet);
  const found = vocation(career);
  const held = traits(career);
  return {
    // ...existing keys...
    traits: held,
    choices: pending(career),
    speaker: { hatchedAt: career.hatchedAt, species: career.species, sheet, traits: held },
  };
}
```

with `import { pending, type Pending } from "./choices/draw.ts";`, `import { traits } from "./choices/trait.ts";` and `import type { TraitId } from "./career/pick.ts";`.

- [ ] **Step 4: Run the tests**

Run: `node --test "core/**/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit` then `bun test view shell`
Expected: PASS, snapshots unchanged: no view reads the new keys yet.

- [ ] **Step 5: Commit**

```bash
git add core/tamago.ts core/creature/sheet.ts core/__tests__/tamago.test.ts core/creature/__tests__/sheet.test.ts
git commit -m "feat(opencode): derive held Traits and pending Draws from the Career"
```

---

### Task 5: The `choice` Cue and its twenty-five voices

This task only writes phrases and the Cue's tuning. Nothing speaks it yet, so the build stays green and the reviewer reads prose, not behaviour.

**Files:**
- Modify: `core/speech/cue.ts` (the `Cue` union, the `CUES` entry)
- Modify: `core/speech/phrases.ts` (`PHRASES.choice`, `FLAVOR[*].choice`)
- Modify: `core/creature/species/common.ts`, `uncommon.ts`, `rare.ts`, `epic.ts`, `legendary.ts` (one `choice` line per Species)
- Test: the existing coverage tests in `core/speech/__tests__/phrases.test.ts` and `core/creature/__tests__/catalog.test.ts` cover it by construction.

**Interfaces:**
- Produces: the Cue `choice`, priority 2, cooldown one hour.

- [ ] **Step 1: Add the Cue and watch the build break**

In `core/speech/cue.ts`, add `| "choice"` to the `Cue` union and the tuning entry:

```ts
  choice: { priority: 2, cooldown: 3_600_000 },
```

Run: `./node_modules/.bin/tsc --noEmit`
Expected: FAIL with one error per Species and per Temperament: `Signature`, `FLAVOR` and `PHRASES` are total over `Cue`. That is the coverage contract doing its job.

- [ ] **Step 2: Write the neutral and Temperament phrases**

In `core/speech/phrases.ts`, add to `PHRASES`:

```ts
  choice: ["Something to decide.", "A choice awaits.", "Your call."],
```

and to each Temperament of `FLAVOR`:

```ts
  // cheerful
  choice: ["Ooh, a choice! Yay!", "Pick one! Any one!", "Choices! Fun!"],
  // sarcastic
  choice: ["A choice. Riveting.", "Decide, if you like.", "Take your time."],
  // stoic
  choice: ["A choice waits.", "Decide when ready.", "It can wait."],
  // dreamy
  choice: ["Two paths, drifting...", "Something to choose...", "Mmh... a choice."],
```

- [ ] **Step 3: Write one `choice` line per Species**

Add a `choice` entry to each `signature`, in the Species' own voice. Full list, by file:

`common.ts`

```ts
  cat:     choice: ["Two paths. Pick one.", "I could be more.", "Choose, human."],
  owl:     choice: ["A choice awaits.", "Consider, then choose.", "Which branch?"],
  frog:    choice: ["Ribbit. Which way?", "Two lily pads.", "Hop left or right?"],
  duck:    choice: ["Ooh! A choice!", "Which one? Quack!", "Pick pick pick!"],
  hamster: choice: ["Squeak! Choose!", "Two seeds! Which?", "Pick one, quick!"],
  snail:   choice: ["A fork. No rush.", "Choose... slowly.", "Two trails ahead."],
```

`uncommon.ts`

```ts
  fox:      choice: ["Choose cleverly.", "Two ways. Pick well.", "Your move, human."],
  penguin:  choice: ["A decision, please.", "Formal choice awaits.", "Select one."],
  octopus:  choice: ["Ooh, options!", "Three arms, one pick.", "Which shall I be?"],
  bat:      choice: ["Something waits.", "A choice, quietly.", "Listen. Then choose."],
  hedgehog: choice: ["Snuffle. A choice.", "Which way, then?", "Two paths. Hmm."],
  axolotl:  choice: ["A choice! Smile.", "Which one? Hehe.", "Pick one for me!"],
```

`rare.ts`

```ts
  robot:      choice: ["Input required.", "Select an option.", "Awaiting your choice."],
  ghost:      choice: ["Choose... for me...", "Something stirs.", "A path, unchosen."],
  jellyfish:  choice: ["A current parts.", "Drift left, or right?", "Choose. Softly."],
  chameleon:  choice: ["I could change.", "Which colour today?", "Pick what I become."],
```

`epic.ts`

```ts
  phoenix: choice: ["Choose my next fire.", "A turning! Choose.", "Which flame?"],
  kraken:  choice: ["Choose, small one.", "The deep offers two.", "Decide."],
  unicorn: choice: ["A choice! Sparkle!", "Which gift, then?", "Choose beautifully."],
```

`legendary.ts`

```ts
  dragon: choice: ["Choose. I allow it.", "Two futures. Pick.", "Decide, human."],
```

- [ ] **Step 4: Run the coverage tests**

Run: `./node_modules/.bin/tsc --noEmit` then `node --test "core/**/__tests__/*.test.ts"`
Expected: PASS. `phrases.test.ts` and `catalog.test.ts` check every phrase against `MAX_TEXT`; every line above fits in 24 characters, but trust the test, not the count.

- [ ] **Step 5: Commit**

```bash
git add core/speech core/creature/species
git commit -m "feat(opencode): give every Species a phrase for the choice Cue"
```

---

### Task 6: The Tamago says a choice awaits

**Files:**
- Modify: `core/speech/voice.ts` (`speak` gains `awaits`, `listen` raises `choice`)
- Modify: `core/window.ts` (`move` computes `awaits` once per event)
- Test: `core/speech/__tests__/voice.test.ts`, `core/__tests__/window.test.ts`

**Interfaces:**
- Consumes: `Tamago.choices` is not used here; the Window computes `pending(career).length > 0` itself, because `speak` must stay pure over its arguments.
- Produces: `speak(voice, event, before, after, now, speaker, behavior, awaits?)`. The new argument is last and defaults to `false`, so existing callers and tests compile unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `core/speech/__tests__/voice.test.ts`:

```ts
test("a pending Draw makes the Tamago speak at the first calm, not during the work", () => {
  const busy = { ...initialSession(0), busy: true, activity: "working" as const };
  const calm = { ...initialSession(0), busy: false, activity: "idle" as const };
  const quiet = speak(initialVoice(), { type: "session_idle" }, busy, calm, 1_000, speaker, MEDIAN, false);
  assert.equal(quiet.bubble, undefined);
  const said = speak(initialVoice(), { type: "session_idle" }, busy, calm, 1_000, speaker, MEDIAN, true);
  assert.equal(said.bubble?.cue, "choice");
});

test("the choice reminder repeats at most once an hour", () => {
  const busy = { ...initialSession(0), busy: true, activity: "working" as const };
  const calm = { ...initialSession(0), busy: false, activity: "idle" as const };
  const first = speak(initialVoice(), { type: "session_idle" }, busy, calm, 1_000, speaker, MEDIAN, true);
  const soon = speak(first, { type: "session_idle" }, busy, calm, 1_000 + 600_000, speaker, MEDIAN, true);
  assert.equal(soon.bubble?.cue, first.bubble?.cue);
  assert.equal(soon.spoken.choice?.times, 1);
  const later = speak(first, { type: "session_idle" }, busy, calm, 1_000 + 3_600_001, speaker, MEDIAN, true);
  assert.equal(later.spoken.choice?.times, 2);
});
```

Reuse the `speaker` fixture of that file; if it is built inline, add `traits: []` to it.

Append to `core/__tests__/window.test.ts`:

```ts
test("the Window tells the Voice when a Draw awaits a Pick", () => {
  const grown = { ...career, sessions: 10_000 }; // past every Milestone, so Draws are pending
  const w = freshWindow(grown);
  const busy = receive(w, { target: { type: "session", id: "a" }, event: { type: "session_busy" } }, 0).window;
  const calm = receive(busy, { target: { type: "session", id: "a" }, event: { type: "session_idle" } }, 1_000).window;
  assert.equal(calm.voices.a?.bubble?.cue, "choice");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/speech/__tests__/voice.test.ts" "core/__tests__/window.test.ts"`
Expected: FAIL, `speak` takes seven arguments and never raises `choice`.

- [ ] **Step 3: Implement in `core/speech/voice.ts`**

Give `listen` the flag and raise the Cue on the calm, after the `long_work` rule so a long session still gets its own line first:

```ts
function listen(voice: Voice, event: TamagoEvent, before: Session, after: Session, now: number, behavior: Behavior, awaits: boolean): { voice: Voice; cue?: Cue } {
```

```ts
    case "session_idle":
      if (before.busy && next.busySince !== undefined && now - next.busySince >= behavior.longWorkMs) cue = "long_work";
      else if (awaits) cue = "choice";
      break;
```

and on `speak`:

```ts
export function speak(
  voice: Voice,
  event: TamagoEvent,
  before: Session,
  after: Session,
  now: number,
  speaker: Speaker,
  behavior: Behavior = MEDIAN,
  /** Whether a Draw awaits a Pick. The Voice cannot see the Career, so the Window computes it. */
  awaits = false,
): Voice {
```

passing `awaits` down to `listen`.

- [ ] **Step 4: Implement in `core/window.ts`**

In `move`, compute it once for the whole event, beside the Behavior:

```ts
  const conduct = behavior(window.career);
  const awaits = pending(window.career).length > 0;
```

and pass it as the last argument of the `speak` call. Add `import { pending } from "./choices/draw.ts";`.

- [ ] **Step 5: Run the tests**

Run: `node --test "core/**/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit` then `bun test view shell`
Expected: PASS. A shell snapshot may move if its fixture Career has a pending Draw; read the diff and name it in the commit.

- [ ] **Step 6: Commit**

```bash
git add core/speech/voice.ts core/window.ts core/speech/__tests__/voice.test.ts core/__tests__/window.test.ts
git commit -m "feat(opencode): say a choice awaits at the first calm"
```

---

### Task 7: A Trait takes its Cues

**Files:**
- Create: `core/speech/accent.ts`
- Modify: `core/speech/register.ts` (`pool` consults the held Traits)
- Test: `core/speech/__tests__/accent.test.ts` (create), `core/speech/__tests__/register.test.ts`

**Interfaces:**
- Consumes: `Speaker.traits` from Task 4, `Phrases` and `Cue` from `core/speech/cue.ts`.
- Produces: `ACCENT: Record<TraitId, Accent>` where `Accent = { takes: readonly Cue[]; phrases: Partial<Record<Cue, Phrases>> }`, and `accentFor(cue: Cue, held: readonly TraitId[]): Phrases | undefined`.

- [ ] **Step 1: Write the failing tests**

Create `core/speech/__tests__/accent.test.ts`:

```ts
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
```

Append to `core/speech/__tests__/register.test.ts`:

```ts
test("a Trait that takes a Cue silences the Species and the Temperament there", () => {
  const plain = { ...speaker, traits: [] };
  const held = { ...speaker, traits: ["hardy"] };
  const said = new Set<string>();
  for (let times = 0; times < 30; times++) said.add(phrase("streak", held, times));
  for (const text of said) assert.ok(ACCENT.hardy?.phrases.streak?.includes(text), `${text} is not hardy's`);
  assert.notDeepEqual(phrase("streak", plain, 0), phrase("streak", held, 0));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/speech/__tests__/*.test.ts"`
Expected: FAIL, `../accent.ts` does not exist.

- [ ] **Step 3: Write `core/speech/accent.ts`**

```ts
import type { TraitId } from "../career/pick.ts";
import type { Cue, Phrases } from "./cue.ts";

/** What a Trait does to the Voice: the Cues it takes over, and its phrases for each of them. */
export type Accent = { takes: readonly Cue[]; phrases: Partial<Record<Cue, Phrases>> };

/**
 * Tune here, never in code paths. On a Cue a held Trait takes, that Trait
 * always speaks: the Species and the Temperament stay silent there. A test
 * checks that `takes` and `phrases` name exactly the same Cues.
 */
export const ACCENT: Record<TraitId, Accent> = {
  hardy: {
    takes: ["streak", "retried"],
    phrases: {
      streak: ["Still standing.", "Keep them coming.", "Barely felt it."],
      retried: ["Again. Fine by me.", "Once more.", "I don't tire."],
    },
  },
  unshaken: {
    takes: ["denied", "long_work"],
    phrases: {
      denied: ["Understood.", "No matter.", "As you say."],
      long_work: ["Long one. No trouble.", "Still steady.", "That held."],
    },
  },
  proud: {
    takes: ["todos_done", "big_diff"],
    phrases: {
      todos_done: ["Every one of them.", "Flawless.", "Look at that list."],
      big_diff: ["A whole cathedral.", "Look at this work!", "We built that."],
    },
  },
  boastful: {
    takes: ["evolved", "granted"],
    phrases: {
      evolved: ["Behold the new me.", "Better already.", "Told you I would."],
      granted: ["Naturally.", "Wise of you.", "Of course. Watch."],
    },
  },
  watchful: { takes: [], phrases: {} },
  restless: { takes: [], phrases: {} },
};

/** The phrases of the most recently picked held Trait that takes this Cue; undefined when none does. `held` is oldest Pick first. */
export function accentFor(cue: Cue, held: readonly TraitId[]): Phrases | undefined {
  for (let i = held.length - 1; i >= 0; i--) {
    const id = held[i];
    const found = id === undefined ? undefined : ACCENT[id];
    if (found?.takes.includes(cue)) return found.phrases[cue];
  }
  return undefined;
}
```

- [ ] **Step 4: Consult the Traits first in `core/speech/register.ts`**

At the top of `phrase`, before the Register is drawn:

```ts
export function phrase(cue: Cue, speaker: Speaker, times: number): string {
  const taken = accentFor(cue, speaker.traits);
  const random = generator(seed(speaker.hatchedAt, domain(cue, times)));
  if (taken !== undefined) return taken[Math.floor(random() * taken.length)] ?? taken[0];
  const register = cue === "hatched" ? "species" : weighted(random(), REGISTERS, (key) => REGISTER[key]);
  const own = pool(cue, speaker, register, random());
  return own[Math.floor(random() * own.length)] ?? own[0];
}
```

The first `random()` is consumed either way, so adding a Trait never shifts the phrases of the Cues it does not take. Add `import { accentFor } from "./accent.ts";`.

- [ ] **Step 5: Run the tests**

Run: `node --test "core/**/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/speech
git commit -m "feat(opencode): let a Trait take the Cues it speaks"
```

---

### Task 8: The Cues a Trait opens

**Files:**
- Modify: `core/speech/cue.ts` (`TraitCue`, `AnyCue`, `TRAIT_CUES`, `tuningOf`)
- Modify: `core/speech/accent.ts` (`opens` and its phrases for `watchful` and `restless`)
- Modify: `core/speech/voice.ts` (`Bubble.cue` widens, `listen` gates the three events)
- Modify: `core/moment/events.ts` (three events), `core/career/count.ts` if it switches exhaustively
- Modify: `adapter/translate.ts` (`SUBSCRIBED` and three cases)
- Test: `core/speech/__tests__/voice.test.ts`, `adapter/__tests__/translate.test.ts`, `core/career/__tests__/count.test.ts`

**Interfaces:**
- Consumes: `Speaker.traits`, `accentFor`.
- Produces: `TraitCue = "branch" | "worktree" | "stir"`, `AnyCue = Cue | TraitCue`, `tuningOf(cue: AnyCue)`, the events `branch_changed`, `worktree_ready`, `files_stirred`.

- [ ] **Step 1: Write the failing tests**

Append to `core/speech/__tests__/voice.test.ts`:

```ts
test("the Cues a Trait opens are silent until that Trait is held", () => {
  const plain = { ...speaker, traits: [] };
  const seer = { ...speaker, traits: ["watchful"] };
  const calm = initialSession(0);
  assert.equal(speak(initialVoice(), { type: "branch_changed" }, calm, calm, 10, plain, MEDIAN).bubble, undefined);
  assert.equal(speak(initialVoice(), { type: "branch_changed" }, calm, calm, 10, seer, MEDIAN).bubble?.cue, "branch");
  assert.equal(speak(initialVoice(), { type: "worktree_ready" }, calm, calm, 10, seer, MEDIAN).bubble?.cue, "worktree");
});

test("restless speaks of files stirring only while the session is calm: our own edits are not news", () => {
  const restless = { ...speaker, traits: ["watchful", "restless"] };
  const calm = initialSession(0);
  const busy = { ...initialSession(0), busy: true, activity: "working" as const };
  assert.equal(speak(initialVoice(), { type: "files_stirred" }, calm, calm, 10, restless, MEDIAN).bubble?.cue, "stir");
  assert.equal(speak(initialVoice(), { type: "files_stirred" }, busy, busy, 10, restless, MEDIAN).bubble, undefined);
});
```

Append to `adapter/__tests__/translate.test.ts`:

```ts
test("the first branch of a run is silent; only a change speaks", () => {
  const translate = createTranslator();
  assert.deepEqual(translate({ type: "vcs.branch.updated", properties: { branch: "master" } } as never), []);
  assert.deepEqual(translate({ type: "vcs.branch.updated", properties: { branch: "master" } } as never), []);
  assert.deepEqual(translate({ type: "vcs.branch.updated", properties: { branch: "feature" } } as never), [
    { target: { type: "every" }, event: { type: "branch_changed" } },
  ]);
});

test("a ready worktree and a stirred file reach every session and count nothing", () => {
  const translate = createTranslator();
  assert.deepEqual(translate({ type: "worktree.ready", properties: { name: "hack" } } as never), [
    { target: { type: "every" }, event: { type: "worktree_ready" } },
  ]);
  assert.deepEqual(translate({ type: "file.watcher.updated", properties: {} } as never), [
    { target: { type: "every" }, event: { type: "files_stirred" } },
  ]);
});
```

Append to `core/career/__tests__/count.test.ts`:

```ts
test("the Cues a Trait opens count nothing", () => {
  for (const event of [{ type: "branch_changed" }, { type: "worktree_ready" }, { type: "files_stirred" }] as const) {
    assert.ok(isEmpty(count(event)));
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"`
Expected: FAIL on the unknown event types.

- [ ] **Step 3: Widen the Cue vocabulary in `core/speech/cue.ts`**

```ts
/** The Cues only a Trait opens: nobody else speaks them, so no Species owes them a phrase and `Signature` stays total over `Cue`. */
export type TraitCue = "branch" | "worktree" | "stir";
export type AnyCue = Cue | TraitCue;

export const TRAIT_CUES: Record<TraitCue, { priority: number; cooldown: number }> = {
  branch: { priority: 1, cooldown: 60_000 },
  worktree: { priority: 1, cooldown: 60_000 },
  stir: { priority: 1, cooldown: 600_000 },
};

/** The tuning of any Cue, whoever speaks it. */
export function tuningOf(cue: AnyCue): { priority: number; cooldown: number } {
  return cue in TRAIT_CUES ? TRAIT_CUES[cue as TraitCue] : CUES[cue as Cue];
}
```

- [ ] **Step 4: Declare what the two Traits open, in `core/speech/accent.ts`**

Widen the type and fill the two entries:

```ts
export type Accent = { takes: readonly Cue[]; opens: readonly TraitCue[]; phrases: Partial<Record<AnyCue, Phrases>> };
```

```ts
  watchful: {
    takes: [],
    opens: ["branch", "worktree"],
    phrases: {
      branch: ["New branch. Noted.", "We moved. I saw.", "Different ground."],
      worktree: ["A new tree. Nice.", "Another workspace.", "Room to work."],
    },
  },
  restless: {
    takes: [],
    opens: ["stir"],
    phrases: { stir: ["Something moved.", "Files shifted. Hm.", "Not us, that one."] },
  },
```

Give every other entry `opens: []`, and widen `accentFor` to `accentFor(cue: AnyCue, held: readonly TraitId[])`, looking in `takes` and in `opens`:

```ts
    if (found !== undefined && (found.takes.includes(cue as Cue) || found.opens.includes(cue as TraitCue))) return found.phrases[cue];
```

Then replace the coverage test of Task 7 with one that covers both lists:

```ts
test("every Cue a Trait takes or opens has phrases, and every phrase belongs to a Cue it takes or opens", () => {
  for (const [id, accent] of Object.entries(ACCENT)) {
    const owned: readonly AnyCue[] = [...accent.takes, ...accent.opens];
    for (const cue of owned) assert.ok(accent.phrases[cue]?.length, `${id} claims ${cue} without phrases`);
    for (const cue of Object.keys(accent.phrases)) assert.ok(owned.includes(cue as AnyCue), `${id} has phrases for ${cue} it never speaks`);
  }
});
```

Add `opensCue`, which the Voice calls:

```ts
/** Whether any held Trait opens this Cue. */
export function opensCue(held: readonly TraitId[], cue: TraitCue): boolean {
  return held.some((id) => ACCENT[id]?.opens.includes(cue) === true);
}
```

- [ ] **Step 5: Raise them in `core/speech/voice.ts`**

Widen `Bubble`:

```ts
export type Bubble = { cue: AnyCue; text: string; since: number; until: number };
```

and `Voice.spoken` to `Partial<Record<AnyCue, { at: number; times: number }>>`, then in `listen`:

```ts
    case "branch_changed":
      if (opensCue(speaker.traits, "branch")) cue = "branch";
      break;
    case "worktree_ready":
      if (opensCue(speaker.traits, "worktree")) cue = "worktree";
      break;
    case "files_stirred":
      // Our own edits are not news: a stirred file only speaks while the session is calm.
      if (!after.busy && opensCue(speaker.traits, "stir")) cue = "stir";
      break;
```

`listen` therefore takes the `speaker` as an argument; pass it from `speak`. Replace the `CUES[cue]` lookup in `speak` with `tuningOf(cue)`. Export `opensCue(held: readonly TraitId[], cue: TraitCue): boolean` from `accent.ts`.

- [ ] **Step 6: Add the three events**

In `core/moment/events.ts`, beside the other speech events:

```ts
  /** The repository moved: a branch was changed, a worktree became ready, files stirred on disk. Speech only: they move nothing and count nothing. */
  | { type: "branch_changed" }
  | { type: "worktree_ready" }
  | { type: "files_stirred" }
```

In `adapter/translate.ts`, add `"vcs.branch.updated"`, `"worktree.ready"` and `"file.watcher.updated"` to `SUBSCRIBED`, declare `let branch: string | undefined;` inside `createTranslator`, and add the three cases:

```ts
      case "vcs.branch.updated": {
        const current = isRecord(props) ? str(props.branch) : undefined;
        if (current === undefined || current === branch) return [];
        const first = branch === undefined; // the value seen at startup is the branch we are on, not a move
        branch = current;
        return first ? [] : [{ target: EVERY, event: { type: "branch_changed" } }];
      }
      case "worktree.ready":
        return [{ target: EVERY, event: { type: "worktree_ready" } }];
      case "file.watcher.updated":
        return [{ target: EVERY, event: { type: "files_stirred" } }];
```

- [ ] **Step 7: Run everything**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"` then `./node_modules/.bin/tsc --noEmit` then `bun test view shell`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add core adapter
git commit -m "feat(opencode): open the branch, worktree and stir Cues to Traits"
```

---

### Task 9: The badge, the mark and the Traits on the card

**Files:**
- Create: `core/text/traits.ts`
- Modify: `core/text/card.ts` (`traitLines`)
- Modify: `view/sprite.tsx`, `view/sidebar.tsx`, `view/home.tsx`, `view/card.tsx`
- Test: `view/__tests__/sidebar.test.tsx`, `home.test.tsx`, `card.test.tsx`, `sprite.test.tsx`

**Interfaces:**
- Consumes: `Tamago.traits`, `Tamago.choices`, `markOf`.
- Produces: `CHOICE_BADGE`, `TRAIT_TEXT: Record<TraitId, { title: string; description: string }>`, `traitLines(tamago: Tamago): string[]`.

- [ ] **Step 1: Write the failing tests**

Append to `view/__tests__/sidebar.test.tsx`:

```tsx
test("a pending Draw puts a badge after the name; none without one", async () => {
  const waiting = { ...OWNER, sessions: 10_000 };
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <SidebarView name="Tamago" session={session("idle")} tamago={tamago(waiting)} clock={0} footer={FOOTER} heart={false} />
    </ThemeProvider>
  ));
  expect(shown).toContain(`Tamago ${CHOICE_BADGE}`);
  expect(shown).toMatchSnapshot();
});
```

Append to `view/__tests__/card.test.tsx`:

```tsx
test("the card lists the Traits held, with their marks", async () => {
  const kept = { ...OWNER, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } };
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <CardView name="Tamago" tamago={tamago(kept)} clock={0} heart={false} now={OWNER.hatchedAt} />
    </ThemeProvider>
  ));
  expect(shown).toContain("hardy");
  expect(shown).toMatchSnapshot();
});
```

Append to `view/__tests__/sprite.test.tsx`:

```tsx
test("a held Trait marks the sprite's top-left cell", async () => {
  const kept = { ...OWNER, picks: { "evolution:hatchling": { trait: "proud", at: 1 } } };
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <Sprite tamago={tamago(kept)} activity="idle" clock={0} heart={false} color={TUI_THEME.accent} />
    </ThemeProvider>
  ));
  expect(shown).toContain(MARK.proud);
  expect(shown).toMatchSnapshot();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test view`
Expected: FAIL on the missing badge, line and mark.

- [ ] **Step 3: Write the text**

Create `core/text/traits.ts`:

```ts
import type { TraitId } from "../career/pick.ts";

/** The badge after the Name while a Draw awaits a Pick. One column. */
export const CHOICE_BADGE = "★";

/** The title of the Draw dialog and what to do there. */
export const CHOOSE = { title: "Keep one" };

/** Nothing awaits, said as a toast when the command is run with an empty queue. */
export const NOTHING_TO_CHOOSE = "No choice waits right now.";
/** Another window picked first. */
export const CHOSEN_ELSEWHERE = "That choice was made in another window.";

/** What each Trait is called and what it changes, shown in the Draw dialog and on the card. */
export const TRAIT_TEXT: Record<TraitId, { title: string; description: string }> = {
  hardy: { title: "Hardy", description: "Shrugs off failing streaks and retries" },
  unshaken: { title: "Unshaken", description: "Takes a refusal and a long haul in stride" },
  proud: { title: "Proud", description: "Makes much of finished lists and big diffs" },
  boastful: { title: "Boastful", description: "Crows over evolutions and granted permissions" },
  watchful: { title: "Watchful", description: "Notices branches changing and worktrees appearing" },
  restless: { title: "Restless", description: "Feels files stirring outside the session" },
};
```

In `core/text/card.ts`, add:

```ts
/** One line per held Trait: its mark and its title. Empty when none is held, so the card shows nothing. */
export function traitLines(tamago: Tamago): string[] {
  return tamago.traits.map((id) => `${MARK[id] ?? " "} ${TRAIT_TEXT[id]?.title ?? id}`);
}
```

with the imports from `../appearance/marks.ts` and `./traits.ts`.

- [ ] **Step 4: Draw them**

In `view/sprite.tsx`, read the mark from the Tamago and pass it to both frame calls:

```tsx
  const lines = createMemo((): Frame => {
    const t = props.tamago;
    const mark = markOf(t.traits);
    return props.heart
      ? heartFrame(t.species.id, t.stage, t.temperament, mark)
      : frameAt(t.species.id, t.stage, props.activity, frameIndex(props.activity, props.clock, t.behavior), mark);
  });
```

In `view/sidebar.tsx` and `view/home.tsx`, put the badge after the Name:

```tsx
        <text fg={theme.current.text}>
          <b>{props.name}</b>
          <Show when={props.tamago.choices.length > 0}>
            <span style={{ fg: theme.current.warning }}> {CHOICE_BADGE}</span>
          </Show>
        </text>
```

In `view/card.tsx`, under the Character line:

```tsx
      <box flexDirection="column">
        <Index each={traitLines(props.tamago)}>{(line) => <text fg={theme.current.textMuted}>{line()}</text>}</Index>
      </box>
```

- [ ] **Step 5: Run the view tests and read every snapshot diff**

Run: `bun test view` then `./node_modules/.bin/tsc --noEmit`
Expected: the three new snapshots are written, and the existing ones stay byte-identical, since their fixtures hold no Pick and no pending Draw. If one moves, read the diff before accepting it.

- [ ] **Step 6: Commit**

```bash
git add core/text view
git commit -m "feat(opencode): show the choice badge, the Trait mark and the Traits held"
```

---

### Task 10: Choosing from the palette

**Files:**
- Modify: `core/text/commands.ts` (the `choose` command and its count)
- Modify: `shell/actions.ts` (`choose`), `shell/dialogs.tsx` (`askChoice`), `shell/palette.ts`, `index.tsx` (re-register on `chosen` and on `evolved`)
- Test: `shell/__tests__/actions.test.ts`, `shell/__tests__/dialogs.test.tsx`, `core/text/__tests__/commands.test.ts`

**Interfaces:**
- Consumes: `pick` from Task 3, `Tamago.choices` from Task 4, `TRAIT_TEXT`/`CHOOSE`/`NOTHING_TO_CHOOSE`/`CHOSEN_ELSEWHERE` from Task 9.
- Produces: the command id `choose`, `Actions.choose(milestone: MilestoneId, trait: TraitId): void`, `Dialogs.askChoice(): void`.

- [ ] **Step 1: Write the failing tests**

Append to `core/text/__tests__/commands.test.ts`:

```ts
test("the choose command says how many choices wait", () => {
  assert.equal(command("choose", "Pixel", 0).description, "Nothing to choose for Pixel yet");
  assert.equal(command("choose", "Pixel", 1).description, "One choice waits for Pixel");
  assert.equal(command("choose", "Pixel", 3).description, "3 choices wait for Pixel");
});
```

`shell/` has no test for actions or dialogs yet, so create the fake and the two
files, in the style of `shell/__tests__/mirror.test.ts`: `bun:test`,
`createRoot`, and a fake api small enough to read whole.

Create `shell/__tests__/fakes.tsx`:

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";

export type Toast = { variant?: string; title?: string; message: string };
type SelectProps = { title: string; options: { title: string; description?: string }[] };

/**
 * The slice of the api these tests touch: toasts, the dialog stack, and a
 * DialogSelect standing in for OpenCode's own. Everything else is left
 * undefined on purpose, so a test that needs more has to say so.
 */
export function fakeApi(): { api: TuiPluginApi; toasts: Toast[]; shown: () => (() => JSX.Element) | undefined } {
  const toasts: Toast[] = [];
  let node: (() => JSX.Element) | undefined;
  const api = {
    ui: {
      toast: (input: Toast) => toasts.push(input),
      dialog: {
        replace: (next: () => JSX.Element) => {
          node = next;
        },
        clear: () => {
          node = undefined;
        },
      },
      DialogSelect: (props: SelectProps) => (
        <box flexDirection="column">
          <text>{props.title}</text>
          {props.options.map((option) => (
            <text>{option.title}</text>
          ))}
        </box>
      ),
    },
  } as unknown as TuiPluginApi;
  return { api, toasts, shown: () => node };
}
```

Create `shell/__tests__/actions.test.ts`:

```ts
import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer } from "../../core/career/career.ts";
import { freshWindow } from "../../core/window.ts";
import { createActions } from "../actions.ts";
import { createMirror } from "../mirror.ts";
import { fakeApi } from "./fakes.tsx";

/** Past every Milestone, so every Draw is pending. */
const grown = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

test("choosing keeps the Trait, shows it at once and leaves it pending for the flush", () => {
  createRoot((dispose) => {
    const { api } = fakeApi();
    const mirror = createMirror(freshWindow(grown), "Tamago", () => {});
    const actions = createActions({ api, store: {} as never, mirror, warnCorrupt: () => {}, guard: (fn) => fn, now: () => 42 });
    const first = mirror.active().choices[0];
    expect(first).toBeDefined();
    const trait = first?.draw[0] ?? "";
    actions.choose(first?.milestone.id ?? "", trait);
    expect(mirror.career().picks[first?.milestone.id ?? ""]).toEqual({ trait, at: 42 });
    expect(mirror.current().pending.picks?.[first?.milestone.id ?? ""]?.trait).toBe(trait);
    dispose();
  });
});
```

Create `shell/__tests__/dialogs.test.tsx`:

```tsx
/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { createRoot } from "solid-js";
import { freshCareer, type Career } from "../../core/career/career.ts";
import { NOTHING_TO_CHOOSE } from "../../core/text/traits.ts";
import { freshWindow } from "../../core/window.ts";
import { frame } from "../../view/__tests__/render.tsx";
import { createActions } from "../actions.ts";
import { createDialogs } from "../dialogs.tsx";
import { createMirror } from "../mirror.ts";
import { fakeApi } from "./fakes.tsx";

const grown: Career = { ...freshCareer(1_700_000_000_000), sessions: 10_000 };

function harness(career: Career = grown) {
  const { api, toasts, shown } = fakeApi();
  const mirror = createMirror(freshWindow(career), "Tamago", () => {});
  const actions = createActions({ api, store: {} as never, mirror, warnCorrupt: () => {}, guard: (fn) => fn, now: () => 42 });
  const dialogs = createDialogs({
    api,
    store: {} as never,
    mirror,
    actions,
    clock: () => 0,
    started: 0,
    defaultName: "Tamago",
    warnCorrupt: () => {},
    guard: (fn) => fn,
  });
  return { dialogs, toasts, shown, mirror };
}

test("the Draw dialog offers the Traits of the first pending Milestone", async () => {
  const { dialogs, shown } = harness();
  createRoot(() => dialogs.askChoice());
  const node = shown();
  expect(node).toBeDefined();
  const drawn = await frame(node ?? (() => null));
  expect(drawn).toContain("Keep one");
  expect(drawn).toContain("Hardy");
});

test("with nothing pending the command toasts instead of opening a dialog", () => {
  const { dialogs, toasts, shown } = harness(freshCareer(1_700_000_000_000));
  createRoot(() => dialogs.askChoice());
  expect(shown()).toBeUndefined();
  expect(toasts.at(-1)?.message).toBe(NOTHING_TO_CHOOSE);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun test shell` then `node --test "core/**/__tests__/*.test.ts"`
Expected: FAIL, `choose` and `askChoice` do not exist.

- [ ] **Step 3: Add the command text**

In `core/text/commands.ts`, extend the union and both tables, and give `description` the count:

```ts
export type CommandId = "mute" | "card" | "pet" | "rename" | "hatch" | "roster" | "choose";
export const COMMAND_IDS: readonly CommandId[] = ["mute", "card", "pet", "rename", "hatch", "roster", "choose"];
```

```ts
  choose: "choose a trait",
```

```ts
    case "choose":
      if (choices === 0) return `Nothing to choose for ${who} yet`;
      return choices === 1 ? `One choice waits for ${who}` : `${choices} choices wait for ${who}`;
```

`description` and `command` take a third parameter `choices: number` with a default of `0`, so the six other commands keep their call sites.

- [ ] **Step 4: Add the action**

In `shell/actions.ts`, add to the type and the returned object:

```ts
  choose(milestone: MilestoneId, trait: TraitId): void;
```

```ts
  /** A Pick is a Delta, like a rename: shown at once, flushed with the counters, the earliest Pick wins across windows. */
  const choose = (milestone: MilestoneId, trait: TraitId) => mirror.run(pickWindow(mirror.current(), milestone, trait, now()));
```

importing `pick as pickWindow` from `../core/window.ts`.

- [ ] **Step 5: Add the dialog**

In `shell/dialogs.tsx`, add `askChoice(): void` to the `Dialogs` type and:

```tsx
  /** The Draw of the first pending Milestone. It closes itself when another window picks first, and a Pick of ours is never mistaken for theirs. */
  const askChoice = () => {
    const first = mirror.active().choices[0];
    if (first === undefined) {
      api.ui.toast({ variant: "info", title: mirror.name(), message: NOTHING_TO_CHOOSE });
      return;
    }
    const milestone = first.milestone.id;
    let ours = false;
    api.ui.dialog.replace(() => {
      const offered = createMemo(() => mirror.active().choices.find((one) => one.milestone.id === milestone));
      createEffect(() => {
        if (offered() !== undefined || ours) return;
        api.ui.dialog.clear();
        api.ui.toast({ variant: "info", title: mirror.name(), message: CHOSEN_ELSEWHERE });
      });
      return (
        <api.ui.DialogSelect
          title={CHOOSE.title}
          skipFilter
          options={(offered()?.draw ?? []).map((trait) => ({
            title: TRAIT_TEXT[trait]?.title ?? trait,
            value: trait,
            description: TRAIT_TEXT[trait]?.description ?? "",
          }))}
          onSelect={guard((option: { value: string }) => {
            ours = true;
            api.ui.dialog.clear();
            actions.choose(milestone, option.value);
          })}
        />
      );
    });
  };
```

The option value type is inferred from `options`, so no type argument is passed in JSX.

- [ ] **Step 6: Wire the palette and the effect**

In `shell/palette.ts`, add `choose: dialogs.askChoice` to `RUN`, and pass the count when registering:

```ts
        commands: COMMAND_IDS.map((id) => ({
          ...command(id, who, mirror.active().choices.length),
```

In `index.tsx`, re-register whenever the queue can have moved:

```ts
      if (effect.type === "renamed" || effect.type === "chosen") palette?.register();
```

and add `palette?.register();` to the two Evolution branches, before their toast, since an Evolution is what makes a Draw appear.

- [ ] **Step 7: Run everything**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"`, `bun test view shell`, `./node_modules/.bin/tsc --noEmit`, then `./scripts/doctor.sh --quick` from the repository root.
Expected: PASS. Name every moved snapshot in the commit body.

- [ ] **Step 8: Commit**

```bash
git add core/text shell index.tsx
git commit -m "feat(opencode): choose a Trait from the palette"
```

---

### Task 11: Close the documentation

**Files:**
- Modify: `CONTEXT.md` (the Relationships section), `IDEAS.md` (idea 11 and the recommended order), `README.md` (the palette commands)

- [ ] **Step 1: Update `CONTEXT.md`**

Add to Relationships: a Career has at most one Pick per Milestone; a Pick grants a Trait; a Trait takes Cues or opens them, and marks the Sprite. The glossary entries for Milestone, Draw, Pick and Trait already exist and need no change.

- [ ] **Step 2: Update `IDEAS.md`**

Mark idea 11 done for this batch, dated, pointing at the spec. Move the remaining items to "Reste à faire": counter Milestones, event Milestones with their `reached` map, and more Traits. Tick item 6 of the recommended order.

- [ ] **Step 3: Update `README.md`**

Document the seventh palette command and what a Trait does, beside the six others.

- [ ] **Step 4: Verify and commit**

Run: `./scripts/doctor.sh --quick` from the repository root, which checks that README links resolve.

```bash
git add CONTEXT.md IDEAS.md README.md
git commit -m "docs(opencode): record the tamago choices loop"
```
