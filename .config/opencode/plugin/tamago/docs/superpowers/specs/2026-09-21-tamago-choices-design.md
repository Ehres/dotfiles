# Tamago Choices: Milestones, Draws, Picks and Traits

Design of 2026-09-21. Closes idea 11 of `IDEAS.md` and the Direction of
`CONTEXT.md`: at a Milestone the Tamago offers a Draw, the user keeps one
Trait, and the Pick marks the creature durably on its three surfaces.

Status: approved in brainstorm, not implemented. The implementation plan goes
to `docs/superpowers/plans/` once this spec is accepted.

## What already exists

The foundations landed on 2026-09-15 with empty tables and no runtime path:

- `Career.picks` and `Delta.picks`, merged by `first`/`firstPicks` so the
  earliest Pick per Milestone wins across windows (`core/career/pick.ts`).
- `core/choices/milestone.ts`: `Milestone`, `measure`, `isReached`, `reached`,
  and an empty `MILESTONES`.
- `core/choices/trait.ts`: `Trait`, `traits`, `eligible`, and an empty
  `TRAITS`.
- `core/choices/draw.ts`: `DRAW_SIZE` of three, the deterministic `draw`
  (FNV-1a on `hatchedAt:milestone`, mulberry32, Fisher-Yates) and `pending`.

Nothing in `shell/`, `view/` or `core/window.ts` reads any of it today.

## Decisions

1. **The Milestones are the four Evolutions.** No counter Milestone in this
   batch; the table form that supports them stays untouched.
2. **A Draw is announced, never forced.** A Bubble speaks it, a permanent
   badge remembers it, and the user opens the choice from the palette. No
   modal ever opens by itself.
3. **Six Traits, three families of two**, the second of each family gated by
   `needs` on the first. Six is enough: the Draw cuts to three, and the fourth
   Milestone still finds two eligible candidates.
4. **Every Pick marks the Sprite**, whatever its family, so the third surface
   is universal instead of being a family of decorative Traits. The mark is
   one character overlaid on the finished Frame at a fixed cell.
5. **A Trait takes its Cues.** On a Cue a held Trait declares, that Trait
   always speaks: the Species and the Temperament stay silent there.
6. **`choice` is a full thirteenth Cue**, covered by the twenty Signatures,
   the four Temperaments and the neutral table. The Cues a Trait opens live in
   a separate union, spoken by that Trait alone, so no Species owes them a
   phrase.

## The Milestone table

```ts
export const MILESTONES: readonly Milestone[] = [
  { id: "evolution:hatchling", stage: "hatchling" },
  { id: "evolution:young", stage: "young" },
  { id: "evolution:adult", stage: "adult" },
  { id: "evolution:elder", stage: "elder" },
];
```

Table order is the order pending Draws are offered in, which is Stage order.
A Career that grew while OpenCode was closed can cross two Stages at once: the
queue then holds two Draws and the command offers the first. Nothing is lost,
since a Milestone without a Pick stays pending forever.

## The Trait table

Each family is a parent and a child; the child needs the parent. Each Trait
carries a mark and either takes existing Cues or opens new ones.

| Trait | Needs | Mark | Effect |
| --- | --- | --- | --- |
| `hardy` | none | `+` | Takes `streak` and `retried`: it shrugs the rough patches off. |
| `unshaken` | `hardy` | `#` | Takes `denied` and `long_work`. |
| `proud` | none | `*` | Takes `todos_done` and `big_diff`. |
| `boastful` | `proud` | `^` | Takes `evolved` and `granted`. |
| `watchful` | none | `:` | Opens `branch` and `worktree`: it sees the repository move. |
| `restless` | `watchful` | `~` | Opens `stir`: it feels files change outside the session. |

The eligibility arithmetic over four Picks: the first Draw offers the three
parents; every later Draw loses the Pick and may gain that parent's child. The
worst line leaves two candidates at the fourth Milestone, and a Draw of two is
what the glossary means by "two or three Traits". No line is ever empty.

Where each table lives follows the repository's rule, tune-here-never-in-code:
`TRAITS` in `core/choices/trait.ts` says only what exists and what it needs;
the marks live in `core/appearance/`; the phrases and the Cues taken or opened
live in `core/speech/`.

## Derivation

`core/tamago.ts` derives everything a view reads from a Career once, so it
gains two keys:

- `traits: TraitId[]`, the held Traits in Pick order, from `traits(career)`.
- `choices: Pending[]`, the queue of Draws awaiting a Pick, from
  `pending(career)`.

The badge is `choices.length > 0`. The Sprite mark is the mark of the most
recent Pick, since a single cell is free.

`Speaker` gains `traits: readonly TraitId[]`, filled by `speakerOf(career)`.
The Voice already receives the Speaker, so nothing else threads Traits down.

## Speech

### A Trait takes a Cue

`core/speech/accent.ts` holds one entry per Trait: the Cues it takes, the Cues
it opens, and its phrases for each of them. `pool()` in `register.ts` consults
the held Traits before drawing a Register: if a held Trait takes this Cue, its
phrases are the pool and no Register is drawn. Two held Traits taking the same
Cue cannot happen with this table, but the rule is fixed anyway: the most
recent Pick speaks, so a new choice is heard.

### The `choice` Cue

`choice` joins the `Cue` union, so `Signature`, `FLAVOR` and `PHRASES` must
cover it or the build fails. It is raised on `session_idle` while a Draw is
pending, never on the Evolution itself: the `evolved` Bubble keeps the
metamorphosis, and `choice` speaks at the first calm that follows, which is
usually seconds later. Its tuning is priority 2 and a cooldown of one hour:
the spoken reminder is rare on purpose, because the badge after the Name is
the permanent one and a Draw may sit pending for days without being a debt.

`speak()` cannot see the Career, so it takes one more argument, `awaits`, a
boolean computed once per event in `core/window.ts` from `pending(career)`.
Pure, cheap over four Milestones, and testable on its own.

### The Cues a Trait opens

```ts
export type TraitCue = "branch" | "worktree" | "stir";
export type AnyCue = Cue | TraitCue;
```

`CUES` keeps its shape over `Cue`; a parallel `TRAIT_CUES` holds the tuning of
the three, and `Bubble.cue` widens to `AnyCue`. `Signature` stays
`Record<Cue, Phrases>`, untouched.

Three events join `TamagoEvent`, counted by nothing, addressed to every
Session: `branch_changed`, `worktree_ready`, `files_stirred`. `listen()` only
raises their Cue when the Speaker holds the Trait that opens it, so the gate
stays in the core and the translator stays dumb.

`adapter/translate.ts` subscribes to `vcs.branch.updated`, `worktree.ready`
and `file.watcher.updated`. The branch event carries the current branch and
can arrive at startup, so the translator remembers the last branch it saw and
emits only on a change; the first value of a run is silent. `worktree.failed`
is deliberately ignored: no Trait is a punishment.

## Appearance

`core/appearance/marks.ts` holds `MARK: Record<TraitId, string>` and the
function that picks the mark of the most recent Pick.

The mark is overlaid on the finished Frame at line 0, column 0. That cell was
verified free for the twenty Species across the five Stages, and a test in the
catalog keeps it that way, so no `Body` is reopened and the Frame stays a list
of monochrome strings. The mark takes the colour of the body; a mark with its
own colour needs the Frame in typed segments, which stays deferred with ideas
4 and 10.

`frameAt` takes the mark as an argument and the Frame cache keys on it, so the
memo in `view/sprite.tsx` still receives the same reference for the same frame
and a tick that changes nothing re-renders nothing.

## Shell and views

- **A seventh palette command**, `tamago.choose`, titled "choose a trait". Its
  description carries how many Draws await, and the palette re-registers when
  that number changes, as it already does after a rename or a Switch.
- **The dialog** is `api.ui.DialogSelect`, one option per Trait of the first
  pending Draw: the Trait's name as the title and what it changes as the
  description. Confirming calls the new action; escaping leaves the Draw
  pending.
- **The Pick is a Delta**, exactly like a rename: `pick(window, milestone,
  trait, now)` shows it at once, the flush writes it, and the earliest Pick
  wins if two windows choose at the same time. A Pick naming an unknown Trait
  or a Milestone already picked changes nothing.
- **A stale dialog closes.** The dialog body reads the mirror, so when another
  window's Pick arrives through `adopt` and empties the queue, the dialog
  closes and a toast says the choice was made elsewhere.
- **The badge** is a coloured mark after the Name, in `view/sidebar.tsx` and
  `view/home.tsx`. It is the only permanent reminder; the Bubble is the spoken
  one.
- **The card** lists the held Traits, which closes the loop the user opened at
  the first Milestone.

## What must be written

The writing is the bulk of the batch and cannot be cut without giving up that
every Species announces the choice in its own words:

- `choice`, twenty-five groups of phrases: one per Species Signature, one per
  Temperament, one neutral.
- The Traits, eleven groups: two each for `hardy`, `unshaken`, `proud`,
  `boastful` and `watchful`, one for `restless`.

Every phrase is English, at most `MAX_TEXT` characters, and the existing
coverage tests enforce both.

## Tests

- **Core, under `node --test`.** The four Milestones and their order; the
  eligibility of the six Traits over four successive Picks, including the
  worst line; the Pick Delta and its commutativity; a Trait taking a Cue; the
  gate that keeps an unheld Trait's Cue silent; the mark of the most recent
  Pick; the free overlay cell for every Species and Stage; the translator's
  rule that the first branch of a run is silent.
- **Views and shell, under `bun test view shell`.** The badge after the Name
  in the sidebar and on the home, the mark on the Sprite, the Draw dialog, and
  the dialog closing when another window picked first. These snapshots change
  and the commit must name them.
- **Types.** `tsc --noEmit` stays the gate, and `Signature` unchanged is what
  makes a Species missing its `choice` phrase a compile error.

## Out of scope

Counter Milestones and event Milestones with their `reached` map; the Frame in
typed segments, coloured marks and accessories; achievements, streaks and the
daily journal. The table forms that support them are already in place and this
batch does not move them.

## Risks

- The twenty-five `choice` phrase groups are mechanical but long, and a weak
  one is worse than none. Writing them Species by Species, beside the
  Signature they join, keeps each in voice.
- `vcs.branch.updated` may prove chattier than expected in real use. The
  change-only rule and the Cue cooldown are the two dials; only use tells.
