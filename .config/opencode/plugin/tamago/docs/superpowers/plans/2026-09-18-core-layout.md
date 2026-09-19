# Core Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flat `core/` of opencode-tamago (33 modules + 33 tests in one directory) into a layout that follows the sections of `CONTEXT.md`, and give the shell and the views one deep read model, the Tamago, instead of eight derivations.

**Architecture:** Functional core, imperative shell, unchanged. Four steps, each shippable alone: (1) delete the `MEDIAN` compatibility shims and the `Temperament` re-export so the import graph reads as layers; (2) split `core/state.ts` (the word the glossary avoids) into `career.ts`, `session.ts` and `hydrate.ts`, folding `merge.ts` into `career.ts`; (3) move every module into a folder named after its glossary section, tests in a `__tests__/` per folder, `window.ts` staying at the root as the composer; (4) add `core/tamago.ts`, one function deriving everything a view reads from a Career, and make the shell and the views consume it.

**Tech Stack:** TypeScript under Node 24 native type stripping (no build; `.ts` extensions on every relative import; `import type` for type-only imports; no `enum`, no parameter properties), `node:test`, Solid JSX via `@opentui/solid`.

**Spec:** the architecture review of 2026-09-18 in this conversation; candidates 4, 2, 1 and 3, decisions: fold `merge.ts` and keep `name.ts`/`pick.ts` as siblings; `window.ts` at the root of `core/`; folders `creature, career, moment, speech, choices, roster, appearance` plus `store` for the two disk decisions; a `__tests__/` per folder.

## Global Constraints

- Work in `.config/opencode/plugin/tamago/`. Every command below runs from there unless it says otherwise.
- Never run a package manager in `.config/opencode` itself (it breaks the LSPs). `pnpm install --ignore-workspace` inside `plugin/tamago/` is fine if `node_modules` is missing.
- Verify with both, after every task: `node --test <globs>` (the globs change in Task 3) and `./node_modules/.bin/tsc --noEmit`. Then `./scripts/doctor.sh --quick` from the repository root.
- Behavior must not change: no Career on disk changes shape, no seed formula changes, no tuning table changes. `hydrate` must read yesterday's `career.json` exactly as before.
- Every relative import keeps its explicit `.ts`/`.tsx` extension. Type-only imports use `import type` or inline `type`.
- Vocabulary from `CONTEXT.md` everywhere: Career, Delta, Session, Activity, Sheet, Behavior, Tamago. Never "state".
- Commit messages in Angular format, scope `opencode`, lowercase, imperative, e.g. `refactor(opencode): split the tamago state module`. **Ask the user before every commit** (repository rule).
- The user reviews every diff before it is applied (repository rule): show the change, wait for a go.

---

### Task 1: Drop the `MEDIAN` shims and the `Temperament` re-export

The eight constants `HURT_MS, SLEEP_MS, FAST_MS, SLOW_MS, BUBBLE_MS, QUIET_MS, LONG_WORK_MS, STREAK_COUNT` re-export fields of `MEDIAN` under their pre-Sheet names. Only tests read them. `HURT_MS`/`SLEEP_MS` force `events.ts` to import `behavior.ts`, upside down. `character.ts` re-exports `Temperament` and `TEMPERAMENTS` from `sheet.ts` for convenience.

**Files:**
- Modify: `core/events.ts:1,44-47`
- Modify: `core/cadence.ts:1,4-7`
- Modify: `core/voice.ts:44-47,50-51,56`
- Modify: `core/character.ts:387-389`
- Modify: `core/behavior.ts:330-336` (comment only)
- Modify: `core/sprites.ts:2`, `view/sidebar.tsx:9`, `view/home.tsx:8`
- Modify tests: `core/behavior.test.ts`, `core/cadence.test.ts`, `core/transition.test.ts`, `core/voice.test.ts`, `core/window.test.ts`, `core/sprites.test.ts`, `core/character.test.ts`
- Modify: `AGENTS.md` (the rule sentence about "the old constants re-export its fields")

**Interfaces:**
- Consumes: `MEDIAN: Behavior` from `core/behavior.ts` (unchanged).
- Produces: `events.ts` exports only types (`TamagoEvent`, `Target`, `Addressed`). `cadence.ts` exports `FramePace`, `CADENCE`, `frameIndex`, `tickInterval`. `voice.ts` keeps `REPLY_MS`, `BIG_DIFF_FILES`, `STREAK_MS` (real constants, not shims). `Temperament`/`TEMPERAMENTS` are imported from `core/sheet.ts` everywhere.

- [ ] **Step 1: Make the tests independent of the shims**

`core/behavior.test.ts`: delete lines 4, 5 and 8 (the three shim imports) and delete the whole test `"the old constants are MEDIAN's fields"` (lines 18-27).

`core/cadence.test.ts`: replace line 4 with

```ts
import { CADENCE, frameIndex, tickInterval } from "./cadence.ts";
```

and add, right after the imports (after line 5):

```ts
const FAST_MS = MEDIAN.fastMs;
const SLOW_MS = MEDIAN.slowMs;
```

`core/transition.test.ts`: replace line 3 with

```ts
import type { TamagoEvent } from "./events.ts";
```

and add after line 6 (the `MEDIAN` import):

```ts
const HURT_MS = MEDIAN.hurtMs;
const SLEEP_MS = MEDIAN.sleepMs;
```

`core/voice.test.ts`: in the multi-line import from `./voice.ts` (lines 10-22+), remove the lines `BUBBLE_MS,`, `LONG_WORK_MS,`, `QUIET_MS,`. Add after the imports:

```ts
const BUBBLE_MS = MEDIAN.bubbleMs;
const QUIET_MS = MEDIAN.quietMs;
const LONG_WORK_MS = MEDIAN.longWorkMs;
```

`core/window.test.ts`: replace lines 3, 5 and 9 with

```ts
import { MEDIAN, behavior } from "./behavior.ts";
import { phrase } from "./voice.ts";
```

(line 5 disappears) and add after the imports:

```ts
const HURT_MS = MEDIAN.hurtMs;
const SLEEP_MS = MEDIAN.sleepMs;
const BUBBLE_MS = MEDIAN.bubbleMs;
```

`core/sprites.test.ts`: replace line 3 with `import { TEMPERAMENTS } from "./sheet.ts";`.

`core/character.test.ts`: replace line 3 with

```ts
import { CRAFTS, STANCE, character, craft, describe, stance, temperament, vocation } from "./character.ts";
```

and line 5 with `import { TEMPERAMENTS, historical } from "./sheet.ts";`.

- [ ] **Step 2: Run the tests; they must still pass (the shims still exist)**

Run: `node --test "core/*.test.ts" "adapter/*.test.ts"`
Expected: all pass.

- [ ] **Step 3: Delete the shims and the re-export**

`core/events.ts`: delete line 1 (`import { MEDIAN } from "./behavior.ts";`) and lines 44-47 (the `HURT_MS` and `SLEEP_MS` exports with their doc comments). The file now imports only types.

`core/cadence.ts`: delete lines 4-7 (`FAST_MS`, `SLOW_MS` and their comments). Keep `import { MEDIAN, type Behavior } from "./behavior.ts";` (defaults use it).

`core/voice.ts`: delete the exports `BUBBLE_MS` (44-45), `QUIET_MS` (46-47), `LONG_WORK_MS` (50-51), `STREAK_COUNT` (56) with their comments. Keep `REPLY_MS`, `BIG_DIFF_FILES`, `STREAK_MS`.

`core/character.ts`: delete lines 387-389 (the comment, `export type { Temperament } from "./sheet.ts";`, `export { TEMPERAMENTS } from "./sheet.ts";`). Line 382 keeps importing `type Temperament` from `./sheet.ts` for its own use.

`core/behavior.ts`: in the `MEDIAN` comment (lines 330-336), replace the sentence starting "The default of every function that takes a Behavior; events.ts, cadence.ts and voice.ts re-export its fields under their old names, so this module imports none of them and no import cycle exists." with "The default of every function that takes a Behavior."

`core/sprites.ts:2`, `view/sidebar.tsx:9`, `view/home.tsx:8`: change the import source from `character.ts` to `sheet.ts`:

```ts
import type { Temperament } from "./sheet.ts";        // sprites.ts
import type { Temperament } from "../core/sheet.ts";  // sidebar.tsx, home.tsx
```

`AGENTS.md`: in the rule "Timings and counts that a Stat sets are read from a `Behavior`…", remove ", the old constants re-export its fields".

- [ ] **Step 4: Verify**

Run: `node --test "core/*.test.ts" "adapter/*.test.ts" && ./node_modules/.bin/tsc --noEmit`
Expected: all pass, no type errors. Then `grep -rn "HURT_MS\|SLEEP_MS\|FAST_MS\|SLOW_MS\|BUBBLE_MS\|QUIET_MS\|LONG_WORK_MS\|STREAK_COUNT" core view index.tsx --include='*.ts' --include='*.tsx' | grep -v test` prints nothing.

- [ ] **Step 5: Commit (after the user's go)**

```bash
git add core/ view/ AGENTS.md
git commit -m "refactor(opencode): drop the tamago MEDIAN shims and the Temperament re-export"
```

---

### Task 2: Split `core/state.ts` into `career.ts`, `session.ts` and `hydrate.ts`

`state.ts` holds the Career (a lifetime), the Session (a moment) and the reading of a stored Career. `merge.ts` is nine lines that only make sense next to `addDelta`. `isRecord` is duplicated in `state.ts` and `pick.ts`.

**Files:**
- Create: `core/career.ts`, `core/session.ts`, `core/hydrate.ts`
- Create: `core/career.test.ts`, `core/session.test.ts`, `core/hydrate.test.ts`
- Delete: `core/state.ts`, `core/merge.ts`, `core/state.test.ts`, `core/merge.test.ts`
- Modify: `core/pick.ts` (remove `isRecord`, `pick`, `hydratePicks`), `core/pick.test.ts`
- Modify: every importer of `state.ts`/`merge.ts` (table in Step 4)

**Interfaces:**
- Produces `core/career.ts`: `type ToolKind`, `TOOL_KINDS`, `type Counters`, `COUNTER_KEYS`, `type Career`, `CAREER_KEYS`, `type Delta`, `EMPTY_DELTA`, `freshCareer(now, weights?)`, `isEmpty(delta)`, `addDelta(a, b)`, `merge(career, delta)`, `sameCareer(a, b)`.
- Produces `core/session.ts`: `type Activity`, `ACTIVITIES`, `type Session`, `initialSession(now)`.
- Produces `core/hydrate.ts`: `hydrate(raw, now): { career: Career; corrupt: boolean }`, `hydratePicks(raw): Picks`, `isRecord(value)`.
- `core/pick.ts` keeps `MilestoneId`, `TraitId`, `Pick`, `Picks`, `first`, `firstPicks`, `samePicks`.

- [ ] **Step 1: Create `core/session.ts`**

```ts
export type Activity = "idle" | "thinking" | "working" | "waiting" | "hurt" | "sleeping";

/** The Tamago's momentary condition for one OpenCode session. Forgotten when the window closes. */
export type Session = {
  activity: Activity;
  since: number;
  /** Whether the OpenCode session is busy, per its own status. */
  busy: boolean;
};

export const ACTIVITIES: readonly Activity[] = ["idle", "thinking", "working", "waiting", "hurt", "sleeping"];

export function initialSession(now: number): Session {
  return { activity: "idle", since: now, busy: false };
}
```

- [ ] **Step 2: Create `core/career.ts`**

Everything of `state.ts` that is about the Career, plus `merge` from `merge.ts`; nothing about hydration.

```ts
import { weightsAt } from "./luck.ts";
import { latest, type Rename } from "./name.ts";
import { firstPicks, samePicks, type Picks } from "./pick.ts";
import { SPECIES, hatch, type Rarity, type SpeciesId } from "./species.ts";

export type ToolKind = "read" | "edit" | "bash" | "other";

export type Counters = {
  sessions: number;
  prompts: number;
  tools: Record<ToolKind, number>;
  filesEdited: number;
  errors: number;
  questions: number;
};

/** `species` is drawn at hatch and never changes. `name` is absent until the user renames the creature; the plugin option is the default. `picks` is always present, `{}` until the first Pick. */
export type Career = Counters & { hatchedAt: number; species: SpeciesId; name?: Rename; picks: Picks };
/** `rename` and `picks` are Deltas like any other: they wait for the flush; the latest rename wins, the earliest Pick wins. */
export type Delta = Counters & { rename?: Rename; picks?: Picks };

export const TOOL_KINDS: readonly ToolKind[] = ["read", "edit", "bash", "other"];

/** Every plain numeric counter. Adding one to `Counters` without listing it here is a type error, and listing it is all it takes. */
export const COUNTER_KEYS = ["sessions", "prompts", "filesEdited", "errors", "questions"] as const satisfies readonly (keyof Counters)[];
type PlainCounter = (typeof COUNTER_KEYS)[number];
const _everyCounterListed: Exclude<Exclude<keyof Counters, "tools">, PlainCounter> extends never ? true : never = true;

/** Every key a Career may carry on disk. The store keeps any other key verbatim, so a newer build's data survives an older build's flush. */
export const CAREER_KEYS = [...COUNTER_KEYS, "tools", "hatchedAt", "species", "name", "picks"] as const satisfies readonly (keyof Career)[];
const _everyCareerKeyListed: Exclude<keyof Career, (typeof CAREER_KEYS)[number]> extends never ? true : never = true;

export const EMPTY_DELTA: Delta = {
  sessions: 0,
  prompts: 0,
  tools: { read: 0, edit: 0, bash: 0, other: 0 },
  filesEdited: 0,
  errors: 0,
  questions: 0,
};

/** A new egg at `now`: its Species drawn once, at `weights`, those of a first egg unless the store passes the Roster's Luck. */
export function freshCareer(now: number, weights: Record<Rarity, number> = weightsAt(0)): Career {
  return { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, hatchedAt: now, species: hatch(now, SPECIES, weights), picks: {} };
}

export function isEmpty(delta: Delta): boolean {
  return (
    delta.rename === undefined &&
    (delta.picks === undefined || Object.keys(delta.picks).length === 0) &&
    COUNTER_KEYS.every((key) => delta[key] === 0) &&
    TOOL_KINDS.every((kind) => delta.tools[kind] === 0)
  );
}

/** The counters of `a` and `b` added up. */
function addCounters(a: Counters, b: Counters): Counters {
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = a.tools[kind] + b.tools[kind];
  const out: Counters = { ...EMPTY_DELTA, tools };
  for (const key of COUNTER_KEYS) out[key] = a[key] + b[key];
  return out;
}

export function addDelta(a: Delta, b: Delta): Delta {
  const rename = latest(a.rename, b.rename);
  const picks = firstPicks(a.picks ?? {}, b.picks ?? {});
  return {
    ...addCounters(a, b),
    ...(rename === undefined ? {} : { rename }),
    ...(Object.keys(picks).length === 0 ? {} : { picks }),
  };
}

/** Counters add up, hatchedAt and species are kept, the latest rename wins, the earliest Pick per Milestone wins; a Career never carries a pending `rename`. */
export function merge(career: Career, delta: Delta): Career {
  const { rename: _pending, picks = career.picks, ...counters } = addDelta(career, delta);
  const name = latest(career.name, delta.rename);
  return { ...counters, hatchedAt: career.hatchedAt, species: career.species, picks, ...(name === undefined ? {} : { name }) };
}

/** Structural equality, so a re-read of unchanged disk state does not notify anyone. */
export function sameCareer(a: Career, b: Career): boolean {
  return (
    a.hatchedAt === b.hatchedAt &&
    a.species === b.species &&
    a.name?.value === b.name?.value &&
    a.name?.at === b.name?.at &&
    COUNTER_KEYS.every((key) => a[key] === b[key]) &&
    TOOL_KINDS.every((kind) => a.tools[kind] === b.tools[kind]) &&
    samePicks(a.picks, b.picks)
  );
}
```

- [ ] **Step 3: Create `core/hydrate.ts` and slim `core/pick.ts`**

`core/hydrate.ts`: reading a stored Career, with the Rename and the Picks readers that used to live in `state.ts` and `pick.ts`.

```ts
import { COUNTER_KEYS, EMPTY_DELTA, TOOL_KINDS, freshCareer, type Career } from "./career.ts";
import type { Rename } from "./name.ts";
import type { Pick, Picks } from "./pick.ts";
import { REFERENCE } from "./species.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A stored name, only when both parts are well-formed. */
function rename(value: unknown): Rename | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.value !== "string" || value.value.length === 0) return undefined;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  return { value: value.value, at: value.at };
}

/** A stored Pick, only when both parts are well-formed. */
function pick(value: unknown): Pick | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.trait !== "string" || value.trait.length === 0) return undefined;
  if (typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  return { trait: value.trait, at: value.at };
}

/** The well-formed entries of a stored `picks`; anything else is dropped silently, never a corruption. */
export function hydratePicks(raw: unknown): Picks {
  if (!isRecord(raw)) return {};
  const out: Picks = {};
  for (const [milestone, value] of Object.entries(raw)) {
    if (milestone.length === 0 || milestone === "__proto__") continue;
    const kept = pick(value);
    if (kept !== undefined) out[milestone] = kept;
  }
  return out;
}

/** A Career read from disk: missing fields take their defaults, an unknown Species is kept verbatim, a non-object is corrupt and gives a fresh egg. */
export function hydrate(raw: unknown, now: number): { career: Career; corrupt: boolean } {
  if (!isRecord(raw)) return { career: freshCareer(now), corrupt: true };
  const rawTools = isRecord(raw.tools) ? raw.tools : {};
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = num(rawTools[kind], 0);
  const name = rename(raw.name);
  const species = typeof raw.species === "string" && raw.species.length > 0 ? raw.species : REFERENCE;
  const career: Career = {
    ...EMPTY_DELTA,
    tools,
    hatchedAt: num(raw.hatchedAt, now),
    species,
    picks: hydratePicks(raw.picks),
    ...(name === undefined ? {} : { name }),
  };
  for (const key of COUNTER_KEYS) career[key] = num(raw[key], 0);
  return { corrupt: false, career };
}
```

`core/pick.ts`: delete `isRecord`, `pick` and `hydratePicks` (lines 564-586). The file ends after `samePicks`.

- [ ] **Step 4: Rewrite every import of `state.ts` and `merge.ts`**

Delete `core/state.ts` and `core/merge.ts` (`git rm`). Then replace the import lines exactly as follows (line numbers are those of today's files):

| File | Old line | New line(s) |
| --- | --- | --- |
| `core/count.ts:2` | `import { EMPTY_DELTA, type Delta } from "./state.ts";` | `import { EMPTY_DELTA, type Delta } from "./career.ts";` |
| `core/roster.ts:4` | `import type { Career } from "./state.ts";` | `import type { Career } from "./career.ts";` |
| `core/draw.ts:3` | same | `import type { Career } from "./career.ts";` |
| `core/milestone.ts:3` | `import { TOOL_KINDS } from "./state.ts";` | `import { TOOL_KINDS } from "./career.ts";` |
| `core/sprites.ts:5` | `import type { Activity } from "./state.ts";` | `import type { Activity } from "./session.ts";` |
| `core/stage.ts:2` | `import { TOOL_KINDS, type Counters, type ToolKind } from "./state.ts";` | `import { TOOL_KINDS, type Counters, type ToolKind } from "./career.ts";` |
| `core/character.ts:4` | `import type { Career, Counters } from "./state.ts";` | `import type { Career, Counters } from "./career.ts";` |
| `core/cadence.ts:2` | `import type { Activity } from "./state.ts";` | `import type { Activity } from "./session.ts";` |
| `core/sheet.ts:3` | `import type { Career } from "./state.ts";` | `import type { Career } from "./career.ts";` |
| `core/voice.ts:6` | `import type { Session } from "./state.ts";` | `import type { Session } from "./session.ts";` |
| `core/card.ts:5` | `import type { Career } from "./state.ts";` | `import type { Career } from "./career.ts";` |
| `core/trait.ts:2` | same | `import type { Career } from "./career.ts";` |
| `core/window.ts:4` | `import { merge } from "./merge.ts";` | (delete) |
| `core/window.ts:8` | `import { EMPTY_DELTA, addDelta, initialSession, isEmpty, sameCareer, type Career, type Delta, type Session } from "./state.ts";` | `import { EMPTY_DELTA, addDelta, isEmpty, merge, sameCareer, type Career, type Delta } from "./career.ts";` and `import { initialSession, type Session } from "./session.ts";` |
| `core/transition.ts:3` | `import type { Activity, Session } from "./state.ts";` | `import type { Activity, Session } from "./session.ts";` |
| `core/behavior.ts:3` | `import type { Career } from "./state.ts";` | `import type { Career } from "./career.ts";` |
| `core/events.ts:2` | `import type { ToolKind } from "./state.ts";` | `import type { ToolKind } from "./career.ts";` |
| `adapter/translate.ts:3` | `import type { ToolKind } from "../core/state.ts";` | `import type { ToolKind } from "../core/career.ts";` |
| `adapter/store.ts:6` | `import { merge } from "../core/merge.ts";` | (delete) |
| `adapter/store.ts:8` | `import { CAREER_KEYS, freshCareer, hydrate, type Career, type Delta } from "../core/state.ts";` | `import { CAREER_KEYS, freshCareer, merge, type Career, type Delta } from "../core/career.ts";` and `import { hydrate } from "../core/hydrate.ts";` |
| `view/card.tsx:12` | `import type { Career } from "../core/state.ts";` | `import type { Career } from "../core/career.ts";` |
| `view/roster.tsx:7` | same | `import type { Career } from "../core/career.ts";` |
| `view/home.tsx:12` | same | `import type { Career } from "../core/career.ts";` |
| `view/sidebar.tsx:14` | `import type { Activity, Career, Session } from "../core/state.ts";` | `import type { Career } from "../core/career.ts";` and `import type { Activity, Session } from "../core/session.ts";` |
| `index.tsx:18` | `import { freshCareer, initialSession, isEmpty, sameCareer, type Career, type Session } from "./core/state.ts";` | `import { freshCareer, isEmpty, sameCareer, type Career } from "./core/career.ts";` and `import { initialSession, type Session } from "./core/session.ts";` |

Tests:

| File | Old line | New line(s) |
| --- | --- | --- |
| `core/cadence.test.ts:3` | `import { ACTIVITIES } from "./state.ts";` | `import { ACTIVITIES } from "./session.ts";` |
| `core/sprites.test.ts:7` | same | `import { ACTIVITIES } from "./session.ts";` |
| `core/draw.test.ts:6` | `import { freshCareer, type Career } from "./state.ts";` | `import { freshCareer, type Career } from "./career.ts";` |
| `core/milestone.test.ts:5` | `import { EMPTY_DELTA, type Counters } from "./state.ts";` | `import { EMPTY_DELTA, type Counters } from "./career.ts";` |
| `core/transition.test.ts:5` | `import { initialSession, type Session } from "./state.ts";` | `import { initialSession, type Session } from "./session.ts";` |
| `core/voice.test.ts:8` | same | `import { initialSession, type Session } from "./session.ts";` |
| `core/character.test.ts:4` | `import { EMPTY_DELTA, freshCareer, type Career, type Counters } from "./state.ts";` | `… from "./career.ts";` |
| `core/roster.test.ts:4`, `core/card.test.ts:5`, `core/trait.test.ts:3` | `import { freshCareer, type Career } from "./state.ts";` | `… from "./career.ts";` |
| `core/sheet.test.ts:19` | `import { freshCareer } from "./state.ts";` | `import { freshCareer } from "./career.ts";` |
| `core/count.test.ts:4` | `import { EMPTY_DELTA, isEmpty } from "./state.ts";` | `… from "./career.ts";` |
| `core/window.test.ts:8` | `import { EMPTY_DELTA, freshCareer, isEmpty, type Career } from "./state.ts";` | `… from "./career.ts";` |
| `core/stage.test.ts:4` | `import { EMPTY_DELTA, freshCareer, type Counters } from "./state.ts";` | `… from "./career.ts";` |
| `adapter/store.test.ts:7` | `import { EMPTY_DELTA, freshCareer, type Delta } from "../core/state.ts";` | `… from "../core/career.ts";` |
| `core/pick.test.ts:3` | `import { first, firstPicks, hydratePicks, samePicks, type Pick, type Picks } from "./pick.ts";` | `import { first, firstPicks, samePicks, type Pick, type Picks } from "./pick.ts";` and move the three `hydratePicks` tests (lines 71-95) to `core/hydrate.test.ts` (Step 5) |

Mechanical alternative for the tables: `git rm core/state.ts core/merge.ts` then `sed -i '' 's#/state\.ts"#/career.ts"#; s#/merge\.ts"#/career.ts"#' <files>` fixes the source path, and the remaining edits are the symbol splits listed above (Session/Activity/initialSession/ACTIVITIES go to `session.ts`, `hydrate` to `hydrate.ts`, `merge` joins the `career.ts` import). `tsc --noEmit` reports every one you miss.

- [ ] **Step 5: Split the tests**

`core/session.test.ts`: the one test on `initialSession` from `state.test.ts` (lines 6-8), importing `{ initialSession } from "./session.ts"`.

`core/hydrate.test.ts`: every `hydrate` test of `state.test.ts` (`"hydrate fills missing fields…"`, `"hydrate keeps hatchedAt…"`, `"hydrate rejects non-object…"`, `"hydrate ignores non-finite…"`, `"hydrate reads a well-formed name…"`, `"hydrate reads well-formed picks…"`, `"hydrate reads a species string…"`) plus the three `hydratePicks` tests of `pick.test.ts`. Header:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshCareer } from "./career.ts";
import { hydrate, hydratePicks } from "./hydrate.ts";
import { REFERENCE } from "./species.ts";
```

Keep the `freshCareer` import only if a moved test body uses it (`"hydrate rejects non-object input as corrupt with a fresh career"` compares against one); drop it otherwise.

`core/career.test.ts`: the rest of `state.test.ts` (freshCareer, isEmpty, addDelta, sameCareer, CAREER_KEYS, questions, picks, species) plus every test of `merge.test.ts`. Header:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAREER_KEYS, EMPTY_DELTA, addDelta, freshCareer, isEmpty, merge, sameCareer, type Delta } from "./career.ts";
import { REFERENCE, hatch } from "./species.ts";
```

Then `git rm core/state.test.ts core/merge.test.ts`.

- [ ] **Step 6: Verify**

Run: `node --test "core/*.test.ts" "adapter/*.test.ts" && ./node_modules/.bin/tsc --noEmit`
Expected: same number of tests as before minus one (the shim test deleted in Task 1), all pass. `grep -rn "state.ts\|merge.ts" --include='*.ts' --include='*.tsx' . | grep -v node_modules` prints nothing. `grep -c "function isRecord" core/*.ts` prints `1` for `hydrate.ts` only.

- [ ] **Step 7: Commit (after the user's go)**

```bash
git add -A core/ adapter/ view/ index.tsx
git commit -m "refactor(opencode): split the tamago state module into career, session and hydrate"
```

---

### Task 3: Rank `core/` by glossary section, tests in `__tests__/`

**Files:**
- Move: every file of `core/` except `window.ts`, per the map below.
- Move: every `*.test.ts` into the `__tests__/` of its module's folder; `adapter/*.test.ts` into `adapter/__tests__/`.
- Modify: every relative import (scripted).
- Modify: `package.json:6`, `AGENTS.md:58`, `README.md:267` and its "Layout" section, `../../../../scripts/doctor.sh:233,236` (repository root `scripts/doctor.sh`), path mentions in `AGENTS.md`, `README.md`, `IDEAS.md`.

**Interfaces:**
- Produces the layout below. No symbol changes.

Target map (old → new):

```
core/window.ts                 core/window.ts            (stays: the composer)
core/species.ts                core/creature/species.ts
core/luck.ts                   core/creature/luck.ts
core/random.ts                 core/creature/random.ts
core/sheet.ts                  core/creature/sheet.ts
core/behavior.ts               core/creature/behavior.ts
core/character.ts              core/creature/character.ts
core/career.ts                 core/career/career.ts
core/hydrate.ts                core/career/hydrate.ts
core/name.ts                   core/career/name.ts
core/pick.ts                   core/career/pick.ts
core/count.ts                  core/career/count.ts
core/stage.ts                  core/career/stage.ts
core/session.ts                core/moment/session.ts
core/events.ts                 core/moment/events.ts
core/transition.ts             core/moment/transition.ts
core/cadence.ts                core/moment/cadence.ts
core/voice.ts                  core/speech/voice.ts
core/signature.ts              core/speech/signature.ts
core/signatures/*.ts           core/speech/signatures/*.ts
core/bubble.ts                 core/speech/bubble.ts
core/milestone.ts              core/choices/milestone.ts
core/draw.ts                   core/choices/draw.ts
core/trait.ts                  core/choices/trait.ts
core/roster.ts                 core/roster/roster.ts
core/sprites.ts                core/appearance/sprites.ts
core/bodies.ts                 core/appearance/bodies.ts
core/bodies/*.ts               core/appearance/bodies/*.ts
core/card.ts                   core/appearance/card.ts
core/format.ts                 core/appearance/format.ts
core/footer.ts                 core/appearance/footer.ts
core/lock.ts                   core/store/lock.ts
core/retry.ts                  core/store/retry.ts
core/<x>.test.ts               core/<folder>/__tests__/<x>.test.ts   (window.test.ts → core/__tests__/window.test.ts)
adapter/<x>.test.ts            adapter/__tests__/<x>.test.ts
```

- [ ] **Step 1: Write the move script in the scratchpad (not committed)**

Save as `$SCRATCH/relayout.mjs` (the scratchpad directory of the session). It does the `git mv` and rewrites every relative import by resolving it against the old location and re-relativizing it against the new one.

```js
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, globSync } from "node:fs";
import { dirname, relative, resolve, join, basename } from "node:path";

const ROOT = process.cwd(); // run from plugin/tamago
const FOLDER = {
  species: "creature", luck: "creature", random: "creature", sheet: "creature", behavior: "creature", character: "creature",
  career: "career", hydrate: "career", name: "career", pick: "career", count: "career", stage: "career",
  session: "moment", events: "moment", transition: "moment", cadence: "moment",
  voice: "speech", signature: "speech", bubble: "speech",
  milestone: "choices", draw: "choices", trait: "choices",
  roster: "roster",
  sprites: "appearance", bodies: "appearance", card: "appearance", format: "appearance", footer: "appearance",
  lock: "store", retry: "store",
};

/** old relative path → new relative path, for every file that moves. */
const MOVES = new Map();
for (const file of globSync("core/*.ts")) {
  const name = basename(file, ".ts");
  if (name === "window") continue;
  if (name.endsWith(".test")) {
    const mod = name.slice(0, -".test".length);
    const folder = mod === "window" ? "core" : `core/${FOLDER[mod]}`;
    MOVES.set(file, `${folder}/__tests__/${basename(file)}`);
  } else {
    MOVES.set(file, `core/${FOLDER[name]}/${basename(file)}`);
  }
}
for (const file of globSync("core/signatures/*.ts")) MOVES.set(file, `core/speech/signatures/${basename(file)}`);
for (const file of globSync("core/bodies/*.ts")) MOVES.set(file, `core/appearance/bodies/${basename(file)}`);
for (const file of globSync("adapter/*.test.ts")) MOVES.set(file, `adapter/__tests__/${basename(file)}`);
for (const [from, to] of MOVES) if (FOLDER[basename(from, ".ts").replace(/\.test$/, "")] === undefined && !from.includes("/signatures/") && !from.includes("/bodies/") && !from.startsWith("adapter/") && !from.endsWith("window.test.ts")) throw new Error(`no folder for ${from}`);

const newPath = (p) => MOVES.get(p) ?? p;
const oldPath = (p) => [...MOVES].find(([, to]) => to === p)?.[0] ?? p;

/** Rewrite the relative imports of `content`, written at `oldFile`, to be correct at `newFile`. */
function rewrite(content, oldFile, newFile) {
  return content.replace(/(from\s+|import\s+)"(\.\.?\/[^"]+)"/g, (whole, lead, spec) => {
    const target = relative(ROOT, resolve(ROOT, dirname(oldFile), spec));
    let next = relative(dirname(newFile), newPath(target));
    if (!next.startsWith(".")) next = `./${next}`;
    return `${lead}"${next}"`;
  });
}

const sources = [...globSync("core/**/*.ts"), ...globSync("adapter/**/*.ts"), ...globSync("view/*.tsx"), "index.tsx"];
const contents = new Map(sources.map((f) => [f, readFileSync(f, "utf8")]));
for (const [from, to] of MOVES) {
  mkdirSync(dirname(to), { recursive: true });
  execSync(`git mv "${from}" "${to}"`, { stdio: "inherit" });
}
for (const [file, content] of contents) {
  const target = newPath(file);
  writeFileSync(target, rewrite(content, file, target));
}
console.log(`moved ${MOVES.size} files, rewrote ${contents.size}`);
```

- [ ] **Step 2: Run it and inspect**

Run, from `plugin/tamago/`: `node "$SCRATCH/relayout.mjs" && git status --short | head -80`
Expected: `moved 77 files, rewrote 87` (30 modules, 34 core tests, 5 signatures, 5 bodies, 3 adapter tests move; every `.ts`/`.tsx` source is rewritten). In `git status --short`, every line starts with `R` (a rename) or `M` (an import rewrite in a file that did not move: `window.ts`, `view/*.tsx`, `index.tsx`, `adapter/*.ts`). `ls core` shows `__tests__ appearance career choices creature moment roster speech store window.ts`.

- [ ] **Step 3: Update the globs and the paths**

`package.json:6`: `"test": "node --test \"core/**/__tests__/*.test.ts\" \"adapter/__tests__/*.test.ts\"",`

`AGENTS.md:58`: `` `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"` and ``

`README.md:267`: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"`

Repository root `scripts/doctor.sh:233` and `:236`: the same two globs, keeping the quoting style of each line.

Paths in the prose of `AGENTS.md`, `README.md`, `IDEAS.md`, `CONTEXT.md` (if any): run from `plugin/tamago/`

```bash
sed -i '' \
  -e 's#core/behavior\.ts#core/creature/behavior.ts#g' \
  -e 's#core/random\.ts#core/creature/random.ts#g' \
  -e 's#core/hydrate\.ts#core/career/hydrate.ts#g' \
  -e 's#core/name\.ts#core/career/name.ts#g' \
  -e 's#core/pick\.ts#core/career/pick.ts#g' \
  -e 's#core/session\.ts#core/moment/session.ts#g' \
  -e 's#core/events\.ts#core/moment/events.ts#g' \
  -e 's#core/cadence\.ts#core/moment/cadence.ts#g' \
  -e 's#core/bubble\.ts#core/speech/bubble.ts#g' \
  -e 's#core/milestone\.ts#core/choices/milestone.ts#g' \
  -e 's#core/draw\.ts#core/choices/draw.ts#g' \
  -e 's#core/trait\.ts#core/choices/trait.ts#g' \
  -e 's#core/bodies\.ts#core/appearance/bodies.ts#g' \
  -e 's#core/card\.ts#core/appearance/card.ts#g' \
  -e 's#core/format\.ts#core/appearance/format.ts#g' \
  -e 's#core/footer\.ts#core/appearance/footer.ts#g' \
  -e 's#core/lock\.ts#core/store/lock.ts#g' \
  -e 's#core/retry\.ts#core/store/retry.ts#g' \
  -e 's#core/species\.ts#core/creature/species.ts#g' \
  -e 's#core/luck\.ts#core/creature/luck.ts#g' \
  -e 's#core/sheet\.ts#core/creature/sheet.ts#g' \
  -e 's#core/character\.ts#core/creature/character.ts#g' \
  -e 's#core/stage\.ts#core/career/stage.ts#g' \
  -e 's#core/state\.ts#core/career/career.ts#g' \
  -e 's#core/merge\.ts#core/career/career.ts#g' \
  -e 's#core/transition\.ts#core/moment/transition.ts#g' \
  -e 's#core/count\.ts#core/career/count.ts#g' \
  -e 's#core/voice\.ts#core/speech/voice.ts#g' \
  -e 's#core/signature\.ts#core/speech/signature.ts#g' \
  -e 's#core/signatures/#core/speech/signatures/#g' \
  -e 's#core/sprites\.ts#core/appearance/sprites.ts#g' \
  -e 's#core/bodies/#core/appearance/bodies/#g' \
  -e 's#core/roster\.ts#core/roster/roster.ts#g' \
  AGENTS.md README.md IDEAS.md CONTEXT.md
```

Then `AGENTS.md` rule "the key → action table lives in `core/` (`ROSTER_KEYS`)" reads "lives in `core/roster/` (`ROSTER_KEYS`)". `AGENTS.md` rule "`stage.ts` tables" reads "`core/career/stage.ts` tables".

`README.md` "Layout" block becomes:

```
index.tsx           the only module that touches api.* and timers; wires the layers
core/window.ts      what one window does with an event, a tick, a flush or a command
core/creature/      what a Tamago is at hatch: Species, Luck, Sheet, Behavior, Character
core/career/        what it has lived: Career, Delta, merge, hydrate, Stage, count
core/moment/        what it is doing now: Session, events, transition, cadence
core/speech/        what it says: Voice, Signatures, Bubble
core/choices/       Milestones, Draws and Traits
core/roster/        every Career of the machine
core/appearance/    Sprites, bodies, card text, formatting
core/store/         the pure decisions of the store: lock, retry
adapter/            the only layer touching SDK event shapes and the disk
view/               Solid components fed with accessors, returning JSX
```

Each folder's tests sit in its `__tests__/`.

- [ ] **Step 4: Verify**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts" && ./node_modules/.bin/tsc --noEmit`
Expected: the same test count as after Task 2, all pass; no type errors. From the repository root: `./scripts/doctor.sh --quick` reports `opencode-tamago tests pass` and `opencode-tamago typechecks`. `grep -rn '"\./[a-z]*\.ts"' core/window.ts` shows only `./<folder>/…` imports. Launch OpenCode once: sidebar sprite, card, roster all render (the plugin loads `index.tsx` at runtime with no build, so a bad path would only show here).

- [ ] **Step 5: Commit (after the user's go)**

```bash
git add -A core/ adapter/ view/ index.tsx package.json AGENTS.md README.md IDEAS.md CONTEXT.md ../../../../scripts/doctor.sh
git commit -m "refactor(opencode): rank the tamago core by glossary section"
```

---

### Task 4: `core/tamago.ts`, the Tamago read from a Career

Eight functions derive a Tamago from its Career (`stage`, `xp`, `growth`, `sheet`, `temperamentOf`, `behavior`, `character`, `speakerOf`, `species`); the shell and each view call them independently and pass the results as separate props (`SidebarView` takes eleven). One function derives them all once; the shell memoizes it per Career and hands one accessor down. `card.ts` reads the Tamago instead of recomputing. `character()` disappears (the Tamago composes the Character); `temperament()` stays for its pinned tests and `describe()` stays.

**Files:**
- Create: `core/tamago.ts`, `core/__tests__/tamago.test.ts`
- Modify: `core/creature/character.ts` (delete `character`), `core/creature/__tests__/character.test.ts` (move one test)
- Modify: `core/appearance/card.ts`, `core/appearance/__tests__/card.test.ts`
- Modify: `view/sidebar.tsx`, `view/home.tsx`, `view/card.tsx`, `view/roster.tsx`, `index.tsx`
- Modify: `CONTEXT.md` (one relationship line), `AGENTS.md` (one rule)

**Interfaces:**
- Produces `core/tamago.ts`:

```ts
export type Tamago = {
  career: Career;
  species: Species;        // the table entry: id, label, rarity, sheet Modifiers
  stage: StageId;
  xp: number;
  growth: number;
  sheet: Sheet;
  temperament: Temperament;
  behavior: Behavior;
  character: Character;
  speaker: Speaker;
};
export function tamago(career: Career, table?: readonly Species[]): Tamago;
```

- `core/appearance/card.ts`: `progress(tamago: Tamago, width?)`, `speciesLine(tamago: Tamago)`, `reveal(name: string, tamago: Tamago)`, `sheetLines(tamago: Tamago)`; `age(hatchedAt, now)` unchanged.
- Views: `SidebarView` props `{ name, theme, session, tamago: () => Tamago, clock, footer, bubble, heart }`; `HomeView` props `{ name, theme, tamago, clock, heart }`; `CardBody`/`CardView` props `{ [name,] theme, tamago, clock, heart, now }`; `RosterView` props `{ theme, tamagos: readonly Tamago[], lines, clock, now, onSelect: (tamago: Tamago) => void }`.

- [ ] **Step 1: Write the failing test `core/__tests__/tamago.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshCareer, type Career } from "../career/career.ts";
import { growth, stage, xp } from "../career/stage.ts";
import { behavior } from "../creature/behavior.ts";
import { describe, temperament } from "../creature/character.ts";
import { sheet, speakerOf, temperamentOf } from "../creature/sheet.ts";
import { species } from "../creature/species.ts";
import { tamago } from "../tamago.ts";

/** The owner's real career on 2026-09-15, plus questions. */
const owner: Career = {
  sessions: 30,
  prompts: 492,
  tools: { read: 2342, edit: 83, bash: 1188, other: 1025 },
  filesEdited: 378,
  errors: 109,
  questions: 0,
  hatchedAt: 1789113932488,
  species: "cat",
  picks: {},
};

test("a Tamago is every derivation of its Career, each equal to the function it comes from", () => {
  const t = tamago(owner);
  assert.equal(t.career, owner, "the Career itself, not a copy");
  assert.deepEqual(t.species, species(owner.species));
  assert.equal(t.stage, stage(owner));
  assert.equal(t.xp, xp(owner));
  assert.equal(t.growth, growth(owner));
  assert.deepEqual(t.sheet, sheet(owner.hatchedAt, owner.species));
  assert.equal(t.temperament, temperamentOf(t.sheet));
  assert.equal(t.temperament, temperament(owner.hatchedAt, owner.species));
  assert.deepEqual(t.behavior, behavior(owner));
  assert.deepEqual(t.speaker, speakerOf(owner));
});

test("character and describe", () => {
  const full = tamago(owner).character;
  assert.equal(full.temperament, temperament(owner.hatchedAt));
  assert.deepEqual(full.vocation, { craft: "shell", stance: "bold" });
  assert.equal(describe(full), `${full.temperament} · bold shell`);
  const egg = tamago({ ...freshCareer(owner.hatchedAt), species: "cat" }).character;
  assert.deepEqual(egg, { temperament: full.temperament }, "no vocation key at all before young");
  assert.equal(describe(egg), full.temperament);
});

test("an unknown Species reads as the reference: no Modifier, common, pace 1", () => {
  const t = tamago({ ...owner, species: "from-a-newer-build" });
  assert.equal(t.species.rarity, "common");
  assert.deepEqual(t.sheet, sheet(owner.hatchedAt, "cat"));
  assert.equal(t.growth, t.xp);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test "core/__tests__/tamago.test.ts"`
Expected: FAIL, `Cannot find module '…/core/tamago.ts'`.

- [ ] **Step 3: Write `core/tamago.ts`**

```ts
import type { Career } from "./career/career.ts";
import { growth, stage, xp, type StageId } from "./career/stage.ts";
import { behaviorOf, type Behavior } from "./creature/behavior.ts";
import { vocation, type Character } from "./creature/character.ts";
import { sheet as sheetOf, temperamentOf, type Sheet, type Speaker, type Temperament } from "./creature/sheet.ts";
import { SPECIES, species as speciesOf, type Species } from "./creature/species.ts";

/**
 * Everything the shell and the views read about a Tamago, derived from its
 * Career in one place: the same in every window, never stored. The shell
 * computes one per Career shown and passes it down; a view never derives.
 * `species` is the table entry, the reference one for an id this build does
 * not know, like everywhere else.
 */
export type Tamago = {
  career: Career;
  species: Species;
  stage: StageId;
  xp: number;
  growth: number;
  sheet: Sheet;
  temperament: Temperament;
  behavior: Behavior;
  character: Character;
  speaker: Speaker;
};

export function tamago(career: Career, table: readonly Species[] = SPECIES): Tamago {
  const sheet = sheetOf(career.hatchedAt, career.species, table);
  const temperament = temperamentOf(sheet);
  const found = vocation(career);
  return {
    career,
    species: speciesOf(career.species, table),
    stage: stage(career),
    xp: xp(career),
    growth: growth(career),
    sheet,
    temperament,
    behavior: behaviorOf(sheet),
    character: { temperament, ...(found === undefined ? {} : { vocation: found }) },
    speaker: { hatchedAt: career.hatchedAt, species: career.species, sheet },
  };
}
```

- [ ] **Step 4: Remove `character()` from `core/creature/character.ts` and its test**

Delete the function `character` (today's lines 451-454) and its import of `type Career` if it becomes unused (`Counters` stays for `craft`/`stance`). In `core/creature/__tests__/character.test.ts`, delete the test `"character and describe"` (today's lines 62-70) and remove `character` from the import on line 3. `describe` stays exported and used by `view/card.tsx`.

- [ ] **Step 5: Run the tests**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts" && ./node_modules/.bin/tsc --noEmit`
Expected: all pass, including the three new ones. `tsc` is clean (nothing else calls `character()` yet: `view/card.tsx` and `index.tsx` do; if `tsc` names them, that is Step 7's work, proceed).

- [ ] **Step 6: Make `core/appearance/card.ts` read the Tamago**

Replace the file body after the constants (keep `DAY_MS`, `BAR_WIDTH`, `STAT_BAR_WIDTH`, `STATS_HIDDEN`, `LABEL_WIDTH`, `age`, `article` unchanged) with:

```ts
import { next } from "../career/stage.ts";
import { BEHAVIOR_STATS, SCALE } from "../creature/sheet.ts";
import type { Tamago } from "../tamago.ts";
import { bar, fmt } from "./format.ts";
// (replace the previous imports of species, stage, xp, sheet, Career with the three lines above)

/** The XP bar towards the next Stage, or a full bar once there is none. */
export function progress(tamago: Tamago, width = BAR_WIDTH): string {
  const coming = next(tamago.career);
  if (coming === undefined) return `${bar(1, width)} ${fmt(tamago.xp)} xp · final form`;
  return `${bar(coming.progress, width)} ${fmt(tamago.xp)} / ${fmt(coming.threshold)} xp → ${coming.stage}`;
}

/** The Species and its Rarity from hatchling on; before that the egg keeps its secret. */
export function speciesLine(tamago: Tamago): string {
  if (tamago.stage === "egg") return "still an egg";
  return `${tamago.species.label} · ${tamago.species.rarity}`;
}

/** The hatch toast: the Species revealed, with its Rarity. */
export function reveal(name: string, tamago: Tamago): string {
  const { label, rarity } = tamago.species;
  return `${name} hatched: ${article(label)} ${label}, ${rarity}!`;
}

/** One line per behavior Stat, in BEHAVIOR_STATS order: label, bar, value after the Modifiers of the Species. At egg the single STATS_HIDDEN line. */
export function sheetLines(tamago: Tamago): string[] {
  if (tamago.stage === "egg") return [STATS_HIDDEN];
  return BEHAVIOR_STATS.map(
    (stat) => `${stat.padEnd(LABEL_WIDTH)} ${bar((tamago.sheet[stat] - SCALE.min) / (SCALE.max - SCALE.min), STAT_BAR_WIDTH)} ${tamago.sheet[stat]}`,
  );
}
```

`core/appearance/__tests__/card.test.ts`: add `import { tamago } from "../../tamago.ts";` and wrap every Career argument: `progress(career, 10)` → `progress(tamago(career), 10)`, `progress({ ...freshCareer(0), species: "cat" }, 4)` → `progress(tamago({ ...freshCareer(0), species: "cat" }), 4)`, same for every `speciesLine(...)`, `reveal(name, ...)`, `sheetLines(...)` call: the argument becomes `tamago(<what it was>)`. Run `node --test "core/appearance/__tests__/card.test.ts"`: all pass, same expectations.

- [ ] **Step 7: Views take one `tamago` accessor**

`view/card.tsx`: imports become

```ts
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { Index, createMemo } from "solid-js";
import { age, progress, sheetLines, speciesLine } from "../core/appearance/card.ts";
import { fmt } from "../core/appearance/format.ts";
import { frameAt, heartFrame } from "../core/appearance/sprites.ts";
import { describe } from "../core/creature/character.ts";
import { frameIndex } from "../core/moment/cadence.ts";
import type { Tamago } from "../core/tamago.ts";
```

`CardBody` props: `{ theme: () => TuiThemeCurrent; tamago: () => Tamago; clock: () => number; heart: () => boolean; now: () => number }`. Body:

```tsx
const lines = createMemo(() => {
  const t = props.tamago();
  return props.heart()
    ? heartFrame(t.species.id, t.stage, t.temperament)
    : frameAt(t.species.id, t.stage, "idle", frameIndex("idle", props.clock(), t.behavior));
});
```

and in the JSX: `speciesLine(props.tamago())`, `{props.tamago().stage} · {fmt(props.tamago().xp)} xp`, `age(props.tamago().career.hatchedAt, props.now())`, `describe(props.tamago().character)`, `sheetLines(props.tamago())`, `progress(props.tamago())`. Delete the `current` and `persona` memos. `CardView` props: same as today with `career` replaced by `tamago: () => Tamago`, forwarded as `tamago={props.tamago}`.

`view/home.tsx`: props `{ name: string; theme: () => TuiThemeCurrent; tamago: () => Tamago; clock: () => number; heart: () => boolean }`. Imports: drop `Behavior`, `Temperament`, `SpeciesId`, `Career`, `stage`; add `import type { Tamago } from "../core/tamago.ts";`. Body:

```tsx
const lines = () => {
  const t = props.tamago();
  return props.heart()
    ? heartFrame(t.species.id, t.stage, t.temperament)
    : frameAt(t.species.id, t.stage, "idle", frameIndex("idle", props.clock(), t.behavior));
};
```

JSX: `· {props.tamago().stage}` and `{progress(props.tamago())}`.

`view/sidebar.tsx`: props `{ name: string; theme: () => TuiThemeCurrent; session: () => Session; tamago: () => Tamago; clock: () => number; footer: () => FooterInfo; bubble: () => Bubble | undefined; heart: () => boolean }`. Imports: drop `Behavior`, `Temperament`, `SpeciesId`, `Career`, `stage`, `xp`; add `import type { Tamago } from "../core/tamago.ts";`. Body: delete the `current` and `total` memos; `lines` becomes

```tsx
const lines = () => {
  const t = props.tamago();
  return props.heart()
    ? heartFrame(t.species.id, t.stage, t.temperament)
    : frameAt(t.species.id, t.stage, activity(), frameIndex(activity(), props.clock(), t.behavior));
};
```

JSX caption line: `{props.tamago().stage} · {fmt(props.tamago().xp)} xp`.

`view/roster.tsx`: props `tamagos: readonly Tamago[]` instead of `careers`, `onSelect: (tamago: Tamago) => void`; `const highlighted = (): Tamago | undefined => props.tamagos[cursor()];`; `step(at, action, props.tamagos.length)`; `<Show when={highlighted()}>{(one) => <CardBody theme={props.theme} tamago={one} clock={props.clock} heart={() => false} now={props.now} />}</Show>`. Import `type Tamago` from `../core/tamago.ts` instead of `type Career`.

- [ ] **Step 8: The shell derives once**

`index.tsx`:

1. Imports: `import { createMemo, createSignal } from "solid-js";`; add `import { tamago, type Tamago } from "./core/tamago.ts";`; remove `import { character } from "./core/creature/character.ts";`. Keep `behavior` (used by `scheduleTick` on the Window, the truth, not on the memo).
2. Replace

```ts
const persona = () => character(career());
const conduct = () => behavior(career());
```

with

```ts
/** The active Tamago, read from the Career once per change: Stage, Sheet, Behavior, Character. Derived, never stored; every window computes the same. */
const active = createMemo(() => tamago(career()));
```

3. In `run`: `reveal(name(), career())` → `reveal(name(), active())`.
4. `showCard`: `<CardView name={name()} theme={() => api.theme.current} tamago={active} clock={clock} heart={heart} now={Date.now} />`.
5. `showRoster`: after `const careers = ordered(roster);` add `const shown = careers.map((one) => tamago(one));` and pass `tamagos={shown}`; `onSelect={guard((chosen: Tamago) => { api.ui.dialog.clear(); if (idOf(chosen.career) !== activeId) switchTo(idOf(chosen.career)); })}`.
6. `sidebar_footer`: props become `name={name()} theme={() => ctx.theme.current} session={sessionOf(props.session_id)} tamago={active} clock={clock} footer={footer(props.session_id)} bubble={() => voices()[props.session_id]?.bubble} heart={heart}`.
7. `home_bottom`: `name={name()} theme={() => ctx.theme.current} tamago={active} clock={clock} heart={heart}`.

- [ ] **Step 9: Record the concept**

`CONTEXT.md`, "Relationships", add after the line "A **Character** is read, never written; two windows always show the same":

```
- The shell reads a **Tamago** from the active **Career** once per change:
  its **Species**, **Stage**, **XP**, **Growth**, **Sheet**, **Temperament**,
  **Behavior**, **Character** and Speaker together; the views receive that
  and derive nothing themselves
```

`AGENTS.md`, "Rules", add after the rule ending "hold none as a constant.":

```
- Views read a `Tamago` (`core/tamago.ts`), never a bare Career: everything
  derived from a Career is derived there, once, and passed down as one
  accessor. A new derived attribute is a new field of `Tamago`.
```

- [ ] **Step 10: Verify**

Run: `node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts" && ./node_modules/.bin/tsc --noEmit`
Expected: all pass, no type errors. `grep -n "character(" core view index.tsx -r --include='*.ts' --include='*.tsx'` prints nothing. Launch OpenCode: sidebar shows sprite, stage and XP; the card shows species, stage, age, character, four bars and the XP bar; the roster highlights and shows the card of a resting Career; petting shows the heart with the Temperament's eyes; `./scripts/doctor.sh --quick` from the repository root is green.

- [ ] **Step 11: Commit (after the user's go)**

```bash
git add -A core/ view/ index.tsx CONTEXT.md AGENTS.md
git commit -m "feat(opencode): read the tamago from its career once for the shell and the views"
```
