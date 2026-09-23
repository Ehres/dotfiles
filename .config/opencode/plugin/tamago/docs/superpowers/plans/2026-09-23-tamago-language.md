# Tamago Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user read the whole plugin — Bubbles, card, roster, palette, toasts, dialogs, moods — in English or in French, chosen from the palette or from `opencode.json`.

**Architecture:** A `Language` lives on the `Window` beside `muted`, resolved once at startup from `api.kv` then the plugin option, mirrored into a signal, and read by the views through a context twin of `ThemeProvider`. Every phrase becomes a `Phrase` — the same saying in both languages, in one object — so the pools cannot drift in length and the seeded draw picks the same index whatever the Language. Interface text becomes functions that take the Language and write each language's grammar in full.

**Tech Stack:** TypeScript under Node's native type stripping (no build step, no runtime dependencies), Solid via `@opentui/solid`, `node:test` for core and adapter, `bun test` with committed snapshots for views and shell.

**Spec:** `docs/superpowers/specs/2026-09-23-tamago-language-design.md`

## Global Constraints

- **Working directory** for every command: `.config/opencode/plugin/tamago`.
- **No runtime dependencies.** `node_modules` holds `typescript` and `@types/node` as devDependencies only; nothing in `core/`, `view/`, `shell/` or `adapter/` may import a package that is not `solid-js`, `@opentui/solid` or `@opencode-ai/*`.
- **Erasable syntax only.** No `enum`, no `namespace`, no constructor parameter properties. `import type` for every type-only import, explicit `.ts` / `.tsx` extension on every relative import.
- **`core/` is total and never throws.** A mistuned table makes the creature silent, never kills the window's event pipeline.
- **`MAX_TEXT` is 24** characters, for every Language. It bounds **spoken phrases only** — what goes in a Bubble, so it never wraps in the sidebar. Interface text (`TRAIT_TEXT` descriptions, command descriptions, toasts) is not bound by it and must not be checked against it.
- **Allowed characters:** English `/^[\x20-\x7e]+$/`; French `/^[\x20-\x7eÀ-ÿŒœ]+$/`. Every phrase must equal its own `normalize("NFC")` form.
- **No cast and no non-null assertion to absorb an indexed read**, in tests as much as in production.
- **Commit messages** are Angular format, lowercase, imperative, no trailing period, scope `opencode`: `feat(opencode): …`.
- **Commits need the user's explicit approval** before being made — propose, then wait.

**Verification, run from the plugin directory:**

```bash
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
bun test view shell
./node_modules/.bin/tsc --noEmit
```

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `core/language.ts` | The `Language` type, `Phrase`, `say()`, and the three-layer resolution. Root of `core/` because `core/text/`, `core/appearance/` and `core/window.ts` all need it and none may import `core/speech/`. |
| `core/text/word.ts` | `Word`, `Agreed`, `word()` — gender agreement, a French-only fact. |
| `core/text/tables.ts` | `STAGE_TEXT`, `RARITY_TEXT`, `STAT_TEXT`, `TEMPERAMENT_TEXT`, `CRAFT_TEXT`, `STANCE_TEXT`, `LANGUAGE_NAME`. |
| `core/text/character.ts` | `describe()`, moved out of `core/creature/character.ts`. |
| `view/language.tsx` | `LanguageProvider` / `useLanguage`, twin of `view/theme.tsx`. |
| `core/__tests__/language.test.ts` | Resolution order, unknown values, `say()`. |
| `core/text/__tests__/word.test.ts` | `word()` over both Languages and both genders. |
| `core/text/__tests__/tables.test.ts` | Totality and character set of every display table. |
| `core/text/__tests__/character.test.ts` | `describe()` in both Languages. |

**Modified**

| File | Change |
|---|---|
| `core/window.ts` | `Window.language`, `freshWindow` third argument, `setLanguage`, `hush` helper shared with `setMuted`. |
| `core/speech/cue.ts` | `Phrases` elements become `Phrase`. |
| `core/speech/register.ts` | `phrase()` takes the Language; one line changes at the end. |
| `core/speech/voice.ts` | `speak()` threads the Language. |
| `core/speech/phrases.ts`, `core/speech/accent.ts` | Shape, then French. |
| `core/creature/species/{common,uncommon,rare,epic,legendary}.ts` | Shape, then French Signatures, labels and genders. |
| `core/creature/species.ts` | `label: Phrase`, `gender`. |
| `core/creature/character.ts` | Loses `describe()`, keeps the deriving. |
| `core/appearance/format.ts` | `fmt()` takes the Language. |
| `core/text/{card,commands,dialogs,mood,roster,toasts,traits}.ts` | Take the Language, gain French. |
| `shell/{mirror,actions,palette,dialogs}` | Signal, kv write, command, dialog. |
| `view/{card,home,roster,sidebar,dialog}.tsx`, `shell/slots.tsx` | Read the Language from the context. |
| `index.tsx` | Resolve at startup, re-register the palette on change. |
| `CONTEXT.md`, `IDEAS.md` | Glossary entry, section rename, idea marked done. |

---

### Task 1: The Language reaches every consumer

Nothing the user reads changes yet. What lands is the choice: a type, a three-layer resolution, a field on the `Window`, a signal, a palette command, a dialog, and a context the views will read in Task 10.

**Files:**
- Create: `core/language.ts`, `core/__tests__/language.test.ts`, `view/language.tsx`
- Modify: `core/window.ts`, `core/text/commands.ts`, `shell/mirror.ts`, `shell/actions.ts`, `shell/palette.ts`, `shell/dialogs.tsx`, `index.tsx`
- Test: `core/__tests__/language.test.ts`, `core/__tests__/window.test.ts`, `shell/__tests__/mirror.test.ts`, `shell/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Language = "en" | "fr"`, `const LANGUAGES: readonly Language[]`, `const DEFAULT_LANGUAGE: Language`
  - `function isLanguage(value: unknown): value is Language`
  - `function resolveLanguage(stored: unknown, option: unknown): Language`
  - `Window.language: Language`, `freshWindow(career, muted?, language?)`, `setLanguage(window, language): Window`
  - `Mirror.language: Accessor<Language>`, `Actions.setLanguage(value: Language): void`
  - `LanguageProvider(props: { language: Language; children: JSX.Element })`, `useLanguage(): Accessor<Language>`
  - `CommandId` gains `"language"`; `Dialogs` gains `askLanguage(): void`

- [ ] **Step 1: Write the failing test for the resolution**

Create `core/__tests__/language.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LANGUAGE, isLanguage, resolveLanguage, say } from "../language.ts";

test("the stored choice wins over the plugin option", () => {
  assert.equal(resolveLanguage("fr", "en"), "fr");
  assert.equal(resolveLanguage("en", "fr"), "en");
});

test("the plugin option is the default until the user has chosen", () => {
  assert.equal(resolveLanguage(undefined, "fr"), "fr");
  assert.equal(resolveLanguage(null, "fr"), "fr");
});

test("an unknown value falls through to the next layer, never throws", () => {
  assert.equal(resolveLanguage("kl", "fr"), "fr", "an unknown stored value falls to the option");
  assert.equal(resolveLanguage("kl", "kl"), DEFAULT_LANGUAGE, "two unknown values fall to English");
  assert.equal(resolveLanguage(42, { any: "shape" }), DEFAULT_LANGUAGE);
  assert.equal(resolveLanguage(undefined, undefined), DEFAULT_LANGUAGE);
});

test("isLanguage narrows only the two Languages", () => {
  assert.equal(isLanguage("fr"), true);
  assert.equal(isLanguage("FR"), false, "no case folding: the value is written by us, not typed by a user");
  assert.equal(isLanguage(""), false);
});

test("say falls back to English while a Phrase carries no French", () => {
  assert.equal(say({ en: "Purr.", fr: "Rrron." }, "fr"), "Rrron.");
  assert.equal(say({ en: "Purr." }, "fr"), "Purr.", "not written yet: English is read instead");
  assert.equal(say({ en: "Purr.", fr: "Rrron." }, "en"), "Purr.");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "core/__tests__/language.test.ts"`
Expected: FAIL — `Cannot find module '../language.ts'`.

- [ ] **Step 3: Write `core/language.ts`**

```ts
/** The Language everything the user reads is said in. One per machine, never per Career: it is a preference, not a property of the creature. */
export type Language = "en" | "fr";

export const LANGUAGES: readonly Language[] = ["en", "fr"];

/** What the plugin speaks when nothing says otherwise. */
export const DEFAULT_LANGUAGE: Language = "en";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * The Language in force: the choice stored through `api.kv` first, so a
 * choice made in the TUI is not undone by the config file at the next start;
 * then the plugin option; then English. A value of any other shape falls
 * through silently — the core never throws.
 */
export function resolveLanguage(stored: unknown, option: unknown): Language {
  if (isLanguage(stored)) return stored;
  if (isLanguage(option)) return option;
  return DEFAULT_LANGUAGE;
}

/**
 * One thing to say, in every Language. `fr` is optional only while the French
 * is being written; the last task of that work makes it required and deletes
 * the fallback below, so every gap becomes a compile error at once.
 */
export type Phrase = { en: string; fr?: string };

export function say(phrase: Phrase, language: Language): string {
  return phrase[language] ?? phrase.en;
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `node --test "core/__tests__/language.test.ts"`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing test for `setLanguage`**

Append to `core/__tests__/window.test.ts`, following the fixtures already in that file:

```ts
test("changing the Language clears every Bubble on screen", () => {
  const spoken = receive(freshWindow(career), { target: { type: "every" }, event: { type: "permission_asked" } }, 1_000).window;
  const voices = Object.values(spoken.voices);
  assert.ok(voices.length > 0 && voices.some((voice) => voice.bubble !== undefined), "a Bubble is on screen to start with");

  const switched = setLanguage(spoken, "fr");
  assert.equal(switched.language, "fr");
  for (const voice of Object.values(switched.voices)) {
    assert.equal(voice.bubble, undefined, "a phrase already shown is in the old Language");
  }
});

test("setting the Language it already speaks changes nothing", () => {
  const window = freshWindow(career, false, "fr");
  assert.equal(setLanguage(window, "fr"), window, "same reference: nobody re-renders");
});

test("a fresh Window speaks English unless told otherwise", () => {
  assert.equal(freshWindow(career).language, "en");
  assert.equal(freshWindow(career, false, "fr").language, "fr");
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `node --test "core/__tests__/window.test.ts"`
Expected: FAIL — `setLanguage` is not exported.

- [ ] **Step 7: Add the Language to the Window**

In `core/window.ts`, import the type, extend `Window`, and extract the hush the two setters share:

```ts
import { DEFAULT_LANGUAGE, type Language } from "./language.ts";

export type Window = {
  career: Career;
  pending: Delta;
  sessions: Record<string, Session>;
  voices: Record<string, Voice>;
  muted: boolean;
  /** Every phrase the user reads is said in this Language. */
  language: Language;
};

export function freshWindow(career: Career, muted = false, language: Language = DEFAULT_LANGUAGE): Window {
  return { career, pending: EMPTY_DELTA, sessions: {}, voices: {}, muted, language };
}

/** Every Voice with its Bubble taken off screen; the same references when none was showing. */
function hush(voices: Record<string, Voice>): Record<string, Voice> {
  const next: Record<string, Voice> = {};
  for (const [id, voice] of Object.entries(voices)) next[id] = voice.bubble === undefined ? voice : { ...voice, bubble: undefined };
  return next;
}

/** Muting clears every Bubble on screen; while muted no Cue is heard. */
export function setMuted(window: Window, muted: boolean): Window {
  if (window.muted === muted) return window;
  if (!muted) return { ...window, muted };
  return { ...window, muted, voices: hush(window.voices) };
}

/** Changing the Language clears every Bubble on screen: a phrase already shown is in the old Language. */
export function setLanguage(window: Window, language: Language): Window {
  if (window.language === language) return window;
  return { ...window, language, voices: hush(window.voices) };
}
```

- [ ] **Step 8: Run the core suite**

Run: `node --test "core/**/__tests__/*.test.ts"`
Expected: PASS. Any call to `freshWindow` elsewhere still compiles: the new argument is optional.

- [ ] **Step 9: Add the command and the Language names**

In `core/text/commands.ts`, add the command. It keeps the English wording for now; Task 9 gives it French:

```ts
export type CommandId = "mute" | "card" | "pet" | "rename" | "hatch" | "roster" | "choose" | "language";
export const COMMAND_IDS: readonly CommandId[] = ["mute", "card", "pet", "rename", "hatch", "roster", "choose", "language"];
```

`TITLES` gains `language: "language"`, and `description` gains a case:

```ts
    case "language":
      return "Choose the language everything is read in";
```

Create the name table in `core/text/tables.ts` — the file Task 8 fills with the rest:

```ts
import type { Language } from "../language.ts";

/** Each Language named in its own Language, so the list reads for whoever opens it. Never translated. */
export const LANGUAGE_NAME: Record<Language, string> = { en: "English", fr: "Français" };
```

- [ ] **Step 10: Mirror the Language into a signal**

In `shell/mirror.ts`, add to the `Mirror` type, the signal, and `commit`:

```ts
  /** Persisted through api.kv; every phrase the user reads is said in it. */
  language: Accessor<Language>;
```

```ts
  const [language, setLanguage] = createSignal<Language>(window.language);
```

```ts
    if (next.language !== prev.language) setLanguage(next.language);
```

and return `language` with the rest.

- [ ] **Step 11: Write the failing test for the action**

Append to `shell/__tests__/actions.test.ts`, following the fake `api` already built there:

```ts
test("choosing a Language commits it, stores it and refreshes the palette", () => {
  let registered = 0;
  const { actions, mirror, kv } = harness({ onLanguage: () => registered++ });

  actions.setLanguage("fr");

  assert.equal(mirror.language(), "fr");
  assert.equal(kv.get("tamago.language"), "fr");
  assert.equal(registered, 1, "the palette titles are fixed at registration, so they must be rebuilt");
});
```

`shell/__tests__/actions.test.ts` already builds a fake `api` with a `kv`
that records what is set, and a `Mirror` over a fresh `Window`. Reuse that
setup exactly as the file does it, adding `onLanguage` to the deps passed to
`createActions`; the three assertions above are what the test is for.

- [ ] **Step 12: Run it to make sure it fails**

Run: `bun test shell/__tests__/actions.test.ts`
Expected: FAIL — `actions.setLanguage` is not a function.

- [ ] **Step 13: Add the action**

In `shell/actions.ts`, import `setLanguage as languageWindow` from `../core/window.ts`, accept `onLanguage` in the deps, and add beside `setMute`:

```ts
  /** The Language is a window-and-machine preference, never a Delta: it does not touch the Career and never reaches the disk. */
  const setLanguage = (value: Language) => {
    const current = mirror.current();
    if (current.language === value) return;
    mirror.commit(languageWindow(current, value));
    api.kv.set("tamago.language", value);
    onLanguage();
  };
```

Return it with the others.

- [ ] **Step 14: Add the dialog and wire the palette**

In `shell/dialogs.tsx`, add to the `Dialogs` type and build the select:

```tsx
  /** The Languages, each named in its own. Two rows today; a select is the shape that survives a third. */
  const askLanguage = () => {
    api.ui.dialog.replace(() => (
      <api.ui.DialogSelect
        title={LANGUAGE_TITLE}
        skipFilter
        options={LANGUAGES.map((one) => ({ title: LANGUAGE_NAME[one], value: one }))}
        onSelect={guard((option: { value: string }) => {
          api.ui.dialog.clear();
          if (isLanguage(option.value)) actions.setLanguage(option.value);
        })}
      />
    ));
  };
```

Add `export const LANGUAGE_TITLE = "Language";` to `core/text/dialogs.ts`. In `shell/palette.ts`, add `language: dialogs.askLanguage` to `RUN`.

- [ ] **Step 15: Resolve at startup and close the loop**

In `index.tsx`, replace the `freshWindow` call and pass the callback:

```tsx
    const language = resolveLanguage(api.kv.get<unknown>("tamago.language"), options?.language);
    const mirror = createMirror(
      freshWindow(loaded.career, api.kv.get<boolean>("tamago.muted", false) === true, language),
      defaultName,
      (effect) => { /* unchanged */ },
    );
```

and `createActions({ api, store, mirror, warnCorrupt, guard, onLanguage: () => palette?.register() })`.

- [ ] **Step 16: Add the context the views will read**

Create `view/language.tsx`:

```tsx
/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { createContext, useContext, type Accessor } from "solid-js";
import { DEFAULT_LANGUAGE, type Language } from "../core/language.ts";

const LanguageContext = createContext<Accessor<Language>>();

/** Posted at every root the shell renders, beside the theme, so no view threads a language prop. */
export function LanguageProvider(props: { language: Language; children: JSX.Element }): JSX.Element {
  return <LanguageContext.Provider value={() => props.language}>{props.children}</LanguageContext.Provider>;
}

/** The Language in force. An accessor, read inside JSX, so a change repaints. Outside a provider it reads English rather than throwing: a missing provider must not take the window down. */
export function useLanguage(): Accessor<Language> {
  return useContext(LanguageContext) ?? (() => DEFAULT_LANGUAGE);
}
```

- [ ] **Step 17: Run everything**

```bash
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
bun test view shell
./node_modules/.bin/tsc --noEmit
```

Expected: PASS everywhere, and the five snapshot files under `view/__tests__/__snapshots__/` unchanged — nothing the user reads has moved.

- [ ] **Step 18: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): let the user choose the language tamago is read in"
```

---

### Task 2: Phrases carry two Languages

Mechanical and English-only: the element type of `Phrases` becomes `Phrase`, and every literal `"text"` becomes `{ en: "text" }`. No French is written here. The proof is that the English snapshots do not move.

**Files:**
- Modify: `core/speech/cue.ts`, `core/speech/signature.ts`, `core/speech/register.ts`, `core/speech/voice.ts`, `core/speech/phrases.ts`, `core/speech/accent.ts`, `core/creature/species.ts`, `core/creature/species/{common,uncommon,rare,epic,legendary}.ts`, `core/creature/catalog.ts`, `core/window.ts`, `core/text/card.ts`, `core/text/roster.ts`
- Test: `core/speech/__tests__/{phrases,accent,register}.test.ts`, `core/creature/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `Phrase`, `say`, `Language` from `core/language.ts` (Task 1).
- Produces:
  - `Phrases = readonly [Phrase, ...Phrase[]]`
  - `phrase(cue, speaker, times, language, table?): string | undefined`
  - `speak(voice, event, before, after, now, speaker, behavior?, awaits?, language?, table?): Voice`
  - `Species.label: Phrase`, `Species.gender?: Gender`, `type Gender = "m" | "f"`
  - `assertSayable(phrase: Phrase, where: string): void` in `core/speech/__tests__/sayable.ts`

- [ ] **Step 1: Write the shared phrase check, and make it fail**

Create `core/speech/__tests__/sayable.ts`:

```ts
import assert from "node:assert/strict";
import { LANGUAGES, say, type Phrase } from "../../language.ts";
import { MAX_TEXT } from "../bubble.ts";

/** What every phrase must satisfy, in every Language it carries. */
const ALLOWED: Record<(typeof LANGUAGES)[number], RegExp> = {
  en: /^[\x20-\x7e]+$/,
  fr: /^[\x20-\x7eÀ-ÿŒœ]+$/,
};

export function assertSayable(phrase: Phrase, where: string): void {
  for (const language of LANGUAGES) {
    const written = phrase[language];
    if (written === undefined) continue; // not translated yet; Task 11 makes it impossible
    const shown = `${where} [${language}]: ${JSON.stringify(written)}`;
    assert.ok(written.length > 0, shown);
    assert.ok(written.length <= MAX_TEXT, `${shown} is ${written.length} long, MAX_TEXT is ${MAX_TEXT}`);
    assert.match(written, ALLOWED[language], shown);
    assert.equal(written, written.normalize("NFC"), `${shown} must be NFC: length is measured in UTF-16 units`);
    assert.equal(say(phrase, language), written);
  }
}
```

- [ ] **Step 2: Point the existing checks at it**

Rewrite the two tests of `core/speech/__tests__/phrases.test.ts` to walk `Phrase` objects:

```ts
test("every phrase fits in MAX_TEXT and every Cue has at least one", () => {
  for (const cue of Object.keys(CUES) as Cue[]) {
    assert.ok(PHRASES[cue].length >= 1, cue);
    for (const phrase of PHRASES[cue]) assertSayable(phrase, cue);
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
```

Do the same wherever `core/creature/__tests__/catalog.test.ts` and `core/speech/__tests__/accent.test.ts` assert a phrase's length or charset.

- [ ] **Step 3: Run to make sure they fail**

Run: `node --test "core/speech/__tests__/phrases.test.ts"`
Expected: FAIL — a `string` is passed where a `Phrase` is expected, and `assertSayable` reads `phrase[language]` off a string.

- [ ] **Step 4: Widen the type**

In `core/speech/cue.ts`, replace the `Phrases` definition:

```ts
import type { Phrase } from "../language.ts";

/** At least one Phrase; a test bounds every Language of each to MAX_TEXT. */
export type Phrases = readonly [Phrase, ...Phrase[]];
```

In `core/creature/species.ts`:

```ts
import type { Phrase } from "../language.ts";

/** French agrees in gender, English does not; the Species is what carries the fact. */
export type Gender = "m" | "f";

/** `sheet` holds the Modifiers this Species adds to the Sheet; absent for none. `gender` is optional only while the French is being written. */
export type Species = { id: SpeciesId; label: Phrase; gender?: Gender; rarity: Rarity; sheet?: Modifiers };
```

and the fallback of `species()` becomes:

```ts
  return table.find((entry) => entry.id === id) ?? table.find((entry) => entry.id === REFERENCE) ?? { id: REFERENCE, label: { en: REFERENCE }, rarity: "common" };
```

- [ ] **Step 5: Thread the Language through the Voice**

`core/speech/register.ts` — `phrase()` gains the parameter and changes its last lines:

```ts
export function phrase(cue: AnyCue, speaker: Speaker, times: number, language: Language, table: Record<TraitId, Accent> = ACCENT): string | undefined {
  const taken = accentFor(cue, speaker.traits, table);
  const random = generator(seed(speaker.hatchedAt, domain(cue, times)));
  if (taken !== undefined) return say(taken[Math.floor(random() * taken.length)] ?? taken[0], language);
  if (isTraitCue(cue)) return undefined;
  const register = cue === "hatched" ? "species" : weighted(random(), REGISTERS, (key) => REGISTER[key]);
  const own = pool(cue, speaker, register, random());
  return say(own[Math.floor(random() * own.length)] ?? own[0], language);
}
```

The seed, the domain, the Register shares and the weighted draw are untouched: the same occurrence of the same Cue picks the same index in both Languages.

`core/speech/voice.ts` — `speak()` gains `language: Language = DEFAULT_LANGUAGE` after `awaits`, passes it to `phrase`, and `listen` is unchanged. `core/window.ts` passes `window.language` in the `move` call.

- [ ] **Step 6: Convert every table, English only**

Eight files, one mechanical rule: a phrase literal `"text"` becomes `{ en: "text" }`.

- `core/speech/phrases.ts` — `PHRASES` (13 Cues) and `FLAVOR` (4 Temperaments × 13).
- `core/speech/accent.ts` — the `phrases` of the six Accents.
- `core/creature/species/{common,uncommon,rare,epic,legendary}.ts` — the `signature` of all 20 Species, and each `label: "cat"` becomes `label: { en: "cat" }`.

Change no English word. Add no French. The snapshots in Step 8 are the check.

- [ ] **Step 7: Fix the two readers of a label**

`core/text/card.ts` `speciesLine` and `reveal`, and `core/text/roster.ts` `line`, read `species.label`. Until Task 9 gives them a Language, they read the English side explicitly:

```ts
  return `${say(tamago.species.label, "en")} · ${tamago.species.rarity}`;
```

Leave a comment naming Task 9 so the temporary constant is not mistaken for a decision.

- [ ] **Step 8: Run everything, and check the snapshots did not move**

```bash
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
bun test view shell
./node_modules/.bin/tsc --noEmit
git diff --stat -- view/__tests__/__snapshots__
```

Expected: every suite PASS, and `git diff --stat` on the snapshots prints **nothing**. A moved snapshot means an English word changed during the conversion: find it and put it back rather than accepting the new snapshot.

- [ ] **Step 9: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "refactor(opencode): give every phrase a slot per language"
```

---

### Tasks 3 to 6: the French of the Species

Four tasks, same shape, one per file. They are independent: nothing in one is read by another, so they may run in parallel.

| Task | File | Species |
|---|---|---|
| 3 | `core/creature/species/common.ts` | 6 |
| 4 | `core/creature/species/uncommon.ts` | 6 |
| 5 | `core/creature/species/rare.ts` | 4 |
| 6 | `core/creature/species/epic.ts` + `legendary.ts` | 3 + 1 |

**Files (per task):**
- Modify: the file(s) in the row
- Test: `core/creature/__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `Phrase`, `Gender`, `assertSayable` (Tasks 1 and 2).
- Produces: nothing new. Each entry gains `fr` on every phrase of its `signature`, `fr` on its `label`, and a `gender`.

- [ ] **Step 1: Write the failing test**

In `core/creature/__tests__/catalog.test.ts`, add a check that names the file under work — here `COMMON`; each task names its own:

```ts
test("every common Species is written in French: label, gender and all thirteen Cues", () => {
  for (const entry of COMMON) {
    assert.ok(entry.label.fr !== undefined, `${entry.id}: no French label`);
    assert.ok(entry.gender !== undefined, `${entry.id}: no gender, so French cannot agree`);
    for (const cue of Object.keys(CUES) as Cue[]) {
      for (const phrase of entry.signature[cue]) {
        assert.ok(phrase.fr !== undefined, `${entry.id}/${cue}: ${JSON.stringify(phrase.en)} has no French`);
        assertSayable(phrase, `${entry.id}/${cue}`);
      }
    }
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "core/creature/__tests__/catalog.test.ts"`
Expected: FAIL — the first Species has no French label.

- [ ] **Step 3: Write the French**

Rules, not suggestions:

- **Write, do not translate.** Each Species keeps its voice: the cat stays curt, the owl stays measured, the dragon stays grand. A French phrase that says something slightly different but sounds like that creature beats a faithful translation that sounds like nobody.
- **24 characters, hard.** When French does not fit, find a shorter thing for that creature to say. Never widen `MAX_TEXT`.
- **NFC and the allowed set.** `é` is one character, not `e` + an accent. No typographic quotes, no `…`, no `«»` — printable ASCII plus the French letters and `œ`.
- **The `gender` is the gender of the French label**, not of the English one: `owl` → `{ en: "owl", fr: "chouette" }`, `gender: "f"`.
- **`hatched` is where the Species shows.** It is the one Cue the Species always speaks, so give it the best three.

Example of the shape, on the first entry of `common.ts`:

```ts
  {
    id: "cat",
    label: { en: "cat", fr: "chat" },
    gender: "m",
    rarity: "common",
    bodies: { /* unchanged */ },
    signature: {
      permission: [
        { en: "Mrow? May I?", fr: "Miaou ? Je peux ?" },
        { en: "Paw on it. Yes?", fr: "Patte dessus. Oui ?" },
        { en: "Say yes, human.", fr: "Dis oui, humain." },
      ],
      granted: [
        { en: "Purr.", fr: "Rrron." },
        { en: "Good human.", fr: "Gentil humain." },
        { en: "As it should be.", fr: "C'est normal." },
      ],
      // ... the eleven other Cues
    },
  },
```

- [ ] **Step 4: Run the test**

Run: `node --test "core/creature/__tests__/catalog.test.ts"`
Expected: PASS. A failure names the Species, the Cue and the offending string.

- [ ] **Step 5: Check nothing English moved**

```bash
./node_modules/.bin/tsc --noEmit
bun test view
git diff --stat -- view/__tests__/__snapshots__
```

Expected: PASS, and no snapshot moved — adding `fr` cannot change what English reads.

- [ ] **Step 6: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): give the common species a french voice"
```

Scopes for the other three: `uncommon species`, `rare species`, `epic and legendary species`.

---

### Task 7: The French of the Registers and the Accents

**Files:**
- Modify: `core/speech/phrases.ts`, `core/speech/accent.ts`
- Test: `core/speech/__tests__/phrases.test.ts`, `core/speech/__tests__/accent.test.ts`, `core/speech/__tests__/register.test.ts`

**Interfaces:**
- Consumes: `assertSayable` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

In `core/speech/__tests__/phrases.test.ts`:

```ts
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
```

In `core/speech/__tests__/accent.test.ts`, the same over `ACCENT`, walking each Accent's `takes` and `opens`.

In `core/speech/__tests__/register.test.ts`, the property the whole design rests on:

```ts
test("a Language changes the words, never which phrase is drawn", () => {
  const speaker = speakerOf(career);
  for (const cue of Object.keys(CUES) as Cue[]) {
    for (let times = 0; times < 8; times++) {
      const english = phrase(cue, speaker, times, "en");
      const french = phrase(cue, speaker, times, "fr");
      assert.ok(english !== undefined && french !== undefined, `${cue}/${times}`);
      assert.notEqual(french, undefined);
      // the same draw: the French said here is the French of the English said there
      assert.equal(french, frenchOf(english), `${cue}/${times}: the two Languages drew different phrases`);
    }
  }
});
```

where `frenchOf` looks the English string up across `PHRASES`, `FLAVOR`, every `signature` and `ACCENT`, and returns the `fr` of the `Phrase` that carries it. Build it in the test file; it is the check that the pools stayed parallel.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test "core/speech/__tests__/*.test.ts"`
Expected: FAIL — no French anywhere in `PHRASES`.

- [ ] **Step 3: Write the French**

Same rules as Tasks 3–6. Three pools, three different jobs:

- `PHRASES` — the neutral Register, the common ground: plain, no character. `{ en: "May I?", fr: "Je peux ?" }`.
- `FLAVOR` — the four Temperaments, which must stay *recognisable apart*. `cheerful` exclaims, `sarcastic` deadpans, `stoic` is short and flat, `dreamy` trails off. The French must keep that distance between them; if two Temperaments read alike in French, the nuance the Register buys is gone.
- `ACCENT` — the six Traits. A Trait speaks *instead of* the Species, so its French must sound like the Trait, not like the creature.

- [ ] **Step 4: Run the tests**

Run: `node --test "core/speech/__tests__/*.test.ts"`
Expected: PASS, including the parallel-draw test.

- [ ] **Step 5: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): give the registers and the accents a french voice"
```

---

### Task 8: The display tables and gender agreement

**Files:**
- Create: `core/text/word.ts`, `core/text/__tests__/word.test.ts`, `core/text/__tests__/tables.test.ts`
- Modify: `core/text/tables.ts` (created in Task 1)
- Test: the two created above

**Interfaces:**
- Consumes: `Language`, `Gender`.
- Produces:
  - `type Agreed = { m: string; f: string }`, `type Word = { en: string; fr: Agreed }`
  - `function word(w: Word, language: Language, gender: Gender): string`
  - `STAGE_TEXT: Record<StageId, Word>`, `RARITY_TEXT: Record<Rarity, Word>`
  - `STAT_TEXT: Record<BehaviorStat, Phrase>`, `TEMPERAMENT_TEXT: Record<Temperament, Phrase>`, `STANCE_TEXT: Record<Stance, Word>`
  - `CRAFT_TEXT: Record<Craft, { text: Phrase; gender: Gender }>`

- [ ] **Step 1: Write the failing test for `word`**

Create `core/text/__tests__/word.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { word, type Word } from "../word.ts";

const COMMON: Word = { en: "common", fr: { m: "commun", f: "commune" } };
const RARE: Word = { en: "rare", fr: { m: "rare", f: "rare" } };

test("English agrees with nothing", () => {
  assert.equal(word(COMMON, "en", "m"), "common");
  assert.equal(word(COMMON, "en", "f"), "common");
});

test("French agrees in gender", () => {
  assert.equal(word(COMMON, "fr", "m"), "commun");
  assert.equal(word(COMMON, "fr", "f"), "commune");
});

test("an invariable French word is still written twice, so no caller has to know which are", () => {
  assert.equal(word(RARE, "fr", "m"), "rare");
  assert.equal(word(RARE, "fr", "f"), "rare");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test "core/text/__tests__/word.test.ts"`
Expected: FAIL — `Cannot find module '../word.ts'`.

- [ ] **Step 3: Write `core/text/word.ts`**

```ts
import type { Language } from "../language.ts";
import type { Gender } from "../creature/species.ts";

/** A French word in both genders. Invariable words carry the same string twice: no caller has to know which words agree. */
export type Agreed = { m: string; f: string };

/** A word the user reads, where French agrees in gender and English does not. */
export type Word = { en: string; fr: Agreed };

export function word(w: Word, language: Language, gender: Gender): string {
  return language === "en" ? w.en : w.fr[gender];
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `node --test "core/text/__tests__/word.test.ts"`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the tables**

Fill `core/text/tables.ts`, keeping `LANGUAGE_NAME` from Task 1:

```ts
export const STAGE_TEXT: Record<StageId, Word> = {
  egg: { en: "egg", fr: { m: "œuf", f: "œuf" } },
  hatchling: { en: "hatchling", fr: { m: "nouveau-né", f: "nouveau-née" } },
  young: { en: "young", fr: { m: "jeune", f: "jeune" } },
  adult: { en: "adult", fr: { m: "adulte", f: "adulte" } },
  elder: { en: "elder", fr: { m: "ancien", f: "ancienne" } },
};

export const RARITY_TEXT: Record<Rarity, Word> = {
  common: { en: "common", fr: { m: "commun", f: "commune" } },
  uncommon: { en: "uncommon", fr: { m: "peu commun", f: "peu commune" } },
  rare: { en: "rare", fr: { m: "rare", f: "rare" } },
  epic: { en: "epic", fr: { m: "épique", f: "épique" } },
  legendary: { en: "legendary", fr: { m: "légendaire", f: "légendaire" } },
};

export const STAT_TEXT: Record<BehaviorStat, Phrase> = {
  energy: { en: "energy", fr: "énergie" },
  chatter: { en: "chatter", fr: "bavardage" },
  sensitivity: { en: "sensitivity", fr: "sensibilité" },
  patience: { en: "patience", fr: "patience" },
};

export const TEMPERAMENT_TEXT: Record<Temperament, Phrase> = {
  cheerful: { en: "cheerful", fr: "enjoué" },
  sarcastic: { en: "sarcastic", fr: "sarcastique" },
  stoic: { en: "stoic", fr: "stoïque" },
  dreamy: { en: "dreamy", fr: "rêveur" },
};

/** The Craft carries the gender of its French noun, because the Stance agrees with it. */
export const CRAFT_TEXT: Record<Craft, { text: Phrase; gender: Gender }> = {
  scribe: { text: { en: "scribe", fr: "scribe" }, gender: "m" },
  shell: { text: { en: "shell", fr: "mécano" }, gender: "m" },
  sage: { text: { en: "sage", fr: "érudit" }, gender: "m" },
};

export const STANCE_TEXT: Record<Stance, Word> = {
  prudent: { en: "prudent", fr: { m: "prudent", f: "prudente" } },
  bold: { en: "bold", fr: { m: "audacieux", f: "audacieuse" } },
};
```

- [ ] **Step 6: Write the totality test**

Create `core/text/__tests__/tables.test.ts`: every table is total over its key type (walk `STAGES`, `RARITIES`, `BEHAVIOR_STATS`, `TEMPERAMENTS`, the `Craft` and `Stance` keys), every French string matches the French character set and is NFC, and no entry is empty. Reuse `assertSayable` for the `Phrase` tables; write the equivalent two assertions inline for the `Word` ones, over both genders.

- [ ] **Step 7: Run the core suite**

Run: `node --test "core/**/__tests__/*.test.ts"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): name every stage, rarity and stat in both languages"
```

---

### Task 9: `core/text` and `fmt` take the Language

Every text function gains a `language` parameter **with a default of `"en"`**, so no caller breaks in this task. Task 10 removes the defaults and passes the real one.

**Files:**
- Create: `core/text/character.ts`, `core/text/__tests__/character.test.ts`
- Modify: `core/appearance/format.ts`, `core/text/{card,commands,dialogs,mood,roster,toasts,traits}.ts`, `core/creature/character.ts`, `view/card.tsx`
- Test: `core/text/__tests__/{card,commands,mood,roster,toasts,character}.test.ts`, `core/appearance/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `word`, the six tables (Task 8), `say`, `Language`.
- Produces, every one with `language: Language = "en"` as its last parameter unless shown otherwise:
  - `fmt(n: number, language?: Language): string`
  - `age(hatchedAt, now, language?)`, `progress(tamago, width?, language?)`, `speciesLine(tamago, language?)`, `reveal(name, tamago, language?)`, `sheetLines(tamago, language?)`, `traitLines(tamago, language?)`
  - `describe(character: Character, language?: Language): string` — moved to `core/text/character.ts`
  - `command(id, who, choices?, language?)`, `mood(activity, language?)`, `blocked(first, fallback, language?)`, `stepsIn(career, fallback, language?)`, `line(career, fallback, activeId, language?)`, `evolved(name, stage, language?)`, `cannotSave(name, dir, language?)`, `hatchConfirm(name, language?)`
  - `RENAME`, `CHOOSE`, `ROSTER_TITLE`, `LANGUAGE_TITLE`, `CORRUPT`, `BUSY`, `GONE`, `STATS_HIDDEN`, `NOTHING_TO_CHOOSE`, `CHOSEN_ELSEWHERE`, `TRAIT_TEXT` become `Phrase` (or records of `Phrase`) and are read with `say`

- [ ] **Step 1: Write the failing tests**

Extend the existing `core/text/__tests__/*.test.ts`, keeping every current English assertion untouched and adding its French twin. In `card.test.ts`:

```ts
test("age counts whole days since hatching, in French", () => {
  assert.equal(age(0, 0, "fr"), "éclos aujourd'hui");
  assert.equal(age(0, DAY_MS, "fr"), "1 jour");
  assert.equal(age(0, 12 * DAY_MS + 5, "fr"), "12 jours");
});

test("the species line agrees in gender", () => {
  const owl = tamago({ ...career, species: "owl" });
  assert.equal(speciesLine(owl, "en"), "owl · common");
  assert.equal(speciesLine(owl, "fr"), "chouette · commune");
  assert.equal(speciesLine(tamago(career), "fr"), "chat · commun");
});

test("the reveal picks its article from the gender in French and the first letter in English", () => {
  assert.equal(reveal("Nono", tamago({ ...career, species: "owl" }), "en"), "Nono hatched: an owl, common!");
  assert.equal(reveal("Nono", tamago({ ...career, species: "owl" }), "fr"), "Nono a éclos : une chouette, commune !");
  assert.equal(reveal("Nono", tamago(career), "fr"), "Nono a éclos : un chat, commun !");
});
```

In `core/appearance/__tests__/format.test.ts`:

```ts
test("thousands are grouped with a comma in English and a plain space in French", () => {
  assert.equal(fmt(2147, "en"), "2,147");
  assert.equal(fmt(2147, "fr"), "2 147");
  assert.equal(fmt(41467, "fr"), "41 467");
  assert.equal(fmt(0, "fr"), "0");
  assert.equal(fmt(2147, "fr").includes(" "), false, "a plain U+0020, so ICU data cannot move it under us");
});
```

Create `core/text/__tests__/character.test.ts`:

```ts
test("the character reads as the Temperament alone before young", () => {
  assert.equal(describe({ temperament: "stoic" }, "en"), "stoic");
  assert.equal(describe({ temperament: "stoic" }, "fr"), "stoïque");
});

test("the Stance agrees with the Craft in French", () => {
  const character = { temperament: "sarcastic", vocation: { craft: "shell", stance: "prudent" } } as const;
  assert.equal(describe(character, "en"), "sarcastic · prudent shell");
  assert.equal(describe(character, "fr"), "sarcastique · mécano prudent");
});
```

Note the French word order: the adjective follows the noun.

- [ ] **Step 2: Run them to make sure they fail**

Run: `node --test "core/text/__tests__/*.test.ts" "core/appearance/__tests__/format.test.ts"`
Expected: FAIL — the functions take no Language.

- [ ] **Step 3: Write `fmt`**

```ts
const GROUPED: Record<Language, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en-US"),
  fr: new Intl.NumberFormat("en-US"), // grouped the same way, then the separator is replaced below
};

/**
 * Thousands grouped for the Language. French uses a plain U+0020 rather than
 * the narrow no-break space `fr-FR` would give: it keeps the ASCII rule, it
 * stays one column wide, and it cannot move when Node's ICU data changes.
 */
export function fmt(n: number, language: Language = "en"): string {
  const grouped = GROUPED[language].format(n);
  return language === "fr" ? grouped.replaceAll(",", " ") : grouped;
}
```

- [ ] **Step 4: Move `describe` and write the grammar**

Create `core/text/character.ts`:

```ts
import type { Character } from "../creature/character.ts";
import type { Language } from "../language.ts";
import { say } from "../language.ts";
import { CRAFT_TEXT, STANCE_TEXT, TEMPERAMENT_TEXT } from "./tables.ts";
import { word } from "./word.ts";

/** "sarcastic · prudent shell" / "sarcastique · mécano prudent", or the Temperament alone before young. */
export function describe(character: Character, language: Language = "en"): string {
  const temperament = say(TEMPERAMENT_TEXT[character.temperament], language);
  const vocation = character.vocation;
  if (vocation === undefined) return temperament;
  const craft = CRAFT_TEXT[vocation.craft];
  const stance = word(STANCE_TEXT[vocation.stance], language, craft.gender);
  const named = say(craft.text, language);
  // English puts the adjective before the noun, French after it.
  return language === "en" ? `${temperament} · ${stance} ${named}` : `${temperament} · ${named} ${stance}`;
}
```

Delete `describe` from `core/creature/character.ts` and update the import in `view/card.tsx` to `../core/text/character.ts`.

- [ ] **Step 5: Give the Language to every other text function**

Work file by file through `core/text/`, each function switching on the Language and writing both grammars in full. The three that need care:

```ts
export function age(hatchedAt: number, now: number, language: Language = "en"): string {
  const days = Math.max(0, Math.floor((now - hatchedAt) / DAY_MS));
  switch (language) {
    case "en":
      return days === 0 ? "hatched today" : days === 1 ? "1 day old" : `${days} days old`;
    case "fr":
      return days === 0 ? "éclos aujourd'hui" : days === 1 ? "1 jour" : `${days} jours`;
  }
}
```

```ts
/** "a" or "an" by the first letter in English; "un" or "une" by the gender in French. */
function article(tamago: Tamago, language: Language): string {
  if (language === "en") return /^[aeiou]/i.test(say(tamago.species.label, "en")) ? "an" : "a";
  return tamago.species.gender === "f" ? "une" : "un";
}
```

```ts
export function blocked(first: Career, fallback: string, language: Language = "en"): string {
  const who = nameOf(first, fallback);
  const gender = species(first.species).gender ?? "m";
  const stageOf = word(STAGE_TEXT[stage(first)], language, gender);
  switch (language) {
    case "en":
      return stage(first) === "egg"
        ? `${who} is still an egg. Hatch when every Tamago is elder.`
        : `${who} is still ${stageOf}. Hatch when every Tamago is elder.`;
    case "fr":
      // "encore un œuf" takes an article where "encore jeune" does not.
      return stage(first) === "egg"
        ? `${who} est encore un œuf. Une éclosion demande que tous soient anciens.`
        : `${who} est encore ${stageOf}. Une éclosion demande que tous soient anciens.`;
  }
}
```

The rest is a vocabulary, not a judgement call. Write exactly these:

| Where | English | French |
|---|---|---|
| `card.STATS_HIDDEN` | stats show at hatching | les stats viennent à l'éclosion |
| `card.speciesLine` egg | still an egg | encore un œuf |
| `card.progress` final | `… xp · final form` | `… xp · forme finale` |
| `mood.idle` | chilling | tranquille |
| `mood.thinking` | thinking... | réfléchit... |
| `mood.working` | working | travaille |
| `mood.waiting` | needs you | t'attend |
| `mood.hurt` | ouch | aïe |
| `mood.sleeping` | zzz | zzz |
| `commands.PALETTE` | Tamago | Tamago |
| `commands` titles | toggle bubbles / show card / pet / rename / hatch a new egg / roster / choose a trait / language | bulles on-off / voir la carte / caresser / renommer / faire éclore un œuf / roster / choisir un trait / langue |
| `commands.mute` desc | Mute or unmute what {who} says | Couper ou rendre la parole à {who} |
| `commands.card` desc | Who {who} is: species, stage, XP, age, stats | Qui est {who} : espèce, stade, XP, âge, stats |
| `commands.pet` desc | Give {who} a pat | Faire une caresse à {who} |
| `commands.rename` desc | Give {who} a new name, shared by every window | Donner un nouveau nom à {who}, partagé par toutes les fenêtres |
| `commands.hatch` desc | Hatch a new egg once every Tamago is elder | Faire éclore un œuf quand tous les Tamago sont anciens |
| `commands.roster` desc | Every Tamago of this machine; pick one to bring it to the front | Tous les Tamago de cette machine ; en choisir un pour le mettre devant |
| `commands.language` desc | Choose the language everything is read in | Choisir la langue dans laquelle tout se lit |
| `commands.choose` 0 | Nothing to choose for {who} yet | Rien à choisir pour {who} pour l'instant |
| `commands.choose` 1 | One choice waits for {who} | Un choix attend {who} |
| `commands.choose` n | {n} choices wait for {who} | {n} choix attendent {who} |
| `dialogs.RENAME` | Rename / A name for the creature | Renommer / Un nom pour la créature |
| `dialogs.hatchConfirm` | Hatch a new egg? / {name} rests in the roster; switch back anytime. | Faire éclore un œuf ? / {name} passe au roster ; on peut y revenir quand on veut. |
| `dialogs.ROSTER_TITLE` | Tamago: roster | Tamago : roster |
| `dialogs.LANGUAGE_TITLE` | Language | Langue |
| `toasts.CORRUPT` | Saved progress was unreadable… | La progression enregistrée était illisible. Elle est mise de côté en career.json.corrupt-* ; on repart d'un œuf. |
| `toasts.BUSY` | Another window is writing. Try again. | Une autre fenêtre écrit. Réessaie. |
| `toasts.GONE` | That Tamago is gone from the roster. | Ce Tamago n'est plus au roster. |
| `toasts.evolved` | {name} evolved: {stage}! | {name} évolue : {stage} ! |
| `toasts.cannotSave` | {name} cannot save its progress. See {dir}/error.log. | {name} n'arrive pas à enregistrer sa progression. Voir {dir}/error.log. |
| `roster.stepsIn` | {name} steps in. / A new egg. | {name} prend la place. / Un nouvel œuf. |
| `roster.line` active | active | actif |
| `traits.CHOOSE` | Keep one | En garder un |
| `traits.NOTHING_TO_CHOOSE` | No choice waits right now. | Aucun choix n'attend pour l'instant. |
| `traits.CHOSEN_ELSEWHERE` | That choice was made in another window. | Ce choix a été fait dans une autre fenêtre. |
| `traits.hardy` | Hardy / Shrugs off failing streaks and retries | Endurant / Encaisse les séries d'échecs et les reprises |
| `traits.unshaken` | Unshaken / Takes a refusal and a long haul in stride | Imperturbable / Prend un refus et une longue traversée sans broncher |
| `traits.proud` | Proud / Makes much of finished lists and big diffs | Fier / Fait grand cas des listes finies et des gros diffs |
| `traits.boastful` | Boastful / Crows over evolutions and granted permissions | Vantard / Se rengorge des évolutions et des permissions accordées |
| `traits.watchful` | Watchful / Notices branches changing and worktrees appearing | Vigilant / Remarque les branches qui changent et les worktrees qui apparaissent |
| `traits.restless` | Restless / Feels files stirring outside the session | Fébrile / Sent les fichiers bouger hors de la session |

The French keeps the space before `?`, `!` and `:` that French typography
asks for, as the table shows. `PALETTE` stays `Tamago`: it is the plugin's
name, not a word.

`LABEL_WIDTH` in `card.ts` becomes a function of the Language:

```ts
/** Labels are padded to the longest behavior Stat of that Language, so the bars line up. */
function labelWidth(language: Language): number {
  return Math.max(...BEHAVIOR_STATS.map((stat) => say(STAT_TEXT[stat], language).length));
}
```

- [ ] **Step 6: Run the core suite**

Run: `node --test "core/**/__tests__/*.test.ts"`
Expected: PASS.

- [ ] **Step 7: Check the English is still exactly the English**

```bash
bun test view shell
./node_modules/.bin/tsc --noEmit
git diff --stat -- view/__tests__/__snapshots__
```

Expected: PASS, and no snapshot moved: every caller still uses the `"en"` default.

- [ ] **Step 8: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): write every interface string in both languages"
```

---

### Task 10: The views and the shell pass the Language

**Files:**
- Modify: `shell/slots.tsx`, `shell/dialogs.tsx`, `shell/actions.ts`, `shell/palette.ts`, `index.tsx`, `view/{card,home,roster,sidebar,dialog}.tsx`, `core/appearance/format.ts`, and every `core/text` signature that still carries a default
- Test: `view/__tests__/{card,home,roster,sidebar}.test.tsx`, `shell/__tests__/dialogs.test.tsx`

**Interfaces:**
- Consumes: `useLanguage` / `LanguageProvider` (Task 1), every `core/text` function (Task 9).
- Produces: the `language` parameter of every `core/text` function is **required**; views take no language prop.

- [ ] **Step 1: Write the failing French view tests**

In `view/__tests__/card.test.tsx`, add a French twin of the adult card:

```tsx
test("the card of an adult reads in French", async () => {
  const now = OWNER.hatchedAt + 12 * DAY_MS;
  const shown = await frame(() => (
    <ThemeProvider theme={TUI_THEME}>
      <LanguageProvider language="fr">
        <CardView name="Tamago" tamago={tamago(OWNER)} clock={0} heart={false} now={now} />
      </LanguageProvider>
    </ThemeProvider>
  ));
  expect(shown).toContain("chat · commun");
  expect(shown).toContain("12 jours");
  expect(shown).toContain("énergie");
  expect(shown).toMatchSnapshot();
});
```

Add the same for `roster.test.tsx` (a French roster line) and `sidebar.test.tsx` (a French mood).

- [ ] **Step 2: Run them to make sure they fail**

Run: `bun test view`
Expected: FAIL — the card renders English inside a French provider.

- [ ] **Step 3: Post the provider at every root**

In `shell/slots.tsx`, wrap both slots, inside `ThemeProvider`:

```tsx
          <ThemeProvider theme={ctx.theme}>
            <LanguageProvider language={mirror.language()}>
              <SidebarView … />
            </LanguageProvider>
          </ThemeProvider>
```

Do the same for `home_bottom`, and in `shell/dialogs.tsx` for the card root and the roster root.

- [ ] **Step 4: Read it in the views**

Each view calls `const language = useLanguage();` beside `useTheme()` and passes `language()` to every `core/text` call, inside JSX so a change repaints:

```tsx
  <text fg={theme.current.textMuted}>{speciesLine(props.tamago, language())}</text>
  <text fg={theme.current.textMuted}>{age(props.tamago.career.hatchedAt, props.now, language())}</text>
  <text fg={theme.current.textMuted}>{describe(props.tamago.character, language())}</text>
```

`view/dialog.tsx` reads `ESC_HINT` — it stays as it is, `esc` being a key name, not a word.

- [ ] **Step 5: Pass it from the shell**

`shell/dialogs.tsx` (`blocked`, `line`, `hatchConfirm`, `RENAME`, `CHOOSE`, `TRAIT_TEXT`, the toasts), `shell/actions.ts` (`BUSY`, `GONE`), `shell/palette.ts` (`command(id, who, choices, mirror.language())`) and `index.tsx` (`reveal`, `stepsIn`, `evolved`, `cannotSave`, `CORRUPT`) all read `mirror.language()`.

- [ ] **Step 6: Remove the defaults**

Delete every `= "en"` default added in Task 9. The compiler now names any caller still not passing a Language.

- [ ] **Step 7: Run everything and review the snapshots**

```bash
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
bun test view shell
./node_modules/.bin/tsc --noEmit
git diff -- view/__tests__/__snapshots__
```

Expected: PASS. The diff must show **only additions** — the new French snapshots. An English snapshot that moved means a view changed what it renders in English; fix the view rather than accept the snapshot.

- [ ] **Step 8: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): read every surface in the chosen language"
```

---

### Task 11: Close the migration

Makes the French required, so the type checker proves nothing was left behind, and writes down what changed.

**Files:**
- Modify: `core/language.ts`, `core/creature/species.ts`, `core/speech/__tests__/sayable.ts`, `CONTEXT.md`, `IDEAS.md`, `README.md`
- Test: the whole suite

**Interfaces:**
- Consumes: everything above.
- Produces: `Phrase = { en: string; fr: string }`, `Species.gender: Gender` required, `say()` without a fallback.

- [ ] **Step 1: Make the French required**

In `core/language.ts`:

```ts
/** One thing to say, in every Language. A Phrase missing one does not compile. */
export type Phrase = Record<Language, string>;

export function say(phrase: Phrase, language: Language): string {
  return phrase[language];
}
```

In `core/creature/species.ts`, `gender` loses its `?`, and the fallback entry of `species()` becomes `{ id: REFERENCE, label: { en: REFERENCE, fr: REFERENCE }, gender: "m", rarity: "common" }`.

- [ ] **Step 2: Run the type checker — this is the real test**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS. Every error it prints is a phrase or a Species left untranslated; fix each one and run again. Do not silence one with a cast.

- [ ] **Step 3: Simplify the test helper**

In `core/speech/__tests__/sayable.ts`, delete the `if (written === undefined) continue;` branch and the per-task `assert.ok(phrase.fr !== undefined, …)` checks added in Tasks 3–7: the type now carries that guarantee, and a test asserting what the compiler proves is noise.

- [ ] **Step 4: Run everything**

```bash
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
bun test view shell
./node_modules/.bin/tsc --noEmit
```

Expected: PASS everywhere.

- [ ] **Step 5: Write down the language**

In `CONTEXT.md`, rename the `## Language` heading to `## Glossary`, and add to the **Speech** subsection:

```markdown
**Language**:
The Language everything the user reads is said in: the Bubbles, the card,
the roster, the palette, the toasts, the dialogs. One per machine, chosen
from the palette or from `options.language`, never part of a Career. It
changes how something is said, never what is said or who says it: the same
occurrence of the same Cue draws the same phrase in both.
_Avoid_: tongue, locale, i18n, translation
```

In `IDEAS.md`, add the idea and mark it done, dated 2026-09-23, pointing at this spec. In `README.md`, document `options.language` beside `options.name` and the `tamago.language` command beside the others.

- [ ] **Step 6: Run the repository check**

Run: `./scripts/doctor.sh --quick` from the repository root.
Expected: PASS. It runs `tsc --noEmit` for this skill-adjacent TypeScript and checks that README links resolve.

- [ ] **Step 7: Commit**

```bash
git add -A .config/opencode/plugin/tamago
git commit -m "feat(opencode): require every phrase in both languages"
```

---

## Notes for the executor

- **Tasks 3, 4, 5 and 6 are independent** — same shape, different files, nothing shared. Run them in parallel if you are dispatching subagents.
- **Everything else is a chain.** Task 2 needs Task 1's types; Tasks 3–7 need Task 2's shape; Task 9 needs Task 8's tables; Task 10 needs Task 9; Task 11 needs all of them.
- **The English snapshots are the safety net for Tasks 2 to 9.** `git diff --stat -- view/__tests__/__snapshots__` printing nothing is a pass. Never accept a moved English snapshot to make a suite green.
- **A changed snapshot must be named in the commit message body** — the repository's rule.
- **The French is the part that needs a human's eye.** The shape is machine-checked; whether a Species still sounds like itself in French is not. Read the phrases aloud.
