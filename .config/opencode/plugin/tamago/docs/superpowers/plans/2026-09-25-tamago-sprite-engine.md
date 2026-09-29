# Tamago Sprite Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Sprite to a 32 x 32 canvas where a Species owns its palette, its anchors and its expressions, with the twenty existing creatures migrated unchanged so they can be redrawn one at a time afterwards.

**Architecture:** Three mechanical migrations in sequence, each one landing green, instead of one rewrite that breaks the catalog. First the surfaces shrink (the home goes), then the canvas grows with every map re-framed inside it, then map characters become palette indices, then eye rectangles become anchors carrying per-Species expression tables. Each migration ships a throwaway script that rewrites the twenty Species files textually and is deleted in the same commit.

**Tech Stack:** TypeScript under Node's native type stripping (no build step, no runtime dependencies), Solid via `@opentui/solid`, `node:test` for core and adapter, `bun test` for views and shell, `node:zlib` for the PNG import.

**Spec:** `docs/superpowers/specs/2026-09-25-tamago-sprite-engine-design.md`

## Global Constraints

- **No runtime dependencies.** `node_modules` holds devDependencies only; nothing under `core/`, `view/`, `shell/`, `adapter/` or `scripts/` may import one.
- **Erasable syntax only.** No `enum`, no `namespace`, no constructor parameter properties. `import type` for every type-only import, and an explicit `.ts` / `.tsx` extension on every relative import.
- **Three gates before any commit:** `pnpm test` (core and adapter, `node --test`), `pnpm test:view` (`bun test view shell`), `./node_modules/.bin/tsc --noEmit`.
- **The baseline is two tests red, on purpose.** `bun test view shell` fails `"the card at four held Traits…"` and `"the roster at two Careers…"` on this branch before any of this work: commit `4d42a8e` added them deliberately red to pin a dialog overflow whose real size "is the user's to measure against the running TUI". The gate is therefore **these two and no others** — 40 pass, 2 fail. A third failure is yours. Never make these two pass by enlarging the `DIALOG` fixture: that hides the defect they exist to record.
- **A changed snapshot is named in the commit message.** Snapshots live in `view/__tests__/__snapshots__/`.
- **`core/` is total and never throws at render.** A mistuned table makes the creature silent; it never kills the window's event pipeline. Validation that would throw belongs in a catalog test, not in a render path.
- **Commit messages are Angular, lowercase, imperative, no trailing period**, scope `opencode`: `feat(opencode): …`, `refactor(opencode): …`, `test(opencode): …`, `docs(opencode): …`.
- **Canvas constants, after Task 2:** `SPRITE_WIDTH` 32, `SPRITE_HEIGHT` 16, `PIXEL_HEIGHT` 32. Palette ceiling: 16 colours. `MARK_SLOT` `{x:0,y:0,w:3,h:3}`, `BADGE_SLOT` `{x:29,y:0,w:3,h:3}`.
- **Migration offsets, used by every re-framing step:** `x + 5` (`floor((32 - 21) / 2)`), `y + 12` (`32 - 20`). The migrated `head` anchor is `{x: 15, y: 18}`.

### Before Task 1

The worktree has no `node_modules`. Run `pnpm install` **in `.config/opencode/plugin/tamago`**, which is its own package with its own lockfile. Never run a package manager in `.config/opencode` itself: doing so once wiped that directory's `node_modules` and broke the user's language servers.

## Review Focus

Five things the spec implies and no task's happy path exercises. Each one's test is written into the task that owns the code.

- **A map character with no colour behind it.** A Species hand-edited down to six colours while a map still writes `7` must fail the catalog test by name, not render a pixel with `undefined` for a colour. *Task 3.*
- **A patch that runs off the canvas from its anchor.** An eye patch pinned near the right edge must be rejected by name at the catalog test, not silently clipped or thrown at render. *Task 4.*
- **An expression declared with zero Looks.** `periodOf` must never return 0: `lcm(0, n)` is 0, `index % 0` is `NaN`, and a `NaN` cache key renders one frozen frame for ever. *Task 4.*
- **A `head` anchor too close to the top for the heart.** The heart occupies `head.y - 5` through `head.y - 1`; a `head.y` below 5 puts it at a negative row. Rejected at the catalog test. *Task 4.*
- **The egg painted with a Species' palette.** Every egg must be the same on screen, whatever hatches from it, including for a Species whose palette is shorter than the egg's map needs. *Task 3.*

---

### Task 1: Drop the home surface and the sidebar footer

The home goes before the canvas grows, so no home snapshot is ever regenerated at 32 x 32 only to be deleted. `view/__tests__/home.test.tsx` holds the only assertion that reads the badge corner out of rendered text; it moves to `sprite.test.tsx` first.

**Files:**
- Modify: `view/__tests__/sprite.test.tsx`, `view/sidebar.tsx`, `view/portrait.tsx`, `view/__tests__/sidebar.test.tsx`, `view/__tests__/fixtures.ts`, `view/__tests__/render.tsx`, `shell/slots.tsx`, `index.tsx`
- Delete: `view/home.tsx`, `view/__tests__/home.test.tsx`, `view/__tests__/__snapshots__/home.test.tsx.snap`, `core/appearance/footer.ts`, `core/appearance/__tests__/footer.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SidebarView(props: { name: string; session: Session; tamago: Tamago; clock: number; bubble?: Bubble; heart: boolean })` — no `footer`. `Portrait` keeps `{ tamago, activity, clock, heart, variant, theme, badge, width?, bubble? }` and loses `children`. `registerSlots(deps: { api, mirror, actions, clock })` — no `footer`.

- [ ] **Step 1: Port the badge-corner assertion into `view/__tests__/sprite.test.tsx`**

Append to the file. The helper reads `BADGE_SLOT`, so it follows the canvas when Task 2 moves the corner; there is no `paddingTop` here, unlike the home it came from.

```tsx
import { BADGE_SLOT } from "../../core/appearance/marks.ts";

/**
 * The BADGE_SLOT corner of the rendered Sprite, read out of the frame text
 * rather than diffed against another frame: a fixture that also moves
 * MARK_SLOT must not be able to fake this. `frame()` trims trailing spaces,
 * so a blank corner can end a line early — hence the padEnd before slicing.
 * Moved here from view/__tests__/home.test.tsx when the home surface was
 * dropped; it was the only test reading the corner's own pixels.
 */
function badgeCorner(shown: string): string {
  const lines = shown.split("\n");
  const firstRow = Math.floor(BADGE_SLOT.y / 2);
  const lastRow = Math.floor((BADGE_SLOT.y + BADGE_SLOT.h - 1) / 2);
  const width = BADGE_SLOT.x + BADGE_SLOT.w;
  const rows: string[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    rows.push((lines[row] ?? "").padEnd(width).slice(BADGE_SLOT.x, width));
  }
  return rows.join("|");
}

test("a pending Draw fills the badge corner, and nothing fills it without one", async () => {
  const render = (badge: boolean) =>
    frameSnapshot(
      () => (
        <Sprite tamago={adult} activity="idle" clock={0} heart={false} variant="dark" theme={TUI_THEME.current} badge={badge} />
      ),
      SIZE,
    );
  const blank = "   |   ";
  expect(badgeCorner(await render(false))).toBe(blank);
  expect(badgeCorner(await render(true))).not.toBe(blank);
});
```

- [ ] **Step 2: Run it**

Run: `bun test view/__tests__/sprite.test.tsx`
Expected: PASS. This is a port of coverage that already holds, not a new behaviour. If it fails, the port is wrong — fix it before deleting anything.

- [ ] **Step 3: Delete the home**

```bash
git rm view/home.tsx view/__tests__/home.test.tsx view/__tests__/__snapshots__/home.test.tsx.snap
```

In `shell/slots.tsx`: remove the `HomeView` import, the `HOME_BOTTOM_ORDER` constant and its comment, and the whole second `api.slots.register({ order: HOME_BOTTOM_ORDER, slots: { home_bottom(ctx) { … } } })` call. In `view/__tests__/render.tsx`, remove the `HOME` size export.

- [ ] **Step 4: Strip the footer from the sidebar**

`view/sidebar.tsx`: delete the `FooterInfo` type export, the `footer` prop, and the two `<text>` blocks after the `<Portrait>`. What is left is the Portrait alone:

```tsx
export const SIDEBAR_WIDTH = 37;

export function SidebarView(props: {
  name: string;
  session: Session;
  tamago: Tamago;
  clock: number;
  bubble?: Bubble;
  heart: boolean;
}): JSX.Element {
  const theme = useTheme();
  const activity = () => props.session.activity;
  const bubble = createMemo((): BubbleView | undefined => {
    const current = props.bubble;
    if (current === undefined) return undefined;
    const { top, bottom } = bubbleBorders(current.text);
    return { top, text: current.text, bottom, border: theme.current.textMuted, ink: theme.current.text, offset: tailOffset(current.text) };
  });
  return (
    <Portrait
      tamago={props.tamago}
      activity={activity()}
      clock={props.clock}
      heart={props.heart}
      variant={theme.mode()}
      theme={theme.current}
      badge={props.tamago.choices.length > 0}
      width={SIDEBAR_WIDTH}
      bubble={bubble()}
    />
  );
}
```

`props.name` is now unused by the body but stays in the props type: `shell/slots.tsx` passes it and the roster's rename path is the reason it is threaded. Leave it.

- [ ] **Step 5: Drop `children` from `Portrait`**

`view/portrait.tsx`: remove `children?: JSX.Element` from the props type, the `<Show when={props.children}>` block, and the now-unused `Show` import if nothing else uses it. The sprite `<box flexDirection="row" gap={2}>` collapses to the `<box paddingLeft={margin()}>` holding the `<Sprite>`.

- [ ] **Step 6: Unwire the footer in `index.tsx` and delete its module**

Remove the `footer` function (lines around 142-147), the `FooterInfo` import, the `footerPath` import, and the `homedir` import if nothing else in the file uses it. `registerSlots({ api, mirror, actions, clock })`. Then:

```bash
git rm core/appearance/footer.ts core/appearance/__tests__/footer.test.ts
```

- [ ] **Step 7: Fix the sidebar tests**

`view/__tests__/sidebar.test.tsx`: drop `FOOTER` from the import and from every `<SidebarView>`; delete the two `expect(shown).toContain("~/projects/")` assertions; rename the first test to `"idle adult: the creature alone"` and the fourth to `"hurt egg: draws the egg, no mood or xp text"`. Add the assertion that the footer is gone, which is the point of the task:

```tsx
test("the sidebar draws the creature and nothing else", async () => {
  const shown = await sidebar();
  expect(shown).not.toContain("~/projects");
  expect(shown).not.toContain("OpenCode");
});
```

`view/__tests__/fixtures.ts`: delete the `FOOTER` export and the `FooterInfo` import.

- [ ] **Step 8: Run the three gates and update the snapshots**

Run: `bun test view shell --update-snapshots`
Then: `pnpm test && ./node_modules/.bin/tsc --noEmit`
Expected: all green. `sidebar.test.tsx.snap` changes (two lines shorter per snapshot); `home.test.tsx.snap` is gone. Read the snapshot diff before committing: nothing but the footer lines may have moved.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(opencode): drop the home surface and the sidebar footer

The Sprite is about to take six more rows, and the two lines under it in
the sidebar were OpenCode's own footer, redrawn by the plugin because it
holds the single_winner sidebar_footer slot. The plugin keeps the slot,
since that is where the Sprite lives, and stops redrawing the project
line and the version line inside it.

home_bottom is no longer registered and view/home.tsx is deleted, which
also kills idea 8. The badge corner assertion, which only home.test.tsx
made against rendered text, moved to sprite.test.tsx first so the
coverage survives the file. core/appearance/footer.ts and its test go
with the lines they formatted.

Snapshots: sidebar.test.tsx.snap updated (footer lines gone),
home.test.tsx.snap deleted."
```

---

### Task 2: Grow the canvas to 32 x 32

Geometry only. Every map is re-framed inside the larger canvas — horizontally centred, sitting on the floor — and every rectangle is offset to match, so every creature renders exactly as it did, with margin around it.

**Files:**
- Modify: `core/appearance/pixels.ts`, `core/appearance/marks.ts`, `core/appearance/sprites.ts`, `core/speech/bubble.ts`, `core/appearance/__tests__/pixels.test.ts`, `core/speech/__tests__/bubble.test.ts`, `view/__tests__/render.tsx`, `view/__tests__/sprite.test.tsx`, all twenty files in `core/creature/species/`
- Create then delete: `scripts/reframe.mjs`

**Interfaces:**
- Consumes: Task 1's `SidebarView` and `Portrait` shapes.
- Produces: `SPRITE_WIDTH = 32`, `SPRITE_HEIGHT = 16`, `PIXEL_HEIGHT = 32`; `BADGE_SLOT = { x: 29, y: 0, w: 3, h: 3 }`; `HEAD_COLUMN = 15` exported from `core/speech/bubble.ts`.

- [ ] **Step 1: Capture what every Species looks like today**

Before touching anything, record the current render of all eighty maps. This is the evidence the migration is faithful, and it is thrown away afterwards.

```bash
mkdir -p /tmp/tamago-before
for id in $(node -e 'import("./core/creature/catalog.ts").then(m=>console.log(m.SPECIES.map(s=>s.id).join(" ")))'); do
  for stage in hatchling young adult elder; do
    node scripts/preview.ts "$id" "$stage" --plain > "/tmp/tamago-before/$id-$stage.txt"
  done
done
wc -l /tmp/tamago-before/*.txt | tail -1
```

Expected: 80 files.

- [ ] **Step 2: Write the failing dimension test**

`core/appearance/__tests__/pixels.test.ts`, replacing the first test:

```ts
test("the grid is 32 cells wide, 16 cells tall, 32 pixels tall", () => {
  assert.equal(SPRITE_WIDTH, 32);
  assert.equal(SPRITE_HEIGHT, 16);
  assert.equal(PIXEL_HEIGHT, 32);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test core/appearance/__tests__/pixels.test.ts`
Expected: FAIL, `21 !== 32`.

- [ ] **Step 4: Change the constants and the two fixed rectangles**

`core/appearance/pixels.ts`:

```ts
/** Cells across, and cells down. A cell is one pixel wide and two pixels tall. */
export const SPRITE_WIDTH = 32;
export const SPRITE_HEIGHT = 16;
/** Pixels down: two per cell. A cell being twice as tall as it is wide, these pixels are square on screen. */
export const PIXEL_HEIGHT = SPRITE_HEIGHT * 2;
```

`core/appearance/marks.ts`: `export const BADGE_SLOT: Rect = { x: 29, y: 0, w: 3, h: 3 };`

`core/appearance/sprites.ts`: `const HEART_AT = { x: 13, y: 13, w: 5, h: 5 };` (the old `{x:8,y:1}` plus the offsets).

- [ ] **Step 5: Write the re-framing script**

`scripts/reframe.mjs`. Every rectangle literal in a Species file is an eye or a motion rect — `sheet` holds no `x`/`y` — so offsetting them all is safe.

```js
// scripts/reframe.mjs — one-shot: re-frames 21x20 maps inside the 32x32 canvas.
// Run: node scripts/reframe.mjs core/creature/species/*.ts core/appearance/sprites.ts
import { readFileSync, writeFileSync } from "node:fs";

const LEFT = 5;   // floor((32 - 21) / 2)
const RIGHT = 6;  // 32 - 21 - 5
const TOP = 12;   // 32 - 20

/** A run of map rows: consecutive lines that are a quoted string of exactly 21 map characters. */
const ROW = /^(\s*)"([.oabc]{21})",$/;

function reframe(source) {
  const lines = source.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const match = ROW.exec(lines[i]);
    if (match === null) {
      out.push(lines[i]);
      continue;
    }
    const indent = match[1];
    const blank = `${indent}"${".".repeat(32)}",`;
    for (let k = 0; k < TOP; k++) out.push(blank);
    while (i < lines.length) {
      const row = ROW.exec(lines[i]);
      if (row === null) break;
      out.push(`${row[1]}"${".".repeat(LEFT)}${row[2]}${".".repeat(RIGHT)}",`);
      i++;
    }
    i--;
  }
  return out
    .join("\n")
    .replace(/\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}/g, (_, x, y, w, h) => `{ x: ${Number(x) + LEFT}, y: ${Number(y) + TOP}, w: ${w}, h: ${h} }`);
}

for (const file of process.argv.slice(2)) {
  writeFileSync(file, reframe(readFileSync(file, "utf8")));
  console.log(`reframed ${file}`);
}
```

- [ ] **Step 6: Run it**

```bash
node scripts/reframe.mjs core/creature/species/*.ts core/appearance/sprites.ts
```

Expected: 21 lines of output. `grep -c '"\.\{32\}",' core/creature/species/common.ts` is non-zero; `grep -n '[.oabc]\{21\}",' core/creature/species/*.ts` prints nothing.

- [ ] **Step 7: Move the bubble's tail off the canvas centre**

`core/speech/bubble.ts`: the head is no longer at half the width. Replace `Math.floor(SPRITE_WIDTH / 2)` with a named constant and drop the `SPRITE_WIDTH` import.

```ts
/**
 * Column the tail aims at: where the migrated maps put the head (old column 10
 * plus the re-framing offset of 5). Task 4 replaces this with the Body's own
 * `head` anchor, which is the whole reason a Species declares one.
 */
export const HEAD_COLUMN = 15;

export function tailOffset(text: string): number {
  const { bottom } = bubbleBorders(text);
  return HEAD_COLUMN - bottom.indexOf("o");
}
```

`core/speech/__tests__/bubble.test.ts`: replace `const head = Math.floor(SPRITE_WIDTH / 2);` with `const head = HEAD_COLUMN;` and fix the import.

- [ ] **Step 8: Widen the test viewports**

`view/__tests__/render.tsx`: `SIDEBAR` becomes `{ width: 37, height: 24 }` — its height is a test viewport, and a real sidebar is as tall as the terminal. `view/__tests__/sprite.test.tsx`: `const SIZE = { width: 34, height: 18 };`.

**`DIALOG` stays `{ width: 60, height: 26 }`.** Do not grow it. `4d42a8e` put two tests in the suite deliberately red to pin the card and roster overflow, and recorded that the fixture's real value is the user's to measure against the running TUI rather than this fixture's to assume. A 16-row Sprite in a 26-row dialog overflows harder than a 10-row one did, and the card and roster snapshots will record that. Recording it is the point: growing the fixture would turn two honest red tests green while the real dialog stayed exactly as cramped.

- [ ] **Step 9: Run the three gates and update the snapshots**

Run: `pnpm test && ./node_modules/.bin/tsc --noEmit && bun test view shell --update-snapshots`
Expected: green.

- [ ] **Step 10: Prove the migration changed nothing but the frame**

```bash
mkdir -p /tmp/tamago-after
for id in $(node -e 'import("./core/creature/catalog.ts").then(m=>console.log(m.SPECIES.map(s=>s.id).join(" ")))'); do
  for stage in hatchling young adult elder; do
    node scripts/preview.ts "$id" "$stage" --plain > "/tmp/tamago-after/$id-$stage.txt"
  done
done
for f in /tmp/tamago-before/*.txt; do
  n=$(basename "$f")
  # 6 blank cell rows on top, 5 spaces left, trailing space stripped: the old picture, moved.
  diff <(sed -n '3,12p' "$f" | sed 's/^/     /') <(sed -n '9,24p' "/tmp/tamago-after/$n" | sed '1,0d' | sed -n '1,10p') > /dev/null || echo "MOVED: $n"
done
```

Expected: no `MOVED:` line. If the comparison itself proves awkward to line up, the fallback that answers the same question is to read three previews by eye — `cat`, `dragon`, `snail` at `adult` — against the same three in `/tmp/tamago-before`, and confirm the drawing is identical with margin around it.

- [ ] **Step 11: Delete the script and commit**

```bash
rm scripts/reframe.mjs
git add -A
git commit -m "feat(opencode): grow the sprite canvas to 32 x 32

Geometry only: the constants go to 32 wide and 32 pixels tall (16 cells),
and a one-shot script re-framed the eighty maps plus the egg inside the
larger canvas — horizontally centred at x + 5, sitting on the floor at
y + 12 — offsetting every eye and motion rectangle by the same. Nothing
is scaled, so every creature renders exactly as it did, with margin
around it, and an un-redrawn Stage is obvious at a glance.

BADGE_SLOT moves to the new right corner and the heart follows the
offsets. The bubble's tail stopped aiming at half the canvas width,
which is only the head by accident on the old maps: it aims at
HEAD_COLUMN until Task 4 gives it the Body's own head anchor.

Snapshots: card, roster, sidebar and sprite updated — the sprite is six
rows taller, and the test viewports grew with it."
```

---

### Task 3: Palette indices, and an egg that keeps its own

A map stops naming Roles and names colours the Species declares. The egg gets a palette of its own, which closes a leak: `view/sprite.tsx` paints it with `paletteOf(species.id)` today, so a duck's egg is yellow and a dragon's green, against the rule that an egg reveals nothing.

**Files:**
- Modify: `core/appearance/pixels.ts`, `core/appearance/palette.ts`, `core/appearance/sprites.ts`, `core/creature/catalog.ts`, `core/creature/species.ts`, `core/appearance/__tests__/pixels.test.ts`, `core/appearance/__tests__/palette.test.ts`, `core/appearance/__tests__/sprites.test.ts`, `view/sprite.tsx`, `view/portrait.tsx`, `view/sidebar.tsx`, `view/card.tsx`, `view/__tests__/sprite.test.tsx`, `scripts/preview.ts`, all twenty files in `core/creature/species/`
- Create then delete: `scripts/repalette.mjs`

**Interfaces:**
- Consumes: Task 2's canvas constants.
- Produces: `type Ink = number | "mark" | "badge" | "heart"`; `type Cell = { top: Ink | null; bottom: Ink | null }`; `type Palette = readonly string[]`; `EGG_PALETTE: Palette`; `paletteOf(id: SpeciesId, table?: readonly SpeciesDef[]): Palette`; `paint(rows, at, pattern, ink: Ink): string[]`; `SpeciesDef` carries `palette: Palette` instead of `palettes: Palettes`. `Sprite` and `Portrait` lose their `variant` prop; `skinOf` is deleted.

- [ ] **Step 1: Write the failing alphabet tests**

In `core/appearance/__tests__/pixels.test.ts`, replace the two Role tests with:

```ts
test("every alphabet character maps to its palette index", () => {
  const rows = filled(".");
  rows[0] = "0159af".padEnd(SPRITE_WIDTH, ".");
  const frame = pack(rows);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((i) => frame[0]?.[i]?.top),
    [0, 1, 5, 9, 10, 15],
  );
});

test("a cell carries the pixel above it and the pixel below it", () => {
  const rows = filled(".");
  rows[0] = "0".padEnd(SPRITE_WIDTH, ".");
  rows[1] = "1".padEnd(SPRITE_WIDTH, ".");
  const frame = pack(rows);
  assert.deepEqual(frame[0]?.[0], { top: 0, bottom: 1 });
  assert.deepEqual(frame[0]?.[1], { top: null, bottom: null });
});

test("paint writes an index as its own character, and an engine role as its letter", () => {
  const indexed = paint(blank(), { x: 2, y: 4, w: 1, h: 1 }, ["#"], 11);
  assert.equal(indexed[4]?.[2], "b");
  const painted = paint(blank(), { x: 2, y: 4, w: 1, h: 1 }, ["#"], "badge");
  assert.equal(painted[4]?.[2], "G");
  assert.equal(pack(painted)[2]?.[2]?.top, "badge");
});
```

Update the two remaining tests that still pass `"eye"` to `paint`: the rectangle-bounds test and the pattern-fit test now pass `0` instead.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test core/appearance/__tests__/pixels.test.ts`
Expected: FAIL — `"0" is not a map character`.

- [ ] **Step 3: Rewrite the alphabet in `core/appearance/pixels.ts`**

```ts
/** What a pixel is: a colour of the Species' Palette, or something the engine paints. */
export type Ink = number | "mark" | "badge" | "heart";

/** One terminal cell: the pixel above and the pixel below, null where nothing is drawn. */
export type Cell = { top: Ink | null; bottom: Ink | null };

/** Transparent, then the sixteen palette indices. */
export const MAP_ALPHABET = ".0123456789abcdef";

/** The three characters the engine paints. A map never holds one. */
export const PAINT_OF: Record<"mark" | "badge" | "heart", string> = { mark: "M", badge: "G", heart: "H" };

const PAINTED: Record<string, "mark" | "badge" | "heart"> = { M: "mark", G: "badge", H: "heart" };

function inkAt(rows: readonly string[], x: number, y: number): Ink | null {
  const char = rows[y]?.[x];
  if (char === undefined || char === ".") return null;
  const painted = Object.prototype.hasOwnProperty.call(PAINTED, char) ? PAINTED[char] : undefined;
  if (painted !== undefined) return painted;
  const index = MAP_ALPHABET.indexOf(char);
  if (index <= 0) throw new Error(`"${char}" is not a map character (row ${y}, column ${x})`);
  return index - 1;
}

/** The character an Ink is written as. */
function charOf(ink: Ink): string {
  return typeof ink === "number" ? (MAP_ALPHABET[ink + 1] ?? "") : PAINT_OF[ink];
}
```

`pack` calls `inkAt` where it called `roleAt`. `paint` takes an `Ink` and writes its character; an index outside 0-15 fails loudly rather than writing nothing. Delete `Role` and `ROLE_OF`.

```ts
/** Writes `pattern` into `at` as `ink`, on a copy of `rows`. */
export function paint(rows: readonly string[], at: Rect, pattern: Pattern, ink: Ink): string[] {
  assertInside(at);
  if (pattern.length !== at.h || pattern.some((line) => line.length !== at.w)) {
    throw new Error(`a pattern for a ${at.w} x ${at.h} rectangle must be ${at.h} rows of ${at.w}`);
  }
  const char = charOf(ink);
  if (char === "") throw new Error(`palette index ${String(ink)} is outside 0-15`);
  const next = rows.slice();
  for (let dy = 0; dy < at.h; dy++) {
    const row = next[at.y + dy];
    if (row === undefined) continue;
    const chars = row.split("");
    for (let dx = 0; dx < at.w; dx++) if (pattern[dy]?.[dx] === "#") chars[at.x + dx] = char;
    next[at.y + dy] = chars.join("");
  }
  return next;
}
```

- [ ] **Step 4: Rewrite `core/appearance/palette.ts`**

The whole file, Roles and variants gone:

```ts
/**
 * A Species' colours, index 0 to 15, lowercase `#rrggbb`. A map's characters
 * are indices into this list. One list per Species: the Sprite is tuned for a
 * dark theme and read as-is on a light one.
 */
export type Palette = readonly string[];

/** The ceiling, and what the import script passes as `maxColors`. */
export const PALETTE_MAX = 16;

/**
 * The egg's own colours, never a Species'. Every egg looks the same whatever
 * hatches from it: the Rarity and the Species are learned at the hatch, and
 * the egg reveals neither.
 */
export const EGG_PALETTE: Palette = ["#4c4438", "#d9cdb8", "#efe7d6"];
```

`core/appearance/__tests__/palette.test.ts` is rewritten to assert every Species' palette holds between 1 and `PALETTE_MAX` lowercase `#rrggbb` entries, and that `EGG_PALETTE` is none of them by identity.

- [ ] **Step 5: Write the failing catalog tests (Review Focus)**

In `core/appearance/__tests__/sprites.test.ts`:

```ts
test("every index a map writes has a colour behind it", () => {
  for (const one of drawn) {
    const palette = paletteOf(one.id);
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { pixels } = mapsOf(one.id)[stage];
      for (const [y, row] of pixels.entries()) {
        for (const [x, char] of [...row].entries()) {
          if (char === ".") continue;
          const index = MAP_ALPHABET.indexOf(char) - 1;
          assert.ok(
            index >= 0 && index < palette.length,
            `${one.id}/${stage} row ${y} column ${x} writes "${char}" (index ${index}) but the palette holds ${palette.length} colours`,
          );
        }
      }
    }
  }
});

test("the egg's map never reads a Species' palette", () => {
  for (const [y, row] of EGG_PIXELS.entries()) {
    for (const [x, char] of [...row].entries()) {
      if (char === ".") continue;
      const index = MAP_ALPHABET.indexOf(char) - 1;
      assert.ok(index >= 0 && index < EGG_PALETTE.length, `the egg writes "${char}" at ${x},${y}, outside its own ${EGG_PALETTE.length} colours`);
    }
  }
});
```

`sprites.ts` exports `EGG_PIXELS` (the egg Body's `pixels`) for that second test.

- [ ] **Step 6: Run them to verify they fail**

Run: `node --test core/appearance/__tests__/sprites.test.ts`
Expected: FAIL — the maps still hold `o`, `a`, `b`, `c`, and `paletteOf` still takes a variant.

- [ ] **Step 7: Write the re-palette script**

`scripts/repalette.mjs`:

```js
// scripts/repalette.mjs — one-shot: map Roles become palette indices, the dark Skin becomes the Palette.
// Run: node scripts/repalette.mjs core/creature/species/*.ts
import { readFileSync, writeFileSync } from "node:fs";

const INDEX = { o: "0", a: "1", b: "2", c: "3" };
const ROW = /^(\s*)"([.oabc]{32})",$/;
const PALETTES =
  /palettes: \{\s*dark: \{ outline: "(#[0-9a-f]{6})", primary: "(#[0-9a-f]{6})", secondary: "(#[0-9a-f]{6})", accent: "(#[0-9a-f]{6})", eye: "(#[0-9a-f]{6})" \},\s*light: \{[^}]*\},\s*\}/g;

function repalette(source) {
  const rows = source
    .split("\n")
    .map((line) => {
      const match = ROW.exec(line);
      if (match === null) return line;
      return `${match[1]}"${[...match[2]].map((char) => INDEX[char] ?? char).join("")}",`;
    })
    .join("\n");
  // Order fixed by the old Skin: outline, primary, secondary, accent, eye. The eye lands on index 4,
  // which is what DEFAULT_EXPRESSIONS draws with in Task 4.
  return rows.replace(PALETTES, (_, outline, primary, secondary, accent, eye) => `palette: ["${outline}", "${primary}", "${secondary}", "${accent}", "${eye}"]`);
}

for (const file of process.argv.slice(2)) {
  writeFileSync(file, repalette(readFileSync(file, "utf8")));
  console.log(`repalette ${file}`);
}
```

- [ ] **Step 8: Run it, and check nothing was missed**

```bash
node scripts/repalette.mjs core/creature/species/*.ts
grep -n 'palettes:\|outline:\|[.oabc]\{32\}"' core/creature/species/*.ts
```

Expected: 20 lines of output from the script, and the `grep` prints nothing. If the `PALETTES` regex missed a file because its whitespace differs, fix that file's `palettes:` block by hand to the same `palette: [...]` shape rather than loosening the regex.

- [ ] **Step 9: Hand-convert the egg**

`core/appearance/sprites.ts`: the `EGG` map's `o` becomes `0`, `a` becomes `1`, `b` becomes `2`, matching `EGG_PALETTE`'s three entries. Export it as `EGG_PIXELS` for the test in Step 5.

- [ ] **Step 10: Drop the variant from the catalog and the views**

`core/creature/species.ts`: `SpeciesDef` carries `palette: Palette`. `core/creature/catalog.ts`:

```ts
/** The colours to paint a Species with: its own, else the reference's for a Species this build does not draw. */
export function paletteOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Palette {
  const palette = entry(id, table)?.palette ?? entry(REFERENCE, table)?.palette;
  if (palette === undefined) throw new Error(`no Palette on the reference Species "${REFERENCE}"`);
  return palette;
}
```

`view/sprite.tsx`: delete `skinOf` and the `variant` prop; the colour memo becomes an array, and the egg reads its own list:

```tsx
const colours = createMemo((): { of: (ink: Ink) => RGBA | undefined } => {
  const palette = props.tamago.stage === "egg" ? EGG_PALETTE : paletteOf(props.tamago.species.id);
  const tint = TINT[props.activity];
  const shade = (value: string) => RGBA.fromHex(tint === null ? value : mixed(value, hex(props.theme[tint.color]), tint.amount));
  const shaded = palette.map(shade);
  const marked = markOf(props.tamago.traits);
  const markColor = marked === undefined ? "success" : (MARK[marked]?.color ?? "success");
  const painted: Record<"mark" | "badge" | "heart", RGBA> = {
    mark: props.theme[markColor],
    badge: props.theme.warning,
    heart: props.theme.error,
  };
  return { of: (ink) => (typeof ink === "number" ? shaded[ink] : painted[ink]) };
});
```

The span style reads `colours().of(shown.fg)` and `colours().of(shown.bg)`, omitting the key when it is `undefined`. `glyphOf` is untouched: it only ever compares the two halves.

Remove `variant={theme.mode()}` from `view/sidebar.tsx` and `view/card.tsx`, and the `variant` prop from `view/portrait.tsx`. In `view/__tests__/sprite.test.tsx`, delete the `"the theme variant is part of what a painted Sprite depends on"` test and every `variant="dark"`; update the four `glyphOf` tests to indices (`{ top: 1, bottom: 1 }` and so on).

- [ ] **Step 11: Paint the eyes with a palette index**

`build` and `heartFrame` still call `paint(rows, eye, face, "eye")`, and `"eye"` is no longer an `Ink`. The eyes are drawn in the colour the migration put at index 4 — the old `Skin.eye` — so add the constant beside them and pass it:

```ts
/**
 * Where the migration put every Species' old eye colour. Task 4 deletes this
 * along with the engine's shared Faces: once a Species owns its expressions,
 * an eye is drawn in whatever colours that Species chose.
 */
const EYE_INDEX = 4;
```

Both call sites become `paint(rows, eye, face, EYE_INDEX)`.

- [ ] **Step 12: Fix `scripts/preview.ts` enough to compile**

Replace the `Skin`/`Role` imports with `Palette`/`Ink` and `EGG_PALETTE`; `colorOf(ink, palette)` returns `THEME_STAND_IN[ink]` for the three painted names and `palette[ink] ?? "#ff00ff"` for an index — magenta so a missing colour is visible rather than silent. Drop the `--light` flag and the `variant` line from its output.

- [ ] **Step 13: Run the three gates**

Run: `pnpm test && ./node_modules/.bin/tsc --noEmit && bun test view shell`
Expected: 452 core tests pass, tsc clean, and the view suite at its baseline of 40 pass / 2 fail — **with no snapshot update**. Snapshots capture characters, not colours, and an eye packs to the same glyph whether it was `E` or `4`. If a snapshot moves, something other than colour changed — find it before going on.

- [ ] **Step 14: Look at it**

Run: `node scripts/preview.ts duck adult` and `node scripts/preview.ts dragon egg`
Expected: the duck is the same yellow bird as before; the two eggs of different Species are now the same colour as each other.

- [ ] **Step 15: Delete the script and commit**

```bash
rm scripts/repalette.mjs
git add -A
git commit -m "feat(opencode): give each Species an indexed palette, and the egg its own

A map stops naming Roles: its characters are indices into a list of up
to sixteen colours the Species declares, so a creature has its own ramp
instead of four shared slots. Variant, Palettes, Skin and the light
theme's second list go with them — the Sprite is tuned for dark and read
as-is on light — and so does the eye Role, since an eye is now drawn in
whatever colours the Species chose.

The egg keeps EGG_PALETTE, which closes a leak found while specifying
this: view/sprite.tsx painted it with paletteOf(species.id), so a duck's
egg was yellow and a dragon's green, against the rule in CONTEXT.md that
every egg is the same and against idea 12's abandoned Rarity-tinted egg.

Two catalog tests now refuse what the types cannot see: an index with no
colour behind it, and an egg map reaching past its own three colours.
Snapshots unchanged, as expected — captureCharFrame reads characters,
and an eye packs to the same glyph whichever character drew it."
```

---

### Task 4: Anchors and per-Species expressions

Eye rectangles become named points the Body declares, and the eleven expression tables the engine shared across twenty creatures become a table each Species owns.

**Files:**
- Create: `core/appearance/expressions.ts`, `core/appearance/default-expressions.ts`, `core/appearance/__tests__/expressions.test.ts`
- Modify: `core/appearance/bodies.ts`, `core/appearance/sprites.ts`, `core/appearance/__tests__/sprites.test.ts`, `core/creature/species.ts`, `core/creature/catalog.ts`, `core/speech/bubble.ts`, `core/speech/__tests__/bubble.test.ts`, `view/sidebar.tsx`, `scripts/preview.ts`, all twenty files in `core/creature/species/`
- Create then delete: `scripts/reanchor.mjs`

**Interfaces:**
- Consumes: Task 3's `Ink`, `Palette`, `paletteOf`.
- Produces:
  - `type Point = { x: number; y: number }`
  - `type Patch = { at: string; pixels: readonly string[] }`, `type Look = readonly Patch[]`, `type Expression = readonly Look[]`
  - `type ExpressionId = "open" | "shut" | "thinking" | "working" | "waiting" | "hurt" | "sleeping" | "pet:cheerful" | "pet:sarcastic" | "pet:stoic" | "pet:dreamy"`
  - `type Expressions = { open: Expression; shut: Expression } & Partial<Record<Exclude<ExpressionId, "open" | "shut">, Expression>>`
  - `type Anchors = { head: Point; [name: string]: Point }`
  - `type Body = { pixels: readonly string[]; anchors: Anchors; expressions?: Partial<Expressions>; motion?: Motion }`
  - `SpeciesDef` gains `expressions: Expressions`
  - `headOf(species: SpeciesId, stage: StageId, table?): Point`
  - `periodOf(species: SpeciesId, stage: StageId, activity: Activity, table?): number`
  - `tailOffset(text: string, headColumn: number): number`

- [ ] **Step 1: Write the expression types**

`core/appearance/expressions.ts`, types and the lookup rule, no tables:

```ts
import type { Activity } from "../moment/session.ts";
import type { Temperament } from "../creature/sheet.ts";

export type Point = { x: number; y: number };

/** A patch pinned to an anchor: its top-left pixel lands on that anchor. `.` leaves what is under it alone. */
export type Patch = { at: string; pixels: readonly string[] };

/** One look: everything redrawn for one beat. */
export type Look = readonly Patch[];

/** One or more Looks; the cadence alternates over them. Never empty — a catalog test refuses it. */
export type Expression = readonly Look[];

export type ExpressionId =
  | "open"
  | "shut"
  | "thinking"
  | "working"
  | "waiting"
  | "hurt"
  | "sleeping"
  | "pet:cheerful"
  | "pet:sarcastic"
  | "pet:stoic"
  | "pet:dreamy";

/** `open` and `shut` are owed by every Species; the rest fall back to `open`. */
export type Expressions = { open: Expression; shut: Expression } & Partial<
  Record<Exclude<ExpressionId, "open" | "shut">, Expression>
>;

/** The Expression an Activity asks for, before the blink and before the fallback. */
export function idOf(activity: Activity): ExpressionId {
  return activity === "idle" ? "open" : activity;
}

export function petIdOf(temperament: Temperament): ExpressionId {
  return `pet:${temperament}`;
}

/** The Expression to draw, falling back to `open` for anything this Species did not give. */
export function expressionOf(table: Expressions, id: ExpressionId): Expression {
  return table[id] ?? table.open;
}
```

- [ ] **Step 2: Write the failing tests for the fallback and the period**

`core/appearance/__tests__/expressions.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { expressionOf, idOf, petIdOf, type Expressions } from "../expressions.ts";

const open = [[{ at: "left_eye", pixels: ["4"] }]];
const shut = [[{ at: "left_eye", pixels: ["."] }]];
const minimal: Expressions = { open, shut };

test("idle asks for open; every other Activity asks for its own name", () => {
  assert.equal(idOf("idle"), "open");
  assert.equal(idOf("sleeping"), "sleeping");
  assert.equal(petIdOf("dreamy"), "pet:dreamy");
});

test("a Species that gave only open and shut falls back to open for everything else", () => {
  assert.equal(expressionOf(minimal, "hurt"), open);
  assert.equal(expressionOf(minimal, "pet:stoic"), open);
  assert.equal(expressionOf(minimal, "shut"), shut);
});

test("a declared Expression wins over the fallback", () => {
  const hurt = [[{ at: "left_eye", pixels: ["0"] }]];
  assert.equal(expressionOf({ ...minimal, hurt }, "hurt"), hurt);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test core/appearance/__tests__/expressions.test.ts`
Expected: FAIL, the module does not exist yet — then PASS once Step 1's file is saved. Save the file, run again, confirm PASS.

- [ ] **Step 4: Write the migrated default table**

`core/appearance/default-expressions.ts`. Every value the engine used to share, rewritten as patches in index 4 — the eye colour of every migrated palette.

```ts
import type { Expressions } from "./expressions.ts";

/**
 * The eleven looks the engine used to share across every Species, as patches
 * pinned to `left_eye` and `right_eye` and drawn in palette index 4, which is
 * where the migration put each Species' old eye colour.
 *
 * This exists only for Species not yet redrawn at 32 x 32. A redrawn Species
 * writes its own table and must not reach for this one: its indices mean
 * nothing outside a migrated palette. Delete this file when the last Species
 * is redrawn.
 */
function eyes(pattern: readonly string[]): readonly [{ at: string; pixels: readonly string[] }, { at: string; pixels: readonly string[] }] {
  return [
    { at: "left_eye", pixels: pattern },
    { at: "right_eye", pixels: pattern },
  ];
}

const OPEN = [".4.", "444", ".4."];
const SHUT = ["...", "444", "..."];

export const DEFAULT_EXPRESSIONS: Expressions = {
  open: [eyes(OPEN)],
  shut: [eyes(SHUT)],
  thinking: [eyes(OPEN), eyes(["...", "444", ".4."])],
  working: [eyes(OPEN)],
  waiting: [eyes(["444", "4.4", "444"])],
  hurt: [eyes(["4.4", ".4.", "4.4"])],
  sleeping: [eyes(SHUT)],
  "pet:cheerful": [eyes(["4.4", ".4.", "..."])],
  "pet:sarcastic": [eyes(["...", "444", ".4."])],
  "pet:stoic": [eyes(OPEN)],
  "pet:dreamy": [eyes(["...", "4.4", "444"])],
};
```

- [ ] **Step 5: Write the failing catalog tests (Review Focus)**

Replace the eye-rectangle test in `core/appearance/__tests__/sprites.test.ts` with four:

```ts
test("every anchor a Species' expressions name exists in all four of its Bodies", () => {
  for (const one of drawn) {
    const table = expressionsOf(one.id);
    const named = new Set<string>();
    for (const expression of Object.values(table)) for (const look of expression) for (const patch of look) named.add(patch.at);
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { anchors } = mapsOf(one.id)[stage];
      for (const at of named) assert.ok(anchors[at] !== undefined, `${one.id}/${stage} has no anchor "${at}"`);
    }
  }
});

test("every patch fits inside the canvas from its anchor", () => {
  for (const one of drawn) {
    const table = expressionsOf(one.id);
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { anchors } = mapsOf(one.id)[stage];
      for (const [id, expression] of Object.entries(table)) {
        for (const look of expression) {
          for (const patch of look) {
            const at = anchors[patch.at];
            if (at === undefined) continue; // named by the test above
            const height = patch.pixels.length;
            const width = patch.pixels[0]?.length ?? 0;
            for (const row of patch.pixels) assert.equal(row.length, width, `${one.id}/${id} patch at ${patch.at} is ragged`);
            assert.ok(
              at.x >= 0 && at.y >= 0 && at.x + width <= SPRITE_WIDTH && at.y + height <= PIXEL_HEIGHT,
              `${one.id}/${stage}/${id} patch at ${patch.at} (${at.x},${at.y} ${width}x${height}) runs off the canvas`,
            );
          }
        }
      }
    }
  }
});

test("no Expression is empty, so a period is never zero", () => {
  for (const one of drawn) {
    for (const [id, expression] of Object.entries(expressionsOf(one.id))) {
      assert.ok(expression.length > 0, `${one.id}/${id} has no Look`);
    }
  }
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      for (const activity of ACTIVITIES) {
        assert.ok(periodOf(one.id, stage, activity) > 0, `${one.id}/${stage}/${activity} has a period of zero`);
      }
    }
  }
});

test("every head anchor leaves room for the heart above it", () => {
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { head } = mapsOf(one.id)[stage].anchors;
      assert.ok(head.y >= HEART_HEIGHT, `${one.id}/${stage} head at y=${head.y} leaves no room for the ${HEART_HEIGHT}-row heart`);
      assert.ok(head.x - 2 >= 0 && head.x + 3 <= SPRITE_WIDTH, `${one.id}/${stage} head at x=${head.x} pushes the heart off the canvas`);
    }
  }
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `node --test core/appearance/__tests__/sprites.test.ts`
Expected: FAIL — `expressionsOf`, `periodOf`'s new signature, `anchors` and `HEART_HEIGHT` do not exist.

- [ ] **Step 7: Rewrite `core/appearance/bodies.ts`**

```ts
import type { StageId } from "../career/stage.ts";
import type { Expressions, Point } from "./expressions.ts";
import type { Motion } from "./motion.ts";

export type Grown = Exclude<StageId, "egg">;

/** Named points of a Body. `head` is required: the heart and the bubble tail read it. */
export type Anchors = { head: Point; [name: string]: Point };

/**
 * One Stage of one Species. `pixels` is PIXEL_HEIGHT rows of SPRITE_WIDTH
 * characters of MAP_ALPHABET: colour, and only colour. Everything that moves
 * or receives a patch is declared beside it, so no character of the map ever
 * has two meanings.
 *
 * MARK_SLOT and BADGE_SLOT must stay transparent; every anchor the Species'
 * expressions name must exist here; `head` must leave room for the heart; a
 * `motion` rectangle must hold its region alone. sprites.test.ts enforces all
 * four — anchor names are strings, so this is where a missing one is caught.
 *
 * `expressions` overrides the Species' table for this Stage alone, merged over
 * it rather than replacing it. Optional, and rarely needed.
 */
export type Body = {
  pixels: readonly string[];
  anchors: Anchors;
  expressions?: Partial<Expressions>;
  motion?: Motion;
};

export type Maps = Record<Grown, Body>;
```

- [ ] **Step 8: Rewrite the drawing in `core/appearance/sprites.ts`**

Delete `FACES`, `SHUT` and `EYES`. Add:

```ts
/** Rows the heart occupies above the head anchor. */
export const HEART_HEIGHT = 5;
const HEART: Pattern = [".#.#.", "#####", "#####", ".###.", "..#.."];

/** The Expressions of a Species: its own, merged with the Body's override for that Stage. */
export function expressionsOf(species: SpeciesId, stage?: StageId, table: readonly SpeciesDef[] = SPECIES): Expressions {
  const own = tableOf(species, table);
  if (stage === undefined || stage === "egg") return own;
  return { ...own, ...(mapsOf(species, table)[stage].expressions ?? {}) };
}

/** Where the head is: the Body's anchor, the egg's own for an egg. */
export function headOf(species: SpeciesId, stage: StageId, table: readonly SpeciesDef[] = SPECIES): Point {
  return stage === "egg" ? EGG.anchors.head : mapsOf(species, table)[stage].anchors.head;
}

/** Stamps a Look onto the rows: each patch at its anchor, `.` leaving what is under it alone. */
function stamp(rows: readonly string[], anchors: Anchors, look: Look): string[] {
  let next = rows.slice();
  for (const patch of look) {
    const at = anchors[patch.at];
    if (at === undefined) continue; // core never throws at render; the catalog test is where this is caught
    for (const [dy, line] of patch.pixels.entries()) {
      const row = next[at.y + dy];
      if (row === undefined) continue;
      const chars = row.split("");
      for (const [dx, char] of [...line].entries()) {
        if (char === "." ) continue;
        if (at.x + dx < SPRITE_WIDTH) chars[at.x + dx] = char;
      }
      next[at.y + dy] = chars.join("");
    }
  }
  return next;
}
```

Then the four functions. `body`, `keyOf`, `mapsOf`, `known` and `paletteOf` all take the same optional `table`, so a test can hand in a Species of its own; `keyOf` reads `known(species, table)` so a fixture id is not filed under the reference's cache key.

```ts
/** Builds one Frame: the map, moved, then the Look, then the overlays, then packed. */
function build(one: Body, look: Look, beat: number, mark: TraitId | undefined, badge: boolean): Frame {
  let rows: readonly string[] = one.pixels;
  const motion = one.motion;
  if (motion?.tail !== undefined) rows = shift(rows, motion.tail, sweepAt(beat));
  if (motion?.ears !== undefined && blinksAt(beat)) for (const ear of motion.ears) rows = shift(rows, ear, 1);
  rows = stamp(rows, one.anchors, look);
  const pattern = mark === undefined ? undefined : MARK[mark]?.pattern;
  if (pattern !== undefined) rows = paint(rows, MARK_SLOT, pattern, "mark");
  if (badge) rows = paint(rows, BADGE_SLOT, BADGE, "badge");
  return pack(rows);
}

/**
 * How many beats before the whole animation repeats. Math.max(1, …) is load-bearing: an Expression
 * with no Look would make this zero, and `index % 0` is NaN — one frozen Frame under a NaN cache
 * key, for ever. The catalog test refuses an empty table; this refuses to melt if one slips past.
 */
export function periodOf(species: SpeciesId, stage: StageId, activity: Activity, table: readonly SpeciesDef[] = SPECIES): number {
  const looks = Math.max(1, expressionOf(expressionsOf(species, stage, table), idOf(activity)).length);
  return lcm(lcm(looks, SWEEP.length), BLINK_EVERY);
}

export function frameAt(
  species: SpeciesId,
  stage: StageId,
  activity: Activity,
  index: number,
  mark?: TraitId,
  badge = false,
  table: readonly SpeciesDef[] = SPECIES,
): Frame {
  const period = periodOf(species, stage, activity, table);
  // Wrapped once, up front, so the clock-driven index and the cache stay bounded.
  const wrapped = ((index % period) + period) % period;
  const blinking = activity !== "sleeping" && blinksAt(wrapped);
  const expression = expressionOf(expressionsOf(species, stage, table), blinking ? "shut" : idOf(activity));
  const beat = wrapped % Math.max(1, expression.length);
  const key = `${keyOf(species, stage, table)}/${activity}/${wrapped}/${mark ?? ""}/${badge}`;
  return cached(key, () => build(body(species, stage, table), expression[beat] ?? [], wrapped, mark, badge));
}

/** The Sprite while petted: the Temperament's expression and a heart above the head. */
export function heartFrame(
  species: SpeciesId,
  stage: StageId,
  temperament: Temperament,
  mark?: TraitId,
  badge = false,
  table: readonly SpeciesDef[] = SPECIES,
): Frame {
  const key = `${keyOf(species, stage, table)}/heart/${temperament}/${mark ?? ""}/${badge}`;
  return cached(key, () => {
    const one = body(species, stage, table);
    const expression = expressionOf(expressionsOf(species, stage, table), petIdOf(temperament));
    let rows: readonly string[] = stamp(one.pixels, one.anchors, expression[0] ?? []);
    const head = one.anchors.head;
    rows = paint(rows, { x: head.x - 2, y: head.y - HEART_HEIGHT, w: 5, h: HEART_HEIGHT }, HEART, "heart");
    const pattern = mark === undefined ? undefined : MARK[mark]?.pattern;
    if (pattern !== undefined) rows = paint(rows, MARK_SLOT, pattern, "mark");
    if (badge) rows = paint(rows, BADGE_SLOT, BADGE, "badge");
    return pack(rows);
  });
}
```

- [ ] **Step 9: Give the egg a head and expressions**

`EGG` gains `anchors: { head: { x: 15, y: 18 }, left_eye: { x: 11, y: 18 }, right_eye: { x: 17, y: 18 } }` — its old eye rectangles' corners, already re-framed by Task 2 — and `expressionsOf` returns `DEFAULT_EXPRESSIONS` for the egg. The egg's eyes are drawn in index 4 of `EGG_PALETTE`, which holds three colours, so add the fourth and fifth entries to `EGG_PALETTE`: `["#4c4438", "#d9cdb8", "#efe7d6", "#4c4438", "#2a2520"]`. The egg's map still writes only `0`-`2`; indices 3 and 4 exist for the patches.

- [ ] **Step 10: Write the re-anchor script**

`scripts/reanchor.mjs`:

```js
// scripts/reanchor.mjs — one-shot: eye rectangles become anchors, and every Species takes the migrated table.
// Run: node scripts/reanchor.mjs core/creature/species/*.ts
import { readFileSync, writeFileSync } from "node:fs";

const EYES = /eyes: \[\{ x: (\d+), y: (\d+), w: \d+, h: \d+ \}, \{ x: (\d+), y: (\d+), w: \d+, h: \d+ \}\]/g;
const MULTILINE = /eyes: \[\s*\{ x: (\d+), y: (\d+), w: \d+, h: \d+ \},\s*\{ x: (\d+), y: (\d+), w: \d+, h: \d+ \},?\s*\]/g;

function anchors(_, lx, ly, rx, ry) {
  return `anchors: { head: { x: 15, y: 18 }, left_eye: { x: ${lx}, y: ${ly} }, right_eye: { x: ${rx}, y: ${ry} } }`;
}

for (const file of process.argv.slice(2)) {
  let source = readFileSync(file, "utf8").replace(MULTILINE, anchors).replace(EYES, anchors);
  // One table per Species, right after its palette line, until it is redrawn.
  source = source.replace(/^(\s*)palette: \[[^\]]*\],$/gm, (line, indent) => `${line}\n${indent}expressions: DEFAULT_EXPRESSIONS,`);
  if (!source.includes("default-expressions.ts")) {
    source = `import { DEFAULT_EXPRESSIONS } from "../../appearance/default-expressions.ts";\n${source}`;
  }
  writeFileSync(file, source);
  console.log(`reanchored ${file}`);
}
```

- [ ] **Step 11: Run it and check the leftovers**

```bash
node scripts/reanchor.mjs core/creature/species/*.ts
grep -n "eyes:" core/creature/species/*.ts
grep -c "expressions: DEFAULT_EXPRESSIONS" core/creature/species/*.ts
```

Expected: the first `grep` prints nothing; the second sums to 20. Fix by hand any file the regex missed; the import line lands at the top of the file, so move it into the existing import block for readability.

- [ ] **Step 12: Aim the bubble's tail at the head**

`core/speech/bubble.ts`: `tailOffset(text: string, headColumn: number)` replaces `HEAD_COLUMN`. `view/sidebar.tsx` passes `headOf(props.tamago.species.id, props.tamago.stage).x`. Update `core/speech/__tests__/bubble.test.ts` to pass a column explicitly, and add: a bubble for a head at column 4 never starts left of zero.

- [ ] **Step 13: Update `scripts/preview.ts`'s summary**

`summarize` prints the anchors and the motion rectangles: `head`, then every other anchor by name, then `motion.tail` and each `motion.ears[i]`, and the ids of the expressions the Species declares.

- [ ] **Step 14: Run the three gates**

Run: `pnpm test && ./node_modules/.bin/tsc --noEmit && bun test view shell`
Expected: green, **with no snapshot update**. The migrated table reproduces the shared one exactly, so every glyph lands where it did. A moved snapshot means the patches do not match the old `FACES`; compare the two before touching the snapshot.

- [ ] **Step 15: Delete the script and commit**

```bash
rm scripts/reanchor.mjs
git add -A
git commit -m "feat(opencode): anchors per Body, expressions per Species

An eye stops being a 3 x 3 rectangle the engine stamps a shared pattern
into. A Body declares named points — head, left_eye, right_eye, whatever
the creature has — and the Species declares expressions as patches
pinned to them, drawn in its own palette. A creature can have one eye or
three, and blink the way it chose.

Only open and shut are owed; the other nine fall back to open, so a
Species is enriched over time instead of being blocked on eleven
drawings. FACES, SHUT and EYES are gone from sprites.ts; the twenty
migrated Species take DEFAULT_EXPRESSIONS, which reproduces them exactly
in index 4 and is deleted when the last Species is redrawn.

The heart and the bubble tail now read the head anchor instead of a
hardcoded rectangle and half the canvas width. Four catalog tests hold
the line the types cannot: an anchor a patch names but no Body has, a
patch that runs off the canvas, an Expression with no Look (which would
make periodOf return zero and freeze the sprite on a NaN cache key), and
a head with no room for the heart above it.

Snapshots unchanged, as expected: the migrated table draws what the
shared one drew."
```

---

### Task 5: Optional drawn frames

A Species may ship whole extra maps for an Activity, and the existing cadence alternates over them. None must, and none does yet.

**Files:**
- Modify: `core/appearance/bodies.ts`, `core/appearance/sprites.ts`, `core/appearance/__tests__/sprites.test.ts`

**Interfaces:**
- Consumes: Task 4's `Body`, `expressionsOf`, `periodOf`.
- Produces: `Body.frames?: readonly (readonly string[])[]`; `frameAt` and `periodOf` fold the frame count into the period.

- [ ] **Step 1: Write the failing test**

In `core/appearance/__tests__/sprites.test.ts`. No cast and no non-null assertion, in a test as much as in production: the reference entry is narrowed once at module level, and the four maps are written out rather than built by `Object.fromEntries`, which would need one. The fixture's id is one the real catalog does not hold, because the Frame cache is keyed by id and a shared one would collide.

```ts
const BLANK = Array.from({ length: PIXEL_HEIGHT }, () => ".".repeat(SPRITE_WIDTH));
/** A map whose only opaque row is `y`: two of them differ, and differ visibly. */
function bar(y: number): readonly string[] {
  return BLANK.map((row, at) => (at === y ? "1".repeat(SPRITE_WIDTH) : row));
}
const FRAME_A = bar(20);
const FRAME_B = bar(21);
const TWO_FRAMES = [FRAME_A, FRAME_B];

const CAT = SPECIES.find((one) => one.id === "cat");
if (CAT === undefined) throw new Error("the reference Species is missing from the catalog");

const BODY: Body = {
  pixels: FRAME_A,
  frames: TWO_FRAMES,
  anchors: { head: { x: 15, y: 18 }, left_eye: { x: 11, y: 18 }, right_eye: { x: 17, y: 18 } },
};

const FIXTURE: SpeciesDef = {
  id: "test:framed",
  label: { en: "framed", fr: "framed" },
  gender: "m",
  rarity: "common",
  palette: ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"],
  expressions: DEFAULT_EXPRESSIONS,
  signature: CAT.signature,
  maps: { hatchling: BODY, young: BODY, adult: BODY, elder: BODY },
};

const TABLE = [...SPECIES, FIXTURE];

test("a Body with frames alternates over them, and the period covers them", () => {
  const first = frameAt("test:framed", "adult", "idle", 0, undefined, false, TABLE);
  const second = frameAt("test:framed", "adult", "idle", 1, undefined, false, TABLE);
  assert.notDeepEqual(first, second, "two frames should draw differently");
  assert.deepEqual(frameAt("test:framed", "adult", "idle", 2, undefined, false, TABLE), first, "two frames around is the first again");
  assert.equal(periodOf("test:framed", "adult", "idle", TABLE) % TWO_FRAMES.length, 0, "the period must cover the frame cycle");
});

test("a Body without frames draws its single map at every beat", () => {
  const period = periodOf("cat", "adult", "idle");
  const maps = new Set<string>();
  for (let beat = 0; beat < period; beat++) {
    maps.add(JSON.stringify(frameAt("cat", "adult", "idle", beat).map((row) => row.map((cell) => cell.top))));
  }
  assert.ok(maps.size <= period, "no beat may invent a map");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test core/appearance/__tests__/sprites.test.ts`
Expected: FAIL — `frames` is not a field of `Body`, and `frameAt` takes no table.

- [ ] **Step 3: Add the field and fold it into the period**

`core/appearance/bodies.ts`: `frames?: readonly (readonly string[])[];` on `Body`, documented as "further whole maps for this Stage; the cadence alternates over them. `pixels` is frame zero and the only one a Species must give."

`core/appearance/sprites.ts`: in `build`, the base rows are `one.frames?.[beat % one.frames.length] ?? one.pixels`; in `periodOf`, fold `Math.max(1, body.frames?.length ?? 1)` into the `lcm`.

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test core/appearance/__tests__/sprites.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the three gates**

Run: `pnpm test && ./node_modules/.bin/tsc --noEmit && bun test view shell`
Expected: green, no snapshot change — no shipped Species declares `frames`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(opencode): let a Body ship whole drawn frames

Where a drawn animation is worth its bytes, a Body lists further 32 x 32
maps and the existing cadence alternates over them; pixels is frame zero
and stays the only map a Species must give. periodOf folds the frame
count into its least common multiple, so a walk of one period still sees
every frame exactly once.

No shipped Species declares any, so nothing renders differently. The
test builds its own Species with a distinct id, since the Frame cache is
keyed by id and a fixture sharing one would collide with the catalog's."
```

---

### Task 6: `scripts/import.ts`, PNG to map

The drawing loop: a 32 x 32 PNG out of Aseprite, Piskel or pixler becomes a `pixels` block and a `palette` array to paste into a Species file.

**Files:**
- Create: `scripts/import.ts`, `scripts/png.ts`, `scripts/__tests__/png.test.ts`, `scripts/__tests__/import.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 3's `MAP_ALPHABET`, `PALETTE_MAX`; Task 2's canvas constants.
- Produces: `decodePng(bytes: Uint8Array): { width: number; height: number; pixels: Uint8Array }` (RGBA, four bytes per pixel); `toMap(image, { width, height }): { pixels: string[]; palette: string[] }`.

- [ ] **Step 1: Extend the test glob**

`package.json`: `"test": "node --test \"core/**/__tests__/*.test.ts\" \"adapter/__tests__/*.test.ts\" \"scripts/__tests__/*.test.ts\""`.

- [ ] **Step 2: Write the failing decoder test**

`scripts/__tests__/png.test.ts` builds its own PNG with `node:zlib`, so no binary fixture enters the repo.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { decodePng } from "../png.ts";

/** A minimal 8-bit RGBA PNG, no interlace, one IDAT, filter 0 on every row. */
function png(width: number, height: number, rgba: (x: number, y: number) => readonly [number, number, number, number]): Uint8Array {
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) raw.push(...rgba(x, y));
  }
  const chunk = (type: string, body: Uint8Array): number[] => {
    const bytes = [...Buffer.from(type), ...body];
    const length = [(body.length >>> 24) & 255, (body.length >>> 16) & 255, (body.length >>> 8) & 255, body.length & 255];
    const crc = crc32(Uint8Array.from(bytes));
    return [...length, ...bytes, (crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255];
  };
  const ihdr = Uint8Array.from([
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255,
    8, 6, 0, 0, 0,
  ]);
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk("IHDR", ihdr),
    ...chunk("IDAT", Uint8Array.from(deflateSync(Buffer.from(raw)))),
    ...chunk("IEND", Uint8Array.from([])),
  ]);
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

test("decodes an 8-bit RGBA PNG to four bytes a pixel", () => {
  const image = decodePng(png(2, 2, (x, y) => (x === y ? [255, 0, 0, 255] : [0, 0, 0, 0])));
  assert.equal(image.width, 2);
  assert.equal(image.height, 2);
  assert.deepEqual([...image.pixels.slice(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...image.pixels.slice(4, 8)], [0, 0, 0, 0]);
});

test("a file that is not a PNG is refused by name", () => {
  assert.throws(() => decodePng(Uint8Array.from([1, 2, 3, 4])), /not a PNG/);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node --test scripts/__tests__/png.test.ts`
Expected: FAIL, `Cannot find module '../png.ts'`.

- [ ] **Step 4: Write the decoder**

`scripts/png.ts`, on `node:zlib` alone:

```ts
import { inflateSync } from "node:zlib";

export type Image = { width: number; height: number; pixels: Uint8Array };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function u32(bytes: Uint8Array, at: number): number {
  return (((bytes[at] ?? 0) << 24) | ((bytes[at + 1] ?? 0) << 16) | ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * The PNG a pixel editor writes, and no more: 8 bits a channel, no interlace,
 * colour types 2 (RGB), 3 (palette) and 6 (RGBA). Written by hand on node:zlib
 * because this project carries no runtime dependencies — and it lives in
 * scripts/, which the plugin never imports, so it is not one. Everything it
 * refuses, it refuses by name.
 */
export function decodePng(bytes: Uint8Array): Image {
  for (const [i, byte] of SIGNATURE.entries()) {
    if (bytes[i] !== byte) throw new Error("not a PNG: the signature does not match");
  }
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  let plte: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: number[] = [];
  while (at + 8 <= bytes.length) {
    const length = u32(bytes, at);
    const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
    const body = bytes.slice(at + 8, at + 8 + length);
    at += 12 + length;
    if (type === "IHDR") {
      width = u32(body, 0);
      height = u32(body, 4);
      depth = body[8] ?? 0;
      colour = body[9] ?? 0;
      interlace = body[12] ?? 0;
    } else if (type === "PLTE") plte = body;
    else if (type === "tRNS") trns = body;
    else if (type === "IDAT") idat.push(...body);
    else if (type === "IEND") break;
  }
  if (depth !== 8) throw new Error(`this decoder reads 8 bits a channel, this PNG has ${depth}`);
  if (interlace !== 0) throw new Error("this decoder does not read interlaced PNGs");
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : colour === 3 ? 1 : 0;
  if (channels === 0) throw new Error(`this decoder reads colour types 2, 3 and 6, this PNG is type ${colour}`);
  if (colour === 3 && plte === undefined) throw new Error("a palette PNG (colour type 3) with no PLTE chunk");
  const raw = new Uint8Array(inflateSync(Buffer.from(idat)));
  const stride = width * channels;
  const lines = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    if (filter > 4) throw new Error(`unknown PNG filter ${filter} on row ${y}`);
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] ?? 0;
      const a = i >= channels ? (lines[y * stride + i - channels] ?? 0) : 0;
      const b = y > 0 ? (lines[(y - 1) * stride + i] ?? 0) : 0;
      const c = i >= channels && y > 0 ? (lines[(y - 1) * stride + i - channels] ?? 0) : 0;
      const value =
        filter === 1 ? x + a : filter === 2 ? x + b : filter === 3 ? x + ((a + b) >> 1) : filter === 4 ? x + paeth(a, b, c) : x;
      lines[y * stride + i] = value & 255;
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (colour === 6) pixels.set(lines.slice(i * 4, i * 4 + 4), i * 4);
    else if (colour === 2) pixels.set([...lines.slice(i * 3, i * 3 + 3), 255], i * 4);
    else {
      const index = lines[i] ?? 0;
      const rgb = plte === undefined ? [] : [...plte.slice(index * 3, index * 3 + 3)];
      pixels.set([rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, trns?.[index] ?? 255], i * 4);
    }
  }
  return { width, height, pixels };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `node --test scripts/__tests__/png.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing map test**

`scripts/__tests__/import.test.ts`:

```ts
test("a two-colour image becomes two palette entries and a map of their indices", () => {
  const image = { width: 2, height: 2, pixels: Uint8Array.from([255,0,0,255, 255,0,0,255, 0,0,255,255, 0,0,0,0]) };
  const { pixels, palette } = toMap(image, { width: 2, height: 2 });
  assert.deepEqual(palette, ["#ff0000", "#0000ff"]); // by descending pixel count
  assert.deepEqual(pixels, ["00", "1."]);
});

test("a fully transparent pixel is a dot, never a colour", () => {
  const image = { width: 1, height: 1, pixels: Uint8Array.from([18, 52, 86, 0]) };
  assert.deepEqual(toMap(image, { width: 1, height: 1 }).pixels, ["."]);
});

test("more than sixteen colours is refused, saying how many", () => {
  const many = Uint8Array.from(Array.from({ length: 17 * 4 }, (_, i) => (i % 4 === 3 ? 255 : i)));
  assert.throws(() => toMap({ width: 17, height: 1, pixels: many }, { width: 17, height: 1 }), /17 colours/);
});

test("an image of the wrong size is refused, saying both sizes", () => {
  const one = { width: 1, height: 1, pixels: Uint8Array.from([0, 0, 0, 255]) };
  assert.throws(() => toMap(one, { width: 32, height: 32 }), /1 x 1.*32 x 32/);
});
```

- [ ] **Step 7: Run it to verify it fails, then write `scripts/import.ts`**

Run: `node --test scripts/__tests__/import.test.ts` → FAIL.

`scripts/import.ts` exports `toMap`:

```ts
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_WIDTH } from "../core/appearance/pixels.ts";
import { PALETTE_MAX } from "../core/appearance/palette.ts";
import { decodePng, type Image } from "./png.ts";

/** Alpha is a cut, not a blend: under 128 the pixel is transparent, at or above it takes its RGB. */
const OPAQUE = 128;

function colourAt(image: Image, i: number): string | undefined {
  if ((image.pixels[i * 4 + 3] ?? 0) < OPAQUE) return undefined;
  const hex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${hex(image.pixels[i * 4] ?? 0)}${hex(image.pixels[i * 4 + 1] ?? 0)}${hex(image.pixels[i * 4 + 2] ?? 0)}`;
}

/** The map and the Palette an image becomes: colours ordered by descending pixel count, ties by hex. */
export function toMap(image: Image, size: { width: number; height: number }): { pixels: string[]; palette: string[] } {
  if (image.width !== size.width || image.height !== size.height) {
    throw new Error(`the image is ${image.width} x ${image.height}, expected ${size.width} x ${size.height}`);
  }
  const counts = new Map<string, number>();
  for (let i = 0; i < image.width * image.height; i++) {
    const colour = colourAt(image, i);
    if (colour !== undefined) counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  if (counts.size > PALETTE_MAX) throw new Error(`the image holds ${counts.size} colours, the ceiling is ${PALETTE_MAX}`);
  const palette = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([colour]) => colour);
  const pixels: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = "";
    for (let x = 0; x < image.width; x++) {
      const colour = colourAt(image, y * image.width + x);
      row += colour === undefined ? "." : (MAP_ALPHABET[palette.indexOf(colour) + 1] ?? ".");
    }
    pixels.push(row);
  }
  return { pixels, palette };
}
```

Run directly, it reads `process.argv[2]`, decodes, converts at `SPRITE_WIDTH` x `PIXEL_HEIGHT` — or at the image's own size with `--patch <anchor>`, for an expression patch — and prints the two blocks ready to paste:

```
palette: ["#f2c94c", "#5c4a12", …],
pixels: [
  "................................",
  …
],
```

Print the colour count after the blocks, and a warning when it has reached the ceiling.

- [ ] **Step 8: Run it to verify it passes**

Run: `node --test scripts/__tests__/import.test.ts`
Expected: PASS.

- [ ] **Step 9: Run the three gates and try it for real**

Run: `pnpm test && ./node_modules/.bin/tsc --noEmit && bun test view shell`
Then, on any 32 x 32 PNG at hand: `node scripts/import.ts /path/to/duck.png`
Expected: 32 rows of 32 characters and a palette of at most 16 colours.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(opencode): import a 32 x 32 PNG into a map and a palette

The drawing loop: a PNG out of Aseprite, Piskel or pixler becomes the
pixels block and the palette array to paste into a Species file. It
prints rather than rewrites, which keeps it out of the business of
parsing TypeScript, and refuses by name an image of the wrong size, one
past sixteen colours, or a PNG this decoder does not cover.

The decoder is written on node:zlib: the project carries no runtime
dependencies, and scripts/ is never imported by the plugin. It covers
what a pixel editor writes — 8 bits a channel, no interlace, colour
types 2, 3 and 6 — and names what it found for anything else. Its test
builds its own PNG with deflateSync, so no binary fixture enters the
repo; package.json's test glob now reaches scripts/__tests__."
```

---

### Task 7: The documents

**Files:**
- Modify: `CONTEXT.md`, `AGENTS.md`, `README.md`, `IDEAS.md`

- [ ] **Step 1: The glossary**

`CONTEXT.md`: **Pixel** says a Sprite is 32 x 32 of them, not 21 x 20. **Sprite** and **Frame** lose the eyes-as-rectangles wording. **Role** and **Palette**'s two variants go; **Palette** becomes one indexed list per Species, with the egg's own noted. **Skin** is deleted. Add **Anchor** (a named point of a Body; `head` is required and the heart and the bubble tail read it), **Patch** (pixels pinned to an anchor), **Look** (one beat's patches) and **Expression** (one or more Looks; `open` and `shut` are owed, the rest fall back). The avoid-lists stay as they are.

- [ ] **Step 2: The agent rules**

`AGENTS.md`: the Palette rule loses "two variants"; the catalog rule's "four maps, a Palette in both variants and a full Signature" becomes "four maps, a Palette, an Expressions table and a full Signature"; the `sprites.test.ts` rule names the four checks it now makes (anchors named but absent, patches off the canvas, empty Expressions, a head with no room for the heart) and says plainly that anchor names are strings, so that test is where a typo is caught rather than `tsc`.

- [ ] **Step 3: The README**

`README.md`: the Sprite paragraph says 32 x 32 and per-Species colours; the layout paragraph drops the home screen — the sprite lives in the sidebar and the dialogs; the pending-Draw paragraph drops "and on the home screen"; the `core/appearance/` line in the tree mentions expressions and anchors.

- [ ] **Step 4: The backlog**

`IDEAS.md`: the four-surfaces list in the header becomes three. Idea 8, "Vue home enrichie", is marked abandoned on 2026-09-25 with the reason — the home surface is gone, and a journal would need a surface first. Idea 10, "Rendu et couleur", is marked done for the colour half, naming this spec. Idea 12's parked item from 2026-09-17 is marked done for the sprite half, and what is left of it (loot and accessories on the Frame) notes that the anchors this batch introduces are what they will hang from, which replaces its "une tête à place fixe dans toutes les Species" — the head is now declared, not assumed.

- [ ] **Step 5: Check every claim**

Run: `grep -rn "21\|light\|variant\|Skin\|home" CONTEXT.md AGENTS.md README.md | grep -iv "highlight\|slight"`
Read every hit and confirm it is either corrected or genuinely about something else.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(opencode): describe the 32 x 32 engine

The glossary gains Anchor, Patch, Look and Expression, loses Role and
Skin, and says a Palette is one indexed list per Species with the egg
keeping its own. AGENTS.md records that anchor names are strings, so
sprites.test.ts and not tsc is what catches a typo. The README drops the
home screen from the layout and from the pending-Draw reminder.

In IDEAS.md: idea 8 is abandoned, since there is no home left to enrich;
idea 10's colour half is done; and idea 12's parked sprite item is done,
with its remaining accessories half now hanging from the anchors this
batch introduced instead of assuming a head at a fixed place."
```

---

## What is not in this plan

No creature is redrawn here. The engine lands, the twenty migrate unchanged, and the first hand-drawn 32 x 32 Species is its own commit afterwards — one Species per commit, in whatever order the author picks.

Two things want a real terminal, which no test in this plan can stand in for: the sidebar at 19 rows with a bubble, and whether 512 cells a Sprite cost anything the September perf pass would have noticed. Both are named in the spec's Risks, and both are read off a running OpenCode once Task 7 is in.
