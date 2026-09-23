# Tamago Language: what the creature is read in

Design of 2026-09-23. Adds a Language to the plugin: everything the user
reads — Bubbles, card, roster, palette, toasts, dialogs, moods — is said in
English or in French, chosen by the user.

Status: approved in brainstorm, not implemented. The implementation plan goes
to `docs/superpowers/plans/` once this spec is accepted.

## What already exists

- Every phrase the user reads lives in one of four places:
  `core/speech/phrases.ts` (the neutral Register and the four Temperament
  Registers), the `signature` of each entry in
  `core/creature/species/<rarity>.ts` (20 Species), `core/speech/accent.ts`
  (6 Traits), and `core/text/` (card, commands, dialogs, mood, roster,
  toasts, traits).
- `phrase()` in `core/speech/register.ts` draws a Register, then a phrase,
  from a seed built on `hatchedAt` and `voice:<cue>:<times>`. Every window of
  the machine agrees on the result; nothing is stored.
- `MAX_TEXT` is 24 characters, enforced by test, so a Bubble never wraps in
  the sidebar.
- `Window.muted` is the precedent for a user preference: it lives on the
  Window, is mirrored into a signal, is persisted through `api.kv` under
  `tamago.muted`, is toggled from the palette, and clears every Bubble when
  it changes.
- `options.name` is the precedent for a plugin option read at startup.

## Decisions

1. **One Language per machine, never per Career.** Two Tamago of the Roster
   do not speak two languages. It is a user preference, not a property of the
   creature, so it never touches the Career and never touches the disk.
2. **The Language changes how something is said, never what is said or who
   says it.** The same occurrence of the same Cue draws the same index in
   both languages. Switching does not reroll.
3. **The word is `Language`.** Not tongue, not locale, not i18n. The glossary
   section of `CONTEXT.md` currently carries that title; it is renamed
   `Glossary`, and `Language` becomes an entry in it like any other.
4. **French is written, not translated.** Each Species keeps its voice, and
   `MAX_TEXT` stays 24 in both languages: a French phrase that does not fit
   is rewritten, never widened.
5. **Grammar lives in the function that needs it.** No pluralization engine,
   no dependency: the repo has none and this is not where that starts.
6. **Agreement is a French-only fact**, so it lives on the French side of the
   two tables that need it.
7. **The allowed character set is per Language.** English phrases stay
   printable ASCII, as the current test demands. French adds the letters it
   cannot do without, and nothing else.

## The type

`core/text/`, `core/appearance/` and `core/window.ts` all need the Language,
and none of them may import from `core/speech/`. So it lives at the root of
`core/`, beside `window.ts` and `tamago.ts`:

```ts
// core/language.ts
export type Language = "en" | "fr";
export const LANGUAGES: readonly Language[] = ["en", "fr"];

/** One thing to say, in every Language. */
export type Phrase = Record<Language, string>;

/** At least one Phrase; a test bounds each string of each Language to MAX_TEXT. */
export type Phrases = readonly [Phrase, ...Phrase[]];
```

`Phrases` keeps its name and its shape. Only its element changes, from
`string` to `Phrase`. Because the two languages sit in the same object, the
pools cannot drift in length, and a Species missing its French does not
compile — the same guarantee a missing body already gives.

In the tables:

```ts
// core/creature/species/common.ts
signature: {
  permission: [
    { en: "Mrow? May I?",    fr: "Miaou ? Je peux ?" },
    { en: "Paw on it. Yes?", fr: "Patte dessus. Oui ?" },
    { en: "Say yes, human.", fr: "Dis oui, humain." },
  ],
  ...
}
```

## The character set

`core/speech/__tests__/phrases.test.ts` asserts today that every phrase
matches `/^[\x20-\x7e]+$/` — printable ASCII. French cannot live under that
rule, so the rule becomes per Language:

```ts
const ALLOWED: Record<Language, RegExp> = {
  en: /^[\x20-\x7e]+$/,
  fr: /^[\x20-\x7eÀ-ÿŒœ]+$/,  // + Latin-1 letters, Œ and œ
};
```

Two things must hold for the rest of the plugin to keep working, and both are
tested:

- **NFC, always.** `MAX_TEXT` and `bubbleBorders` both measure `text.length`,
  so a combining sequence (`e` + U+0301) would count two units and draw a
  bubble one column too wide. Every phrase must equal its own
  `normalize("NFC")` form, where `é` is one unit and one column.
- **No character wider than one column.** The Latin-1 letters and `œ` are all
  single-width, so the sprite and the bubble keep their geometry.

Non-ASCII rendering itself is not new: the card already prints `·` and the
choice badge is `★`.

## How the change lands

Widening `Phrases` from `string` to `Phrase` is atomic: the moment the
element type changes, all eight tables that hold phrases stop compiling. A
thousand French phrases in one reviewable step is not a step.

So the French is optional **while the change lands, and only then**:

```ts
export type Phrase = { en: string; fr?: string };   // during the migration
export function say(p: Phrase, language: Language): string {
  return p[language] ?? p.en;
}
```

The same for the two fields the Species gains: `label` widens to a `Phrase`
and `gender` arrives optional. Each table is then filled in its own step,
green at every point, with French mode simply still reading English wherever
it has not been written yet.

The **last** step makes `fr` and `gender` required and deletes the `?? p.en`
fallback. Every phrase left untranslated becomes a compile error at that
moment: the completeness of the work is proved by the type checker, not by a
reviewer's attention.

## Where the Language is decided

Three layers, first match wins:

1. `api.kv` under `tamago.language`: the override, written by the palette
   command, exactly the `tamago.muted` precedent. Once the user has chosen in
   the TUI, that choice wins over the config file — otherwise the command
   would appear to do nothing on the next start.
2. `options.language` in `opencode.json`, beside `options.name`: the default
   until the user chooses, versioned with the user's dotfiles.
3. `"en"`.

A value that is not a `Language`, from either layer, falls through to the
next one silently — the core never throws.

`tamago.language` opens a `DialogSelect` listing the Languages, each written
in its own language ("English", "Français"). A toggle would be shorter with
two, but a select is the shape that survives a third.

## Where the Language is read

`Window` gains a `language` field beside `muted`:

```ts
export type Window = { career; pending; sessions; voices; muted; language };
export function freshWindow(career, muted = false, language: Language = "en"): Window;
export function setLanguage(window: Window, language: Language): Window;
```

`setLanguage` clears every Bubble on screen, as `setMuted` does: a phrase
already shown is in the old language, and keeping it would be a visible bug.

`shell/mirror.ts` mirrors it into a signal (`language: Accessor<Language>`)
and `commit` sets it when it changed, like every other part.

Views read it through a context, the twin of `ThemeProvider`:

```tsx
// view/language.tsx
export function LanguageProvider(props: { language: Language; children: JSX.Element }): JSX.Element;
export function useLanguage(): Accessor<Language>;
```

Posted at every root the shell renders, so no view threads a language prop.
`shell/`, `index.tsx` and the dialogs read `mirror.language()` directly.

**The palette must be re-registered when the Language changes.** Command
titles and descriptions are fixed at registration — that is why
`palette.register()` is already called on a rename and on a Pick. Without it,
the palette stays in the old language until the next rename.

## Speech

`phrase()` gains a `language` parameter and changes one line:

```ts
export function phrase(cue, speaker, times, language: Language, table = ACCENT): string | undefined {
  ...
  return own[index]?.[language] ?? own[0][language];
}
```

The seed, the domain `voice:<cue>:<times>`, the Register shares, the weighted
Temperament draw and the uniform phrase draw are untouched. `speak()` in
`core/speech/voice.ts` threads the parameter through; `core/window.ts` passes
`window.language`.

`accentFor` and `opensCue` do not change at all: they return `Phrases`, whose
element type moved under them.

## Interface text

`core/text/` goes from constants to functions taking the Language explicitly.
Explicitly, not through an ambient value: the core stays pure and every text
function stays testable without a context.

### Three new tables

Identifiers serve as displayed text today; they gain a display table:

| Table | Covers | French | Agrees |
|---|---|---|---|
| `STAGE_TEXT` | `StageId` | œuf, nouveau-né, jeune, adulte, ancien | yes |
| `RARITY_TEXT` | `Rarity` | commun, peu commun, rare, épique, légendaire | yes |
| `STAT_TEXT` | `BehaviorStat` | énergie, bavardage, sensibilité, patience | no |
| `TEMPERAMENT_TEXT` | `Temperament` | enjoué, sarcastique, stoïque, rêveur | no |
| `CRAFT_TEXT` | `Craft` | scribe, mécano, érudit — each with its gender | no |
| `STANCE_TEXT` | `Stance` | prudent, audacieux | with the Craft |

The last three exist because `describe()` renders `"cheerful · bold shell"`
from three identifiers. It lives in `core/creature/character.ts` today, which
contradicts the rule that every phrase the user reads lives in `core/text/`;
it moves to `core/text/character.ts` with this change, since it is being
touched anyway. `core/creature/character.ts` keeps `craft`, `stance`,
`vocation` and `temperament` — the deriving, not the wording.

### Agreement

"Commun" becomes "commune" after *chouette*; "ancien" becomes "ancienne".
English agrees with nothing. So the two gendered tables carry both forms on
their French side only, and one helper in `core/text/word.ts` reads them
(`Gender` itself lives with the Species, in `core/creature/species.ts`):

```ts
export type Gender = "m" | "f";
/** French agrees in gender, English does not. */
type Agreed = { m: string; f: string };
export type Word = { en: string; fr: Agreed };

export function word(w: Word, language: Language, gender: Gender): string {
  return language === "en" ? w.en : w.fr[gender];
}

const RARITY_TEXT: Record<Rarity, Word> = {
  common: { en: "common", fr: { m: "commun", f: "commune" } },
  rare:   { en: "rare",   fr: { m: "rare",   f: "rare" } },   // invariable, said anyway
  ...
};
```

`STAGE_TEXT` has the same shape. `STAT_TEXT` does not: a Stat label stands
alone and agrees with nothing.

### The Species

`SpeciesDef` gains a gender, and its label becomes a `Phrase`:

```ts
export type Species = { id: SpeciesId; label: Phrase; gender: Gender; rarity: Rarity; sheet?: Modifiers };
```

A Species missing either does not compile. The fallback entry of `species()`
becomes `{ id: REFERENCE, label: { en: REFERENCE, fr: REFERENCE }, gender: "m", rarity: "common" }`,
so a Species this build does not know reads as the reference, masculine.

### Grammar

Each text function switches on the Language and writes each language's
grammar in full:

```ts
export function age(hatchedAt: number, now: number, language: Language): string {
  const days = Math.max(0, Math.floor((now - hatchedAt) / DAY_MS));
  switch (language) {
    case "en": return days === 0 ? "hatched today" : days === 1 ? "1 day old" : `${days} days old`;
    case "fr": return days === 0 ? "éclos aujourd'hui" : days === 1 ? "1 jour" : `${days} jours`;
  }
}
```

The same treatment for `progress`, `speciesLine`, `reveal`, `sheetLines`,
`traitLines`, `blocked`, `stepsIn`, `line`, `command`, the toasts and the
dialogs. `ESC_HINT` and `CHOICE_BADGE` stay as they are: `esc` is a key name
and `★` is not a word.

Two consequences not to miss:

- `LABEL_WIDTH` in `core/text/card.ts` aligns the Stat bars on the longest
  label. It is computed **per Language**, or the French bars do not line up.
- `reveal` picks its article from the gender in French (`un chat`,
  `une chouette`) and from the first letter in English (`a cat`, `an owl`).
- `fmt()` in `core/appearance/format.ts` groups thousands through
  `Intl.NumberFormat("en-US")`, so the card reads `2,147 xp`. It gains the
  Language and groups with a plain space in French — `2 147 xp`. Deliberately
  a plain `U+0020` rather than the narrow no-break space `fr-FR` would give:
  it keeps the ASCII rule, it stays one column, and it cannot drift when
  Node's ICU data changes under the tests.
- `blocked` and `stepsIn` need their own French phrasing rather than a slot
  filled with `STAGE_TEXT`: "encore un œuf" takes an article where "encore
  jeune" does not. Writing both branches in full is the point of the switch.

## What must be written

Roughly 1 000 phrases of French, plus the interface:

| Where | Count |
|---|---|
| 20 Signatures (`core/creature/species/<rarity>.ts`) | 20 × 13 Cues × ~3 |
| `FLAVOR` (`core/speech/phrases.ts`) | 4 Temperaments × 13 × 3 |
| `PHRASES` (`core/speech/phrases.ts`) | 13 × 3 |
| `ACCENT` (`core/speech/accent.ts`) | 6 Traits × ~2 Cues × 3 |
| `core/text/` | ~50 strings and three tables |

## Tests

- **The coverage tests loop over `LANGUAGES`**: length ≤ `MAX_TEXT`, the
  allowed character set of that Language, NFC form, the totality of each
  Signature over `Cue`, and the `takes`/`opens` ↔ `phrases` agreement of each
  Accent. A 27-character French phrase fails the build like an English one.
- **Every Species declares a gender**: the type already requires it; the test
  covers the fallback entry.
- **The English snapshots must not move by a byte.** Going from `string` to
  `Phrase` changes no English output, so the five files under
  `view/__tests__/__snapshots__/` are the proof that a change touching a
  thousand lines preserved behaviour. French cases are then added for the
  three surfaces that carry text: card, roster, sidebar.
- New unit tests: the three-layer resolution of the Language (option, kv,
  fallback, and an unknown value falling back silently), `setLanguage`
  clearing the Bubbles, `word()` over both languages and both genders, and
  `phrase()` returning the same index in both languages for one occurrence.

The verification commands do not change:

```bash
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
bun test view shell
./node_modules/.bin/tsc --noEmit
```

Nothing in `doctor.sh` changes: this lives inside the plugin.

## Out of scope

- A third Language. The types make room for one — adding it to `Language`
  turns every table that lacks it into a compile error — but no table carries
  one, and nothing here is written to make the third cheap.
- Translating the creature's Name, the Species ids, the Trait ids, the
  Milestone ids or anything else persisted: identifiers are not text.
- Detecting the Language from `$LANG`. The user asked for a choice.
- Per-Career or per-project Languages.

## Risks

- **`MAX_TEXT` at 24 is tight in French.** French runs about 15 % longer, so
  some Cues will need a different phrase rather than a translation. That is
  the intended pressure, but it will make a handful of Signature lines hard.
  Mitigation: the test fails at write time, not at runtime, and the phrase is
  rewritten then.
- **The diff is large and mostly mechanical**, which is where review attention
  fades. Mitigation: the English snapshots must not move, so the mechanical
  part is machine-checked; reviews concentrate on the French.
- **The gender field lands on 20 existing entries.** It is a compile error
  until all 20 have one, so the batch cannot be half-applied.
