# Tamago Sprite Engine: a 32 x 32 canvas, per-Species palettes, anchored expressions

Design of 2026-09-25. Closes the item dictated on 2026-09-17 and parked at the
end of idea 12 of `IDEAS.md`: "revoir les sprites et leur affichage dans la
barre latérale, dimensions comprises". The Sprite doubles in area, a Species
owns its colours and its expressions, and the engine stops decorating a shared
template.

Status: approved in brainstorm, not implemented. The implementation plan goes
to `docs/superpowers/plans/` once this spec is accepted.

## What already exists

- `core/appearance/pixels.ts`: `SPRITE_WIDTH` 21, `SPRITE_HEIGHT` 10,
  `PIXEL_HEIGHT` 20, the five-character `MAP_ALPHABET` `".oabc"`, `ROLE_OF`,
  `pack`, `paint`, `assertInside`.
- `core/appearance/bodies.ts`: `Body { pixels, eyes: [Rect, Rect], motion? }`,
  and `Maps`, one Body per grown Stage.
- `core/appearance/sprites.ts`: the shared `EGG`, `FACES` (one 3 x 3 pattern
  set per Activity), `SHUT`, `EYES` (one per Temperament), `HEART` at the fixed
  `HEART_AT`, `build`, the Frame `CACHE`, `periodOf`, `frameAt`, `heartFrame`.
- `core/appearance/marks.ts`: `MARK_SLOT` at `(0, 0)`, `BADGE_SLOT` at
  `(18, 0)`, both 3 x 3; `MARK` per Trait; `BADGE`; `markOf`.
- `core/appearance/motion.ts`: `Motion { tail?, ears? }`, `SWEEP`,
  `BLINK_EVERY`, `sweepAt`, `blinksAt`, `shift`.
- `core/appearance/palette.ts`: `MAP_ROLES`, `PAINTED_ROLES`, `Skin`,
  `Variant`, `Palettes`.
- `core/creature/catalog.ts`: `mapsOf`, `paletteOf(id, variant)`, `known`.
- `core/speech/bubble.ts`: `tailOffset`, which aims the tail at
  `SPRITE_WIDTH / 2`.
- `view/sprite.tsx`: `glyphOf`, `mixed`, `TINT`, the `Sprite` component;
  `view/portrait.tsx` centres it; `view/sidebar.tsx` (`SIDEBAR_WIDTH` 37) and
  `view/home.tsx` draw it; `view/card.tsx` draws it in the card and the roster.
- `shell/slots.tsx`: two registrations, `sidebar_footer` (single winner, order
  50) and `home_bottom` (additive, order 50).
- Twenty Species x four Stages = eighty maps, plus the shared egg.
- `scripts/preview.ts`, which renders any Species and Stage in a terminal.

## Decisions

1. **One canvas, 32 x 32 pixels, for everyone.** `SPRITE_WIDTH` and
   `PIXEL_HEIGHT` both become 32, so `SPRITE_HEIGHT` is 16 cells. There is no
   per-Body size: a single constant, as today, only larger.
2. **A map names palette indices, not Roles.** The alphabet becomes `.` for
   transparent and `0`-`9` `a`-`f` for the sixteen colours a Species may
   declare. `ROLE_OF` and the four map Roles go.
3. **One palette per Species, tuned for the dark theme.** `Variant`,
   `Palettes` and the whole light/dark pair go. `TINT` stays: mixing every
   colour of a list toward a theme colour works exactly as it did over a
   record.
4. **The egg keeps its own palette.** It is declared beside `EGG` in
   `sprites.ts` and is never the Species'. This closes a leak that exists
   today: `view/sprite.tsx` paints the egg with `paletteOf(species.id)`, so a
   duck's egg is yellow and a dragon's is green, against the rule written in
   `CONTEXT.md` ("every egg is the same") and against idea 12's abandoned
   Rarity-tinted egg ("l'oeuf ne révèle rien").
5. **A Body declares anchors; a Species declares expressions.** An anchor is a
   named point in a Body. An expression is a set of small patches, each pinned
   to an anchor, declared once per Species and reused by its four Bodies. This
   is what keeps the drawing load at eighty bodies plus twenty tables instead
   of eight hundred and eighty patches.
6. **`open` and `shut` are the only required expressions**; the other nine are
   optional and fall back to `open`. A Species is never broken for lacking
   one, and can be enriched later without touching the engine.
7. **A Body may ship whole extra frames; none must.** Where a drawn animation
   is worth its bytes, the Body lists further 32 x 32 maps and the existing
   cadence alternates over them.
8. **The engine keeps the mark, the badge and the heart.** They are theme
   colours, not Species art. The two 3 x 3 corners stay, at `(0, 0)` and
   `(29, 0)`, transparent in every map. The heart stops living at a hardcoded
   rectangle and is drawn from the `head` anchor.
9. **The bubble tail aims at `head`**, not at half the canvas width. A custom
   Sprite has no reason to keep its head in the middle.
10. **The home surface goes.** `home_bottom` is no longer registered and
    `view/home.tsx` is deleted. The plugin draws in the sidebar and in its own
    dialogs, nowhere else.
11. **The sidebar footer shows the Sprite alone.** The plugin keeps the
    `sidebar_footer` slot, because that is where the Sprite lives, and stops
    redrawing OpenCode's project line and version line inside it.
12. **The eighty existing maps migrate mechanically, once, by script.** No
    optional map, no `Partial`, no placeholder Species: the catalog stays
    total and every test passes from the first commit.
13. **The author redraws one Species per commit, in whatever order they
    choose.** No order is fixed here or anywhere in the repo.

## The canvas

```ts
export const SPRITE_WIDTH = 32;
export const SPRITE_HEIGHT = 16;
export const PIXEL_HEIGHT = 32;
```

A cell is still one pixel wide and two tall, drawn with `▀ ▄ █` and the space,
so the pixels stay square on screen. `pack` is unchanged beyond the constants.

## The alphabet and the palette

```ts
/** Transparent, then the sixteen palette indices. */
export const MAP_ALPHABET = ".0123456789abcdef";

/** What a pixel is: an index into the Species' Palette, or something the engine paints. */
export type Ink = number | "mark" | "badge" | "heart";

/** Up to sixteen lowercase `#rrggbb`, index 0 to 15. */
export type Palette = readonly string[];
```

`Cell` becomes `{ top: Ink | null; bottom: Ink | null }`, and `glyphOf` reads
it unchanged: it only ever compares the two and never looks at what they mean.

`M`, `G` and `H` stay reserved for `paint` and never appear in a hand-drawn
map. A character outside the alphabet still throws, naming row and column.

A Species declares one `palette: Palette`. Sixteen is the ceiling, and it is
the same number the import script and `pixler`'s `maxColors` are given, so the
constraint on the drawing and the constraint on the file are one constraint.

`Skin`, `Variant`, `Palettes`, `MAP_ROLES`, `PAINTED_ROLES` and `SKIN_ROLES`
are deleted. `paletteOf(id)` loses its `variant` parameter. `Role` survives
only as the three engine-painted names, folded into `Ink`.

## Anchors

```ts
export type Point = { x: number; y: number };

/** Named points of a Body. `head` is required: the heart and the bubble tail read it. */
export type Anchors = { head: Point; [name: string]: Point };

export type Body = {
  pixels: readonly string[];
  anchors: Anchors;
  frames?: readonly (readonly string[])[];
  expressions?: Partial<Expressions>;
  motion?: Motion;
};
```

`head` is a point on the face, not the top of the skull. Two things read it:
the heart occupies the five rows directly above `head.y` — rows `head.y - 5`
through `head.y - 1` — centred on `head.x`; the bubble tail aims at column
`head.x`. Every other anchor name is the Species' own business.

`eyes: [Rect, Rect]` is gone. A Species with one eye, three eyes or a visor
declares whatever anchors it needs and draws into them.

## Expressions

```ts
/** A patch pinned to an anchor: its top-left pixel lands on that anchor. */
export type Patch = { at: string; pixels: readonly string[] };

/** One look: everything redrawn for one beat. */
export type Look = readonly Patch[];

/** One or more Looks; the cadence alternates over them. */
export type Expression = readonly Look[];

export type ExpressionId =
  | "open" | "shut"
  | "thinking" | "working" | "waiting" | "hurt" | "sleeping"
  | "pet:cheerful" | "pet:sarcastic" | "pet:stoic" | "pet:dreamy";

/** `open` and `shut` are owed; the rest fall back to `open`. */
export type Expressions = { open: Expression; shut: Expression } & Partial<
  Record<Exclude<ExpressionId, "open" | "shut">, Expression>
>;
```

A patch is drawn in the Species' own palette, so an eye is as many colours as
the Species wants. `.` in a patch leaves the pixel below untouched, which is
what lets a patch be a rough rectangle around an irregular feature.

The mapping from what the engine knows to an `ExpressionId`:

| Engine state | Expression |
| --- | --- |
| `idle` | `open` |
| the blink beat, in any Activity but `sleeping` | `shut` |
| `thinking`, `working`, `waiting`, `hurt`, `sleeping` | the same id, else `open` |
| petted, by Temperament | `pet:<temperament>`, else `open` |

`thinking` has two Looks today and keeps them for the migrated Species. Any
Species may give any expression as many Looks as it likes.

A Body may carry `expressions?: Partial<Expressions>` to override the Species'
table where a Stage needs it — a hatchling whose eyes dwarf the adult's. It is
optional and merged over the Species' table, never instead of it.

## Frames, motion and the period

`Motion { tail?, ears? }` and `shift` are unchanged; the rectangles are just
declared in a larger canvas.

`periodOf` stops being a function of the Activity alone: the number of Looks
and the number of `frames` are now per Species and per Stage. It becomes
`periodOf(species, stage, activity)`, the least common multiple of the Look
count, the frame count, `SWEEP.length` and `BLINK_EVERY`. The Frame cache keeps
its shape; its keys simply range over a longer period.

## What the engine owns

`MARK_SLOT` stays `{ x: 0, y: 0, w: 3, h: 3 }`; `BADGE_SLOT` becomes
`{ x: 29, y: 0, w: 3, h: 3 }`. Both stay transparent in every map, and a test
still enforces it. `MARK` per Trait, `BADGE` and `markOf` are untouched.

`HEART_AT` is deleted. The heart is placed from `head`, as described above,
and `assertInside` rejects a `head` too close to an edge to hold it.

## Drawing surfaces

`view/home.tsx`, `view/__tests__/home.test.tsx` and its snapshot are deleted,
along with the `home_bottom` registration and `HOME_BOTTOM_ORDER` in
`shell/slots.tsx`. `Portrait` loses its `children` prop, which only the home
used, and its `variant` prop, which no longer exists. `Sprite` loses `variant`
too, and `theme.mode()` disappears from `card.tsx` and `sidebar.tsx`.

`SidebarView` keeps the slot and renders the Portrait alone: the `parent/name`
line and the `OpenCode <version>` line go, and `FooterInfo` with them. The
sidebar is 37 columns, so the 32-column Sprite is centred with a margin of 2.
Its height goes from 10 rows to 16, and from 13 to 19 with a bubble.

One consequence to record: the 2026-09-21 choices spec named the home as the
only permanent reminder of a pending Draw. The badge is drawn in the sidebar
too, which `shell/slots.tsx` already feeds, so the reminder survives as a
sidebar-only one.

`view/card.tsx` draws the Sprite in the card and, through `CardBody`, in the
roster. Both dialogs grow by six rows.

## The migration

One script, run once, rewrites the twenty Species files. For each Body:

- **Geometry.** The 21 x 20 map is placed in the 32 x 32 canvas at `x + 5`
  (centred, `floor((32 - 21) / 2)`) and `y + 12` (bottom-aligned,
  `32 - 20`). No scaling, so no deformation.
- **Palette.** The dark `Skin` becomes a five-entry palette in the order
  `outline, primary, secondary, accent, eye`, and the map characters `o a b c`
  become `0 1 2 3`. The light Skin is dropped.
- **Anchors.** Each eye `Rect` becomes an anchor, `left_eye` and `right_eye`,
  at its top-left corner plus the offset. `head` is `{ x: 15, y: 18 }`, which
  is exactly where the old heart and the old bubble tail were aiming.
- **Expressions.** Today's shared tables are written out per Species as
  patches in colour `4`, the eye colour: `FACES.idle` becomes `open`,
  `SHUT` becomes `shut`, each remaining `FACES` entry its own id,
  and each `EYES` entry a `pet:<temperament>`.

The result renders pixel for pixel like today, sitting on the floor of a
taller canvas with empty margins. That is the point: nothing regresses, the
un-redrawn Stages are obvious at a glance, and the author replaces them one
Species at a time.

The shared `EGG` migrates the same way and gains its own three-colour palette.

## The import script

`scripts/import.ts`, run by Node like `scripts/preview.ts`, never imported by
the plugin:

```
node scripts/import.ts <file.png> [--patch <anchor>]
```

It decodes a PNG, refuses anything that is not 32 x 32 (or, with `--patch`,
anything larger than the canvas), refuses more than sixteen distinct colours,
orders the palette by descending pixel count, and prints the `pixels` block and
the `palette` array to paste into the Species file. Printing rather than
rewriting keeps the script out of the business of parsing TypeScript.

The PNG decoder is written by hand on `node:zlib`, which is built in: this
project has no runtime dependencies and gains none. It supports 8-bit
non-interlaced RGB, RGBA and palette images, which is what every pixel editor
and `pixler` emits; anything else fails with a message naming the colour type.

`scripts/preview.ts` is updated to the new canvas and palette so a drawing can
be checked in a terminal before it is committed.

## What must be written

- Rewritten: `core/appearance/pixels.ts`, `bodies.ts`, `sprites.ts`,
  `palette.ts`; `core/creature/catalog.ts` (`paletteOf`); `core/speech/bubble.ts`
  (`tailOffset`); `view/sprite.tsx`, `view/portrait.tsx`, `view/sidebar.tsx`,
  `view/card.tsx`; `shell/slots.tsx`; `scripts/preview.ts`.
- Added: `scripts/import.ts`. The migration script is written, run, and
  deleted in the same commit that lands its output; only `import.ts` is kept.
- Deleted: `view/home.tsx`, `view/__tests__/home.test.tsx` and its snapshot;
  `FooterInfo` and the footer block of `view/sidebar.tsx`.
- Regenerated by the migration: the twenty files of `core/creature/species/`.
- Documentation: the `Sprite`, `Frame`, `Role`, `Palette` and `Skin` entries of
  `CONTEXT.md`, which gain `Anchor`, `Patch`, `Look` and `Expression` and lose
  `Role` and `Skin`; the appearance rules of `AGENTS.md`; the Sprite, home and
  layout paragraphs of `README.md`; in `IDEAS.md`, the four-surfaces list of the
  header, the parked item of idea 12, idea 10 (per-Species palettes are most of
  what it asked for), and idea 8, "Vue home enrichie", which this batch kills
  outright: there is no home left to enrich.

## Tests

- **Core, under `node --test`.** Every map is 32 rows of 32 characters, in the
  alphabet, with both corners transparent; every palette holds between 1 and 16
  colours and every index used by a map or a patch exists in it; every anchor a
  Species' expressions name exists in all four of its Bodies; every patch fits
  in the canvas from its anchor; every `head` leaves room for the heart; a
  `motion` rectangle holds its region alone. `periodOf` over a Species with two
  Looks and three frames. The expression fallback: a Species with only `open`
  and `shut` renders every Activity.
- **Views and shell, under `bun test view shell`.** The five snapshot files
  change, and the commit must name them. `home.test.tsx.snap` is deleted, not
  updated.
- **Types.** `tsc --noEmit` stays the gate. `Expressions` requiring `open` and
  `shut` is what makes a Species with neither a compile error; the anchor
  names, being strings, are covered by the catalog test instead, which is a
  deliberate trade of a compile error for a test failure in exchange for a
  Species being free to name its own features.

## Out of scope

Loot and accessories worn on the Frame (glasses, hats, badges) — the anchors
this spec introduces are what they will hang from, but nothing here draws one.
Per-Stage canvas sizes. A light-theme palette. Any redraw: this batch changes
the engine and migrates the existing art unchanged, and the first hand-drawn
32 x 32 Species is its own commit afterwards.

## Risks

- **The sidebar is six rows taller and nobody has seen it.** 19 rows with a
  bubble, in a 37-column sidebar. The first thing to do after the engine lands
  is look at it on a real screen; the dial, if it is too much, is the canvas
  height, and it is one constant.
- **512 cells instead of 210.** `view/sprite.tsx` builds two memos per cell, so
  a Sprite goes from 420 to 1024 of them. The September perf pass measured that
  tamago has no latency problem; the same method is run again once the engine
  lands, and the exit, if it bites, is to merge runs of identical style into one
  span per run rather than one per cell.
- **The migration script is the whole catalog in one commit.** It runs once,
  its output is reviewed as a diff, and its correctness is visible: any Species
  that renders differently from today is a bug in the script, and
  `scripts/preview.ts` shows it before the commit.
