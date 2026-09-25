# AGENTS.md — opencode-tamago

Shared TypeScript rules and the toolchain landmine live in the repository
AGENTS.md. Vocabulary lives in `CONTEXT.md`; use those terms.

## Rules

- `core/` is pure data and strings, tested with `node:test`. `adapter/` is the
  only layer that reads SDK event shapes or touches the disk. `shell/` is the
  only layer that touches `api.*` and timers, one module per loop or surface
  (`mirror`, `tick`, `flush`, `actions`, `dialogs`, `palette`, `slots`);
  `index.tsx` only wires them. Views take plain props (the Solid compiler
  makes each a getter, so `props.x` read in JSX is reactive) and return JSX.
- A dialog of our own reads its keys with `useKeyboard` from `@opentui/solid`;
  the key → action table lives in `core/roster/` (`ROSTER_KEYS`), tested, so a key
  taken by OpenCode is a one-line change there, never in the view.
- Moving a Session (`transition`) and counting XP (`count`) are separate pure
  functions; an event may move several Sessions but is counted once.
- What an event, a tick, a flush or a palette command does to the Window is a
  pure function in `core/window.ts`, tested. `shell/mirror.ts` only feeds it,
  mirrors the result into signals and performs the returned effects (toast,
  palette refresh). New behavior goes in the reducer, not in the shell.
- Child (subagent) sessions never move a Session. Their work counts, their
  prompts do not.
- Stage, Growth, and anything else derived from counters, is computed, never
  stored. Anything that decides a Stage takes a `Paced` (counters plus
  Species), never bare counters.
- Errors never change XP.
- Every map is 20 rows of 21 characters of `.oabc`, and only colour: the eyes,
  what moves, the Trait mark and the Draw badge are rectangles declared beside
  it. A Species' colours are its Palette, two variants, written in
  hexadecimal in the Species file; `core/` may name a colour there, and a
  theme key for a Trait's mark (`core/appearance/marks.ts`'s `ThemeColor`),
  but it never resolves one to an actual colour value — that happens once,
  in `view/`.
- A `motion` rectangle (a tail, or an ears) must be at least 2 pixels wide, so
  `shift()` has a column to move its content into; its content must not sit
  flush against the edge it shifts toward, since `shift()` drops any pixel
  whose destination lands outside the rectangle's own width; and it must
  bound a genuinely isolated, movable part of the drawing, never traced over
  shared static art, since `shift()` moves every opaque pixel inside it,
  ear or ridge alike. `sprites.test.ts` checks the first two for every
  declared rectangle and every beat it actually uses; the third is a call to
  make at the drawing board, since no test can tell a real ear from a
  coincidence.
- Every handler is wrapped by `guard`: the TUI never crashes because of this
  plugin.
- Counters only grow; `merge` stays commutative and preserves `hatchedAt` and
  `species`. A Species is drawn once, in `freshCareer`, and never recomputed.
- A new Career field is listed in `CAREER_KEYS` (a plain counter in
  `COUNTER_KEYS`), or the build fails. The store carries any key it does not
  know verbatim, so an older build still running never erases a newer one's
  data.
- The active Career lives in `career.json`, resting ones in
  `roster/<hatchedAt>.json`, one lock for all. A Delta is flushed to the
  Career it was earned under, the active one when that Career is not on disk.
  The Roster never shrinks: the plugin never deletes a Career file.
- Weights and thresholds are tuned in the `core/career/stage.ts` tables, not in code paths.
- Timings and counts that a Stat sets are read from a `Behavior`, never from
  a constant, in `transition`, `speak` and `cadence`; `MEDIAN` in
  `core/creature/behavior.ts` holds the values, and every function that takes a
  Behavior defaults to it. The Sheet is derived like the Stage: never
  stored, never cached in the Window.
- Views read a `Tamago` (`core/tamago.ts`), never a bare Career: everything
  derived from a Career is derived there, once, and passed down as one
  prop. A new derived attribute is a new field of `Tamago`.
- A new Species is one entry in `core/creature/species/<rarity>.ts`: id, label,
  Rarity, Modifiers, four maps, a Palette in both variants and a full
  Signature. A missing map, Palette or Signature does not compile; the order
  of the entries is the draw order and never changes once shipped. The rarity
  weights live in `core/creature/luck.ts`, never in the Species files.
- The voice never picks a phrase by rotation or by `Math.random`: `phrase`
  seeds from the hatch date, the Cue and its count, so every window agrees for
  the same occurrence of the Cue.
- Every phrase the user reads lives in core/text/, by surface, tested; a view
  or the shell never holds a literal phrase or sentence (a key name or the
  OpenCode brand mark is not one). The palette titles never carry the Name.

## Verify

`node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"` for the
core and the adapter, `bun test view shell` for the views and the shell (Bun
compiles the Solid JSX; the frames are snapshots under `__snapshots__/`, and a
changed snapshot is named in the commit), and `./node_modules/.bin/tsc --noEmit`.
Then launch OpenCode once for anything the snapshots cannot see: colors, the
dialog stack, two instances side by side for persistence changes.

## Scope

`IDEAS.md` is a backlog, not a decision; a retained idea gets a design spec
first. No penalties, no death, no reading of prompt content, no network.
