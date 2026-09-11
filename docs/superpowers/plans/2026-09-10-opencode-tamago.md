# opencode-tamago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local OpenCode TUI plugin that shows an ASCII creature at the bottom of the session sidebar and on the home screen, reacting live to the session and evolving from accumulated activity across every OpenCode instance.

**Architecture:** TUI-only plugin in `.config/opencode/plugin/tamago/`. A pure `core/` (state, reducer, merge, stages, sprites, lock decisions) with `node:test` coverage; a thin `adapter/` that translates SDK events and touches the disk; Solid JSX `view/` components; `index.tsx` wires them into `api.slots`, `api.event`, and timers. Progress is persisted as deltas merged under a `mkdir` lock so parallel instances never lose counters.

**Tech Stack:** Bun runtime (inside OpenCode 1.18.30), Solid JSX over OpenTUI (`@opentui/solid` 0.4.5, `solid-js` 1.9.10), `@opencode-ai/plugin` 1.18.30 types, TypeScript 5.9 for `tsc --noEmit`, Node 24 `node:test` for the pure core.

**Spec:** `docs/superpowers/specs/2026-09-10-opencode-tamago-design.md`

## Global Constraints

- Plugin id is `opencode-tamago`. Default creature name is `Tamago`, overridable through the `name` option in `tui.jsonc`.
- `core/` must not import anything from OpenCode, Solid, OpenTUI, `node:fs`, or timers. Only `adapter/` may touch the filesystem. Only `index.tsx` may touch `api.*` and timers.
- Same TypeScript rules as `open-review`: `import type` for every type-only import, explicit `.ts` / `.tsx` extension on every relative import, erasable syntax only (no `enum`, no `namespace`, no parameter properties). `tsconfig.json` enforces them.
- Never run a package manager in `.config/opencode` itself. The only install happens inside `.config/opencode/plugin/tamago/` with `pnpm install --ignore-workspace`, and Task 1 verifies the parent `node_modules` is untouched.
- The parent `.config/opencode/.gitignore` ignores `package.json` and `.gitignore` at any depth. The plugin directory carries its own `.gitignore` with negations so its manifest is tracked.
- Colors always come from `theme.current`, never hardcoded.
- Every frame of a stage is exactly `SPRITE_HEIGHT` (5) lines of exactly `SPRITE_WIDTH` (11) columns, enforced by test.
- Errors add no XP and remove none. No streaks, no death, no penalties.
- Persistence file: `~/.local/share/opencode-tamago/career.json`. Lock: `career.lock` directory, stale after 10 s. Error log: `~/.local/share/opencode-tamago/error.log`.
- Commit messages use Angular format with scope `opencode`: `feat(opencode): ...`, `test(opencode): ...`, `chore(opencode): ...`. Ask the user before every commit unless they authorized a batch.

## Platform facts (verified, do not re-derive)

- `tui.jsonc` `plugin` entries accept `[relativePath, options]`; relative paths resolve from the config file. A file module must `export default { id, tui }` and must not export `server`.
- OpenCode compiles local `.tsx` TUI plugins with the Solid transform at import time (`@opentui/solid` runtime plugin support), so normal Solid reactivity (`createSignal`, accessors in JSX) works without a build step.
- `api.slots.register({ order?, slots: { <slotName>(ctx, props) { return JSX } } })`. `ctx.theme.current` is the live theme. Lower `order` sorts first; ties break by registration order.
- `sidebar_footer` is rendered with mode `single_winner`: only the first entry after sorting renders. The built-in footer registers with `order: 100` and shows the working directory (with branch) and the `• OpenCode <version>` line. Registering with `order: 50` replaces it, so our footer redraws those two lines. The footer box is outside the sidebar `scrollbox` with `flexShrink={0}`, so it stays visible however tall the content is.
- `home_logo` is rendered with mode `replace`: our view replaces the OpenCode logo on the home screen.
- Built-in `sidebar_content` orders: context 100, mcp 200, lsp 300, todo 400, files 500 (only relevant if the footer fallback is ever needed).
- SDK event shapes used (from `@opencode-ai/sdk/v2`): `message.part.updated` → `properties.part` (a `ToolPart` has `type: "tool"`, `callID`, `tool`, `state.status` in `pending | running | completed | error`); `message.updated` → `properties.info` with `role`; `file.edited` → `properties.file`; `permission.asked`, `permission.replied`, `session.idle`, `session.error` → `properties.sessionID`; `session.created` → `properties.info.parentID` is set for subagent child sessions.
- Node 24 runs `.ts` test files directly through type stripping. `node --test` needs quoted globs, not a directory.

## File structure

```
.config/opencode/plugin/tamago/
  .gitignore              node_modules ignored; package.json and .gitignore re-included
  package.json            devDependencies only (types + tsc), scripts test/typecheck
  tsconfig.json           nodenext, jsx preserve with @opentui/solid, erasableSyntaxOnly
  index.tsx               plugin entry: wiring only
  core/
    state.ts              Activity, ToolKind, Session, Counters, Career, Delta; defaults; addDelta; hydrate
    events.ts             TamagoEvent union; HURT_MS; SLEEP_MS
    reduce.ts             reduce(session, event, now) → { session, delta }
    merge.ts              merge(career, delta) → career
    stage.ts              WEIGHTS, STAGES, xp(), stage(), next()
    format.ts             fmt(number), bar(progress, width)
    sprites.ts            SPRITE_WIDTH/HEIGHT, frames(), frameAt()
    lock.ts               LOCK_STALE_MS, decideLock()
    *.test.ts             one test file per module above
  adapter/
    translate.ts          createTranslator(): SDK Event → TamagoEvent[] (stateful dedupe, no I/O)
    translate.test.ts
    store.ts              createStore(dir): load(), flush(delta) with lock + atomic rename
    store.test.ts         against a mkdtemp directory
    log.ts                logError(dir, err): append to error.log
  view/
    sidebar.tsx           SidebarView, MOOD labels, spriteColor()
    home.tsx              HomeView
.config/opencode/tui.jsonc            add the plugin entry
scripts/doctor.sh                     add an "opencode-tamago" section
```

---

### Task 1: Scaffold the plugin package

**Files:**
- Create: `.config/opencode/plugin/tamago/.gitignore`
- Create: `.config/opencode/plugin/tamago/package.json`
- Create: `.config/opencode/plugin/tamago/tsconfig.json`
- Create: `.config/opencode/plugin/tamago/core/state.ts` (empty export, so tsc has an input)

**Interfaces:**
- Produces: a directory where `./node_modules/.bin/tsc --noEmit` and `node --test "core/*.test.ts"` run. Every later task runs its commands from `.config/opencode/plugin/tamago/`.

- [ ] **Step 1: Record the parent `node_modules` state so the install can be proven harmless**

Run from the repo root:
```bash
ls .config/opencode/node_modules | sort > "$HOME/.cache/opencode-tamago-parent-nm-before.txt"
wc -l < "$HOME/.cache/opencode-tamago-parent-nm-before.txt"
```
Expected: a line count (currently 5 entries plus `.bin`, `.pnpm` or similar). Keep the file.

- [ ] **Step 2: Create the directory and its `.gitignore`**

`.config/opencode/plugin/tamago/.gitignore`:
```gitignore
# The parent .config/opencode/.gitignore ignores package.json and .gitignore at
# any depth. This plugin's manifest must be versioned, so re-include them here.
node_modules
!package.json
!.gitignore
```

- [ ] **Step 3: Create `package.json`**

`.config/opencode/plugin/tamago/package.json`:
```json
{
  "name": "opencode-tamago",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"core/*.test.ts\" \"adapter/*.test.ts\"",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "1.18.30",
    "@opencode-ai/sdk": "1.18.30",
    "@opentui/core": "0.4.5",
    "@opentui/keymap": "0.4.5",
    "@opentui/solid": "0.4.5",
    "@types/node": "^24",
    "solid-js": "1.9.10",
    "typescript": "^5.9.3"
  }
}
```
The `@opentui/*` and `solid-js` pins match what OpenCode 1.18.30 bundles (its root `package.json` catalog). They are types-only here; at runtime Bun resolves them from OpenCode itself.

- [ ] **Step 4: Create `tsconfig.json`**

`.config/opencode/plugin/tamago/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "jsxImportSource": "@opentui/solid",
    "types": ["node"]
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create a placeholder core module so tsc has an input**

`.config/opencode/plugin/tamago/core/state.ts`:
```ts
export {};
```
Task 2 replaces this file entirely.

- [ ] **Step 6: Install dev dependencies inside the plugin directory only**

```bash
cd .config/opencode/plugin/tamago && pnpm install --ignore-workspace
```
Expected: `node_modules` created under `plugin/tamago/`, a `pnpm-lock.yaml` written there. If pnpm reports `ERR_PNPM_IGNORED_BUILDS`, that is fine: nothing here needs a build script.

- [ ] **Step 7: Prove the parent `node_modules` is untouched**

```bash
cd /Users/maxime.grebauval/projects/dotfiles && ls .config/opencode/node_modules | sort | diff - "$HOME/.cache/opencode-tamago-parent-nm-before.txt" && echo PARENT_UNCHANGED
```
Expected: `PARENT_UNCHANGED`. If anything differs, stop and report; the restore command for the parent is `npm install` in `.config/opencode` (see the toolchain memory), but do not run it without the user.

- [ ] **Step 8: Verify tsc and git tracking**

```bash
cd .config/opencode/plugin/tamago && ./node_modules/.bin/tsc --noEmit && echo TSC_OK
cd /Users/maxime.grebauval/projects/dotfiles && git check-ignore -v .config/opencode/plugin/tamago/package.json .config/opencode/plugin/tamago/.gitignore; echo "exit=$?"
```
Expected: `TSC_OK`, then `exit=1` from `git check-ignore` (meaning neither file is ignored). `git status --short .config/opencode/plugin/tamago` should list `package.json`, `.gitignore`, `tsconfig.json`, `pnpm-lock.yaml`, `core/state.ts` as untracked.

- [ ] **Step 9: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/.gitignore .config/opencode/plugin/tamago/package.json .config/opencode/plugin/tamago/pnpm-lock.yaml .config/opencode/plugin/tamago/tsconfig.json .config/opencode/plugin/tamago/core/state.ts
git commit -m "chore(opencode): scaffold opencode-tamago plugin package"
```

---

### Task 2: Core state types, defaults, delta arithmetic, hydration

**Files:**
- Replace: `.config/opencode/plugin/tamago/core/state.ts`
- Test: `.config/opencode/plugin/tamago/core/state.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Activity = "idle" | "thinking" | "working" | "waiting" | "hurt" | "sleeping"
  export type ToolKind = "read" | "edit" | "bash" | "other"
  export type Session = { activity: Activity; since: number; runningTools: number }
  export type Counters = { sessions: number; prompts: number; tools: Record<ToolKind, number>; filesEdited: number; errors: number }
  export type Career = Counters & { hatchedAt: number }
  export type Delta = Counters
  export const ACTIVITIES: readonly Activity[]
  export const TOOL_KINDS: readonly ToolKind[]
  export const EMPTY_DELTA: Delta
  export function initialSession(now: number): Session
  export function freshCareer(now: number): Career
  export function isEmpty(delta: Delta): boolean
  export function addDelta(a: Delta, b: Delta): Delta
  export function hydrate(raw: unknown, now: number): { career: Career; corrupt: boolean }
  ```

- [ ] **Step 1: Write the failing tests**

`core/state.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_DELTA, addDelta, freshCareer, hydrate, initialSession, isEmpty } from "./state.ts";

test("initialSession starts idle with no running tools", () => {
  assert.deepEqual(initialSession(42), { activity: "idle", since: 42, runningTools: 0 });
});

test("freshCareer is all zeros hatched now", () => {
  const career = freshCareer(1000);
  assert.equal(career.hatchedAt, 1000);
  assert.equal(career.sessions, 0);
  assert.equal(career.tools.edit, 0);
});

test("isEmpty is true only for the zero delta", () => {
  assert.equal(isEmpty(EMPTY_DELTA), true);
  assert.equal(isEmpty({ ...EMPTY_DELTA, prompts: 1 }), false);
  assert.equal(isEmpty({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools, bash: 1 } }), false);
});

test("addDelta sums every counter including nested tools", () => {
  const a = { ...EMPTY_DELTA, prompts: 2, tools: { read: 1, edit: 0, bash: 3, other: 0 } };
  const b = { ...EMPTY_DELTA, prompts: 1, filesEdited: 4, tools: { read: 0, edit: 2, bash: 1, other: 0 } };
  assert.deepEqual(addDelta(a, b), {
    sessions: 0,
    prompts: 3,
    tools: { read: 1, edit: 2, bash: 4, other: 0 },
    filesEdited: 4,
    errors: 0,
  });
});

test("addDelta does not mutate its inputs", () => {
  const a = { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools } };
  addDelta(a, { ...EMPTY_DELTA, prompts: 5 });
  assert.deepEqual(a, EMPTY_DELTA);
});

test("hydrate fills missing fields with defaults and is not corrupt", () => {
  const { career, corrupt } = hydrate({ prompts: 7, tools: { edit: 3 } }, 500);
  assert.equal(corrupt, false);
  assert.equal(career.prompts, 7);
  assert.equal(career.tools.edit, 3);
  assert.equal(career.tools.read, 0);
  assert.equal(career.sessions, 0);
  assert.equal(career.hatchedAt, 500);
});

test("hydrate keeps hatchedAt when present", () => {
  assert.equal(hydrate({ hatchedAt: 123 }, 500).career.hatchedAt, 123);
});

test("hydrate rejects non-object input as corrupt with a fresh career", () => {
  for (const raw of [null, undefined, "x", 3, []]) {
    const { career, corrupt } = hydrate(raw, 9);
    assert.equal(corrupt, true, `raw=${JSON.stringify(raw)}`);
    assert.deepEqual(career, freshCareer(9));
  }
});

test("hydrate ignores non-finite numbers", () => {
  const { career } = hydrate({ prompts: "12", errors: Number.NaN, tools: { bash: Number.POSITIVE_INFINITY } }, 1);
  assert.equal(career.prompts, 0);
  assert.equal(career.errors, 0);
  assert.equal(career.tools.bash, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `.config/opencode/plugin/tamago/`: `node --test "core/state.test.ts"`
Expected: FAIL, `initialSession` is not exported (SyntaxError on the named import).

- [ ] **Step 3: Implement `core/state.ts`**

```ts
export type Activity = "idle" | "thinking" | "working" | "waiting" | "hurt" | "sleeping";
export type ToolKind = "read" | "edit" | "bash" | "other";

export type Session = {
  activity: Activity;
  since: number;
  runningTools: number;
};

export type Counters = {
  sessions: number;
  prompts: number;
  tools: Record<ToolKind, number>;
  filesEdited: number;
  errors: number;
};

export type Career = Counters & { hatchedAt: number };
export type Delta = Counters;

export const ACTIVITIES: readonly Activity[] = ["idle", "thinking", "working", "waiting", "hurt", "sleeping"];
export const TOOL_KINDS: readonly ToolKind[] = ["read", "edit", "bash", "other"];

export const EMPTY_DELTA: Delta = {
  sessions: 0,
  prompts: 0,
  tools: { read: 0, edit: 0, bash: 0, other: 0 },
  filesEdited: 0,
  errors: 0,
};

export function initialSession(now: number): Session {
  return { activity: "idle", since: now, runningTools: 0 };
}

export function freshCareer(now: number): Career {
  return { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, hatchedAt: now };
}

export function isEmpty(delta: Delta): boolean {
  return (
    delta.sessions === 0 &&
    delta.prompts === 0 &&
    delta.filesEdited === 0 &&
    delta.errors === 0 &&
    TOOL_KINDS.every((kind) => delta.tools[kind] === 0)
  );
}

export function addDelta(a: Delta, b: Delta): Delta {
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = a.tools[kind] + b.tools[kind];
  return {
    sessions: a.sessions + b.sessions,
    prompts: a.prompts + b.prompts,
    tools,
    filesEdited: a.filesEdited + b.filesEdited,
    errors: a.errors + b.errors,
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hydrate(raw: unknown, now: number): { career: Career; corrupt: boolean } {
  if (!isRecord(raw)) return { career: freshCareer(now), corrupt: true };
  const rawTools = isRecord(raw.tools) ? raw.tools : {};
  const tools = { ...EMPTY_DELTA.tools };
  for (const kind of TOOL_KINDS) tools[kind] = num(rawTools[kind], 0);
  return {
    corrupt: false,
    career: {
      sessions: num(raw.sessions, 0),
      prompts: num(raw.prompts, 0),
      tools,
      filesEdited: num(raw.filesEdited, 0),
      errors: num(raw.errors, 0),
      hatchedAt: num(raw.hatchedAt, now),
    },
  };
}
```

- [ ] **Step 4: Run the tests and tsc**

```bash
node --test "core/state.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all tests pass, `OK`.

- [ ] **Step 5: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/core/state.ts .config/opencode/plugin/tamago/core/state.test.ts
git commit -m "feat(opencode): add tamago core state model"
```

---

### Task 3: Internal events and the reducer

**Files:**
- Create: `.config/opencode/plugin/tamago/core/events.ts`
- Create: `.config/opencode/plugin/tamago/core/reduce.ts`
- Test: `.config/opencode/plugin/tamago/core/reduce.test.ts`

**Interfaces:**
- Consumes: `Session`, `Delta`, `EMPTY_DELTA`, `Activity`, `ToolKind` from `./state.ts`.
- Produces:
  ```ts
  // events.ts
  export type TamagoEvent =
    | { type: "prompt_sent" } | { type: "tool_started" } | { type: "tool_finished"; kind: ToolKind }
    | { type: "tool_failed" } | { type: "file_edited" } | { type: "permission_asked" }
    | { type: "permission_replied" } | { type: "session_idle" } | { type: "session_error" }
    | { type: "session_started" } | { type: "tick" }
  export const HURT_MS = 3_000
  export const SLEEP_MS = 120_000
  // reduce.ts
  export type Reduced = { session: Session; delta: Delta }
  export function reduce(session: Session, event: TamagoEvent, now: number): Reduced
  ```

- [ ] **Step 1: Write the failing tests**

`core/reduce.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { HURT_MS, SLEEP_MS, type TamagoEvent } from "./events.ts";
import { reduce } from "./reduce.ts";
import { EMPTY_DELTA, addDelta, initialSession, type Session } from "./state.ts";

function replay(events: Array<[TamagoEvent, number]>, start: Session = initialSession(0)) {
  let session = start;
  let delta = EMPTY_DELTA;
  for (const [event, now] of events) {
    const out = reduce(session, event, now);
    session = out.session;
    delta = addDelta(delta, out.delta);
  }
  return { session, delta };
}

test("a prompt makes the creature think and counts one prompt", () => {
  const { session, delta } = replay([[{ type: "prompt_sent" }, 10]]);
  assert.equal(session.activity, "thinking");
  assert.equal(session.since, 10);
  assert.equal(delta.prompts, 1);
});

test("tools drive working and count by kind when they finish", () => {
  const { session, delta } = replay([
    [{ type: "prompt_sent" }, 0],
    [{ type: "tool_started" }, 1],
    [{ type: "tool_started" }, 2],
    [{ type: "tool_finished", kind: "read" }, 3],
    [{ type: "tool_finished", kind: "edit" }, 4],
  ]);
  assert.equal(session.activity, "working");
  assert.equal(session.runningTools, 0);
  assert.equal(delta.tools.read, 1);
  assert.equal(delta.tools.edit, 1);
});

test("working persists after the last tool until the session goes idle", () => {
  const { session } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_finished", kind: "bash" }, 1],
    [{ type: "tick" }, 2],
    [{ type: "session_idle" }, 3],
  ]);
  assert.equal(session.activity, "idle");
  assert.equal(session.since, 3);
});

test("a failed tool hurts, counts an error, and releases its running slot", () => {
  const { session, delta } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_failed" }, 1],
  ]);
  assert.equal(session.activity, "hurt");
  assert.equal(session.runningTools, 0);
  assert.equal(delta.errors, 1);
});

test("runningTools never goes negative", () => {
  const { session } = replay([[{ type: "tool_finished", kind: "other" }, 0]]);
  assert.equal(session.runningTools, 0);
});

test("hurt recovers after HURT_MS to working when tools still run, else idle", () => {
  const busy = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "session_error" }, 1],
    [{ type: "tick" }, 1 + HURT_MS - 1],
  ]);
  assert.equal(busy.session.activity, "hurt");
  const recovered = replay([[{ type: "tick" }, 1 + HURT_MS]], busy.session);
  assert.equal(recovered.session.activity, "working");

  const calm = replay([
    [{ type: "session_error" }, 5],
    [{ type: "tick" }, 5 + HURT_MS],
  ]);
  assert.equal(calm.session.activity, "idle");
  assert.equal(calm.session.since, 5 + HURT_MS);
});

test("permissions make the creature wait and a reply resumes work", () => {
  const waiting = replay([[{ type: "permission_asked" }, 0]]);
  assert.equal(waiting.session.activity, "waiting");
  const resumed = replay([[{ type: "permission_replied" }, 1]], waiting.session);
  assert.equal(resumed.session.activity, "working");
});

test("idle falls asleep after SLEEP_MS and any real event wakes it", () => {
  const asleep = replay([
    [{ type: "session_idle" }, 0],
    [{ type: "tick" }, SLEEP_MS - 1],
  ]);
  assert.equal(asleep.session.activity, "idle");
  const later = replay([[{ type: "tick" }, SLEEP_MS]], asleep.session);
  assert.equal(later.session.activity, "sleeping");
  const woken = replay([[{ type: "file_edited" }, SLEEP_MS + 1]], later.session);
  assert.equal(woken.session.activity, "idle");
  assert.equal(woken.delta.filesEdited, 1);
});

test("file edits count without changing an active state", () => {
  const { session, delta } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "file_edited" }, 1],
  ]);
  assert.equal(session.activity, "working");
  assert.equal(delta.filesEdited, 1);
});

test("session_started counts a session and leaves activity alone", () => {
  const { session, delta } = replay([[{ type: "session_started" }, 0]]);
  assert.equal(session.activity, "idle");
  assert.equal(delta.sessions, 1);
});

test("session_idle clears running tools", () => {
  const { session } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "session_idle" }, 1],
  ]);
  assert.equal(session.runningTools, 0);
});

test("since is only refreshed when the activity actually changes", () => {
  const { session } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_started" }, 50],
  ]);
  assert.equal(session.since, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "core/reduce.test.ts"`
Expected: FAIL, cannot find module `./events.ts`.

- [ ] **Step 3: Implement `core/events.ts`**

```ts
import type { ToolKind } from "./state.ts";

export type TamagoEvent =
  | { type: "prompt_sent" }
  | { type: "tool_started" }
  | { type: "tool_finished"; kind: ToolKind }
  | { type: "tool_failed" }
  | { type: "file_edited" }
  | { type: "permission_asked" }
  | { type: "permission_replied" }
  | { type: "session_idle" }
  | { type: "session_error" }
  | { type: "session_started" }
  | { type: "tick" };

/** How long the creature stays hurt after an error before recovering. */
export const HURT_MS = 3_000;
/** How long the creature stays idle before falling asleep. */
export const SLEEP_MS = 120_000;
```

- [ ] **Step 4: Implement `core/reduce.ts`**

```ts
import { HURT_MS, SLEEP_MS, type TamagoEvent } from "./events.ts";
import { EMPTY_DELTA, type Activity, type Delta, type Session, type ToolKind } from "./state.ts";

export type Reduced = { session: Session; delta: Delta };

function at(session: Session, activity: Activity, now: number): Session {
  return session.activity === activity ? session : { ...session, activity, since: now };
}

function counted(patch: Partial<Omit<Delta, "tools">>, kind?: ToolKind): Delta {
  const tools = { ...EMPTY_DELTA.tools };
  if (kind) tools[kind] = 1;
  return { ...EMPTY_DELTA, ...patch, tools };
}

function release(session: Session): Session {
  return { ...session, runningTools: Math.max(0, session.runningTools - 1) };
}

export function reduce(session: Session, event: TamagoEvent, now: number): Reduced {
  switch (event.type) {
    case "prompt_sent":
      return { session: at(session, "thinking", now), delta: counted({ prompts: 1 }) };
    case "tool_started":
      return {
        session: at({ ...session, runningTools: session.runningTools + 1 }, "working", now),
        delta: EMPTY_DELTA,
      };
    case "tool_finished": {
      const released = release(session);
      return {
        session: released.activity === "sleeping" ? at(released, "working", now) : released,
        delta: counted({}, event.kind),
      };
    }
    case "tool_failed":
      return { session: at(release(session), "hurt", now), delta: counted({ errors: 1 }) };
    case "session_error":
      return { session: at(session, "hurt", now), delta: counted({ errors: 1 }) };
    case "permission_asked":
      return { session: at(session, "waiting", now), delta: EMPTY_DELTA };
    case "permission_replied":
      return { session: at(session, "working", now), delta: EMPTY_DELTA };
    case "file_edited":
      return {
        session: session.activity === "sleeping" ? at(session, "idle", now) : session,
        delta: counted({ filesEdited: 1 }),
      };
    case "session_idle":
      return { session: at({ ...session, runningTools: 0 }, "idle", now), delta: EMPTY_DELTA };
    case "session_started":
      return { session, delta: counted({ sessions: 1 }) };
    case "tick": {
      if (session.activity === "hurt" && now - session.since >= HURT_MS) {
        return { session: at(session, session.runningTools > 0 ? "working" : "idle", now), delta: EMPTY_DELTA };
      }
      if (session.activity === "idle" && now - session.since >= SLEEP_MS) {
        return { session: at(session, "sleeping", now), delta: EMPTY_DELTA };
      }
      return { session, delta: EMPTY_DELTA };
    }
  }
}
```

- [ ] **Step 5: Run the tests and tsc**

```bash
node --test "core/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`. If tsc complains that `reduce` lacks a return for some path, the `switch` is not exhaustive over `TamagoEvent`; fix the missing case rather than adding a default.

- [ ] **Step 6: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/core/events.ts .config/opencode/plugin/tamago/core/reduce.ts .config/opencode/plugin/tamago/core/reduce.test.ts
git commit -m "feat(opencode): add tamago reducer and internal events"
```

---

### Task 4: Career merge

**Files:**
- Create: `.config/opencode/plugin/tamago/core/merge.ts`
- Test: `.config/opencode/plugin/tamago/core/merge.test.ts`

**Interfaces:**
- Consumes: `Career`, `Delta`, `addDelta` from `./state.ts`.
- Produces: `export function merge(career: Career, delta: Delta): Career`

- [ ] **Step 1: Write the failing tests**

`core/merge.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { merge } from "./merge.ts";
import { EMPTY_DELTA, freshCareer, type Delta } from "./state.ts";

const d1: Delta = { ...EMPTY_DELTA, prompts: 1, tools: { read: 2, edit: 0, bash: 0, other: 0 } };
const d2: Delta = { ...EMPTY_DELTA, sessions: 1, tools: { read: 0, edit: 0, bash: 5, other: 1 } };
const d3: Delta = { ...EMPTY_DELTA, filesEdited: 3, errors: 2 };

test("merge adds counters and preserves hatchedAt", () => {
  const career = merge(freshCareer(777), d1);
  assert.equal(career.hatchedAt, 777);
  assert.equal(career.prompts, 1);
  assert.equal(career.tools.read, 2);
});

test("merge is commutative over deltas", () => {
  const base = freshCareer(1);
  assert.deepEqual(merge(merge(base, d1), d2), merge(merge(base, d2), d1));
});

test("merge is associative over deltas", () => {
  const base = freshCareer(1);
  const left = merge(merge(merge(base, d1), d2), d3);
  const right = merge(merge(merge(base, d3), d1), d2);
  assert.deepEqual(left, right);
});

test("merging the empty delta is the identity", () => {
  const career = merge(freshCareer(5), d2);
  assert.deepEqual(merge(career, EMPTY_DELTA), career);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "core/merge.test.ts"`
Expected: FAIL, cannot find module `./merge.ts`.

- [ ] **Step 3: Implement `core/merge.ts`**

```ts
import { addDelta, type Career, type Delta } from "./state.ts";

export function merge(career: Career, delta: Delta): Career {
  return { ...addDelta(career, delta), hatchedAt: career.hatchedAt };
}
```

- [ ] **Step 4: Run the tests and tsc**

```bash
node --test "core/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`.

- [ ] **Step 5: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/core/merge.ts .config/opencode/plugin/tamago/core/merge.test.ts
git commit -m "feat(opencode): add tamago career merge"
```

---

### Task 5: Experience, stages, and number formatting

**Files:**
- Create: `.config/opencode/plugin/tamago/core/stage.ts`
- Create: `.config/opencode/plugin/tamago/core/format.ts`
- Test: `.config/opencode/plugin/tamago/core/stage.test.ts`
- Test: `.config/opencode/plugin/tamago/core/format.test.ts`

**Interfaces:**
- Consumes: `Counters`, `TOOL_KINDS` from `./state.ts`.
- Produces:
  ```ts
  // stage.ts
  export const WEIGHTS: { prompts: number; sessions: number; filesEdited: number; tools: Record<ToolKind, number> }
  export const STAGES: readonly { id: StageId; xp: number }[]   // ascending by xp, first is "egg"
  export type StageId = "egg" | "hatchling" | "young" | "adult" | "elder"
  export function xp(counters: Counters): number
  export function stage(counters: Counters): StageId
  export function stageIndex(id: StageId): number
  export function next(counters: Counters): { stage: StageId; threshold: number; progress: number } | undefined
  // format.ts
  export function fmt(n: number): string          // "1,840"
  export function bar(progress: number, width: number): string   // "[#####-----]"
  ```

- [ ] **Step 1: Write the failing tests**

`core/stage.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, WEIGHTS, next, stage, stageIndex, xp } from "./stage.ts";
import { EMPTY_DELTA, type Counters } from "./state.ts";

const counters = (patch: Partial<Counters>): Counters => ({ ...EMPTY_DELTA, ...patch });

test("xp is the weighted sum from the WEIGHTS table", () => {
  const c = counters({
    prompts: 10,
    sessions: 2,
    filesEdited: 3,
    errors: 99,
    tools: { read: 4, edit: 5, bash: 6, other: 7 },
  });
  const expected =
    10 * WEIGHTS.prompts +
    2 * WEIGHTS.sessions +
    3 * WEIGHTS.filesEdited +
    4 * WEIGHTS.tools.read +
    5 * WEIGHTS.tools.edit +
    6 * WEIGHTS.tools.bash +
    7 * WEIGHTS.tools.other;
  assert.equal(xp(c), expected);
});

test("errors are worth nothing", () => {
  assert.equal(xp(counters({ errors: 1000 })), 0);
});

test("STAGES start at egg with 0 xp and are strictly ascending", () => {
  assert.equal(STAGES[0]?.id, "egg");
  assert.equal(STAGES[0]?.xp, 0);
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok((STAGES[i]?.xp ?? 0) > (STAGES[i - 1]?.xp ?? 0), `stage ${i} threshold`);
  }
});

test("stage picks the highest threshold reached", () => {
  // prompts weigh 2, so prompts = threshold / 2 lands exactly on a threshold.
  for (const entry of STAGES) {
    assert.equal(stage(counters({ prompts: entry.xp / WEIGHTS.prompts })), entry.id);
    if (entry.xp > 0) {
      assert.notEqual(stage(counters({ prompts: entry.xp / WEIGHTS.prompts - 1 })), entry.id);
    }
  }
});

test("stageIndex orders stages", () => {
  assert.equal(stageIndex("egg"), 0);
  assert.ok(stageIndex("elder") > stageIndex("adult"));
});

test("next reports the coming stage and progress inside the current band", () => {
  const hatch = STAGES[1]!;
  const young = STAGES[2]!;
  const midway = (hatch.xp + young.xp) / 2;
  const info = next(counters({ prompts: midway / WEIGHTS.prompts }));
  assert.ok(info);
  assert.equal(info.stage, "young");
  assert.equal(info.threshold, young.xp);
  assert.ok(Math.abs(info.progress - 0.5) < 1e-9);
});

test("next is undefined at the final stage", () => {
  const last = STAGES[STAGES.length - 1]!;
  assert.equal(next(counters({ prompts: last.xp / WEIGHTS.prompts })), undefined);
});
```

`core/format.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bar, fmt } from "./format.ts";

test("fmt groups thousands with commas", () => {
  assert.equal(fmt(0), "0");
  assert.equal(fmt(1840), "1,840");
  assert.equal(fmt(20000), "20,000");
});

test("bar fills proportionally and clamps to [0, 1]", () => {
  assert.equal(bar(0, 10), "[----------]");
  assert.equal(bar(0.5, 10), "[#####-----]");
  assert.equal(bar(1, 10), "[##########]");
  assert.equal(bar(2, 4), "[####]");
  assert.equal(bar(-1, 4), "[----]");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "core/stage.test.ts" "core/format.test.ts"`
Expected: FAIL, cannot find module `./stage.ts` and `./format.ts`.

- [ ] **Step 3: Implement `core/stage.ts`**

```ts
import { TOOL_KINDS, type Counters, type ToolKind } from "./state.ts";

/** XP weights. Tune here, never in code paths. Errors are deliberately absent. */
export const WEIGHTS: {
  prompts: number;
  sessions: number;
  filesEdited: number;
  tools: Record<ToolKind, number>;
} = {
  prompts: 2,
  sessions: 10,
  filesEdited: 5,
  tools: { read: 1, edit: 3, bash: 2, other: 1 },
};

export type StageId = "egg" | "hatchling" | "young" | "adult" | "elder";

/** Ascending thresholds. First guess; tune after a week of real use. */
export const STAGES: readonly { id: StageId; xp: number }[] = [
  { id: "egg", xp: 0 },
  { id: "hatchling", xp: 200 },
  { id: "young", xp: 1_500 },
  { id: "adult", xp: 6_000 },
  { id: "elder", xp: 20_000 },
];

export function xp(counters: Counters): number {
  let total = counters.prompts * WEIGHTS.prompts + counters.sessions * WEIGHTS.sessions + counters.filesEdited * WEIGHTS.filesEdited;
  for (const kind of TOOL_KINDS) total += counters.tools[kind] * WEIGHTS.tools[kind];
  return total;
}

export function stage(counters: Counters): StageId {
  const total = xp(counters);
  let current: StageId = "egg";
  for (const entry of STAGES) if (total >= entry.xp) current = entry.id;
  return current;
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((entry) => entry.id === id);
}

export function next(counters: Counters): { stage: StageId; threshold: number; progress: number } | undefined {
  const total = xp(counters);
  const index = stageIndex(stage(counters));
  const current = STAGES[index];
  const coming = STAGES[index + 1];
  if (!current || !coming) return undefined;
  const span = coming.xp - current.xp;
  return { stage: coming.id, threshold: coming.xp, progress: span > 0 ? (total - current.xp) / span : 1 };
}
```

- [ ] **Step 4: Implement `core/format.ts`**

```ts
const grouped = new Intl.NumberFormat("en-US");

export function fmt(n: number): string {
  return grouped.format(n);
}

export function bar(progress: number, width: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const filled = Math.round(clamped * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}
```

- [ ] **Step 5: Run the tests and tsc**

```bash
node --test "core/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`.

- [ ] **Step 6: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/core/stage.ts .config/opencode/plugin/tamago/core/stage.test.ts .config/opencode/plugin/tamago/core/format.ts .config/opencode/plugin/tamago/core/format.test.ts
git commit -m "feat(opencode): add tamago xp, stages and formatting"
```

---

### Task 6: Sprites

**Files:**
- Create: `.config/opencode/plugin/tamago/core/sprites.ts`
- Test: `.config/opencode/plugin/tamago/core/sprites.test.ts`

**Interfaces:**
- Consumes: `Activity`, `ACTIVITIES` from `./state.ts`; `StageId`, `STAGES` from `./stage.ts`.
- Produces:
  ```ts
  export const SPRITE_WIDTH = 11
  export const SPRITE_HEIGHT = 5
  export type Frame = readonly string[]
  export function frames(stage: StageId, activity: Activity): readonly Frame[]   // at least one frame
  export function frameAt(stage: StageId, activity: Activity, index: number): Frame  // index wraps
  ```

Design: each stage is a body template `(eyes, mark) => lines`; each activity is a list of faces `{ eyes, mark }`. A frame is the stage body with the activity's face applied. `eyes` is exactly 3 characters (`o o`, `- -`, `x x`, `O O`), `mark` exactly 1 character shown at the top right (`?`, `!`, `z`, a spinner glyph, or a space).

- [ ] **Step 1: Write the failing tests**

`core/sprites.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SPRITE_HEIGHT, SPRITE_WIDTH, frameAt, frames } from "./sprites.ts";
import { STAGES } from "./stage.ts";
import { ACTIVITIES } from "./state.ts";

test("every stage and activity has at least one frame", () => {
  for (const { id } of STAGES) {
    for (const activity of ACTIVITIES) {
      assert.ok(frames(id, activity).length >= 1, `${id}/${activity}`);
    }
  }
});

test("every frame is exactly SPRITE_HEIGHT lines of SPRITE_WIDTH columns", () => {
  for (const { id } of STAGES) {
    for (const activity of ACTIVITIES) {
      for (const [i, frame] of frames(id, activity).entries()) {
        assert.equal(frame.length, SPRITE_HEIGHT, `${id}/${activity} frame ${i} height`);
        for (const [j, line] of frame.entries()) {
          assert.equal(line.length, SPRITE_WIDTH, `${id}/${activity} frame ${i} line ${j}: ${JSON.stringify(line)}`);
        }
      }
    }
  }
});

test("working has more than one frame so it animates, sleeping has exactly one", () => {
  assert.ok(frames("egg", "working").length > 1);
  assert.equal(frames("egg", "sleeping").length, 1);
});

test("frameAt wraps around the frame count", () => {
  const all = frames("hatchling", "idle");
  assert.deepEqual(frameAt("hatchling", "idle", all.length), all[0]);
  assert.deepEqual(frameAt("hatchling", "idle", all.length + 1), all[1]);
});

test("frames only contain printable ASCII", () => {
  for (const { id } of STAGES) {
    for (const activity of ACTIVITIES) {
      for (const frame of frames(id, activity)) {
        for (const line of frame) assert.match(line, /^[\x20-\x7e]*$/, `${id}/${activity}: ${line}`);
      }
    }
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "core/sprites.test.ts"`
Expected: FAIL, cannot find module `./sprites.ts`.

- [ ] **Step 3: Implement `core/sprites.ts`**

```ts
import type { StageId } from "./stage.ts";
import type { Activity } from "./state.ts";

export const SPRITE_WIDTH = 11;
export const SPRITE_HEIGHT = 5;

export type Frame = readonly string[];

type Face = { eyes: string; mark: string };
type Body = (eyes: string, mark: string) => string[];

/** Pads every line to SPRITE_WIDTH so a short line never shifts the layout. */
function fit(lines: string[]): Frame {
  return lines.map((line) => line.padEnd(SPRITE_WIDTH));
}

const BODIES: Record<StageId, Body> = {
  egg: (e, m) => [
    `   .---.  ${m}`,
    "  /     \\",
    ` |  ${e}  |`,
    "  \\     /",
    "   '---'",
  ],
  hatchling: (e, m) => [
    `   .---.  ${m}`,
    `  ( ${e} )`,
    "   \\ ^ /",
    "    '-'",
    "",
  ],
  young: (e, m) => [
    `   .---.  ${m}`,
    `  ( ${e} )`,
    "  /| ^ |\\",
    "   |___|",
    "   /   \\",
  ],
  adult: (e, m) => [
    `  /\\   /\\ ${m}`,
    `  ( ${e} )`,
    " /| ^^^ |\\",
    "  |_____|",
    "  /|   |\\",
  ],
  elder: (e, m) => [
    `  \\|/ \\|/ ${m}`,
    `  ( ${e} )`,
    " /|~^^^~|\\",
    "  |_____|",
    "  /|   |\\",
  ],
};

const FACES: Record<Activity, readonly Face[]> = {
  idle: [
    { eyes: "o o", mark: " " },
    { eyes: "- -", mark: " " },
  ],
  thinking: [
    { eyes: "o o", mark: "." },
    { eyes: "o o", mark: "?" },
  ],
  working: [
    { eyes: "o o", mark: "|" },
    { eyes: "o o", mark: "/" },
    { eyes: "o o", mark: "-" },
    { eyes: "o o", mark: "\\" },
  ],
  waiting: [
    { eyes: "O O", mark: "!" },
    { eyes: "O O", mark: " " },
  ],
  hurt: [
    { eyes: "x x", mark: "*" },
    { eyes: "x x", mark: " " },
  ],
  sleeping: [{ eyes: "- -", mark: "z" }],
};

export function frames(stage: StageId, activity: Activity): readonly Frame[] {
  const body = BODIES[stage];
  return FACES[activity].map((face) => fit(body(face.eyes, face.mark)));
}

export function frameAt(stage: StageId, activity: Activity, index: number): Frame {
  const all = frames(stage, activity);
  const frame = all[((index % all.length) + all.length) % all.length];
  return frame ?? fit([]);
}
```

- [ ] **Step 4: Run the tests; fix any line that is too wide**

```bash
node --test "core/sprites.test.ts"
```
Expected: PASS. If a width assertion fails, the message names the stage, activity, and offending line; trim that template line so it is at most 11 columns (padding handles shorter lines). Do not change `SPRITE_WIDTH`.

- [ ] **Step 5: Run everything and tsc**

```bash
node --test "core/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`.

- [ ] **Step 6: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/core/sprites.ts .config/opencode/plugin/tamago/core/sprites.test.ts
git commit -m "feat(opencode): add tamago sprites"
```

---

### Task 7: Lock decision

**Files:**
- Create: `.config/opencode/plugin/tamago/core/lock.ts`
- Test: `.config/opencode/plugin/tamago/core/lock.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LOCK_STALE_MS = 10_000
  export type LockDecision = "acquire" | "steal" | "wait"
  export function decideLock(input: { held: boolean; heldSinceMs?: number; now: number }): LockDecision
  ```

- [ ] **Step 1: Write the failing tests**

`core/lock.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_STALE_MS, decideLock } from "./lock.ts";

test("a free lock is acquired", () => {
  assert.equal(decideLock({ held: false, now: 1000 }), "acquire");
});

test("a fresh lock makes us wait", () => {
  assert.equal(decideLock({ held: true, heldSinceMs: 1000, now: 1000 + LOCK_STALE_MS - 1 }), "wait");
});

test("a lock older than LOCK_STALE_MS is stolen", () => {
  assert.equal(decideLock({ held: true, heldSinceMs: 1000, now: 1000 + LOCK_STALE_MS }), "steal");
});

test("a held lock with unknown age makes us wait", () => {
  assert.equal(decideLock({ held: true, now: 5000 }), "wait");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "core/lock.test.ts"`
Expected: FAIL, cannot find module `./lock.ts`.

- [ ] **Step 3: Implement `core/lock.ts`**

```ts
/** A lock directory older than this is assumed orphaned by a crashed instance. */
export const LOCK_STALE_MS = 10_000;

export type LockDecision = "acquire" | "steal" | "wait";

export function decideLock(input: { held: boolean; heldSinceMs?: number; now: number }): LockDecision {
  if (!input.held) return "acquire";
  if (input.heldSinceMs === undefined) return "wait";
  return input.now - input.heldSinceMs >= LOCK_STALE_MS ? "steal" : "wait";
}
```

- [ ] **Step 4: Run the tests and tsc**

```bash
node --test "core/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`.

- [ ] **Step 5: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/core/lock.ts .config/opencode/plugin/tamago/core/lock.test.ts
git commit -m "feat(opencode): add tamago lock decision"
```

---

### Task 8: SDK event translator

**Files:**
- Create: `.config/opencode/plugin/tamago/adapter/translate.ts`
- Test: `.config/opencode/plugin/tamago/adapter/translate.test.ts`

**Interfaces:**
- Consumes: `TamagoEvent` from `../core/events.ts`; `ToolKind` from `../core/state.ts`; `type Event` from `@opencode-ai/sdk/v2` (type-only import, erased at runtime).
- Produces:
  ```ts
  export function toolKind(name: string): ToolKind
  export function createTranslator(): (event: Event) => TamagoEvent[]
  ```
  The translator is stateful: it deduplicates repeated `running` updates per `callID`, repeated `completed`/`error` per `callID`, and repeated `message.updated` per user message id. It never throws on unknown shapes; it returns `[]`.

- [ ] **Step 1: Write the failing tests**

`adapter/translate.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "@opencode-ai/sdk/v2";
import { createTranslator, toolKind } from "./translate.ts";

// Minimal event shapes. Only the fields the translator reads are present.
const ev = (value: unknown): Event => value as Event;

const toolPart = (callID: string, tool: string, status: string) =>
  ev({ type: "message.part.updated", properties: { sessionID: "s", time: 0, part: { type: "tool", callID, tool, state: { status } } } });

test("toolKind buckets tool names", () => {
  assert.equal(toolKind("read"), "read");
  assert.equal(toolKind("glob"), "read");
  assert.equal(toolKind("grep"), "read");
  assert.equal(toolKind("edit"), "edit");
  assert.equal(toolKind("write"), "edit");
  assert.equal(toolKind("bash"), "bash");
  assert.equal(toolKind("webfetch"), "other");
});

test("a tool part going running then completed yields started then finished, once each", () => {
  const t = createTranslator();
  assert.deepEqual(t(toolPart("c1", "edit", "pending")), []);
  assert.deepEqual(t(toolPart("c1", "edit", "running")), [{ type: "tool_started" }]);
  assert.deepEqual(t(toolPart("c1", "edit", "running")), []);
  assert.deepEqual(t(toolPart("c1", "edit", "completed")), [{ type: "tool_finished", kind: "edit" }]);
  assert.deepEqual(t(toolPart("c1", "edit", "completed")), []);
});

test("an error state yields tool_failed", () => {
  const t = createTranslator();
  t(toolPart("c2", "bash", "running"));
  assert.deepEqual(t(toolPart("c2", "bash", "error")), [{ type: "tool_failed" }]);
});

test("a completion whose start was never seen still balances the running count", () => {
  const t = createTranslator();
  assert.deepEqual(t(toolPart("c3", "read", "completed")), [{ type: "tool_started" }, { type: "tool_finished", kind: "read" }]);
});

test("non-tool parts are ignored", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "message.part.updated", properties: { part: { type: "text", text: "hi" } } })), []);
});

test("a user message counts one prompt even when updated several times", () => {
  const t = createTranslator();
  const msg = ev({ type: "message.updated", properties: { sessionID: "s", info: { id: "m1", role: "user" } } });
  assert.deepEqual(t(msg), [{ type: "prompt_sent" }]);
  assert.deepEqual(t(msg), []);
  const assistant = ev({ type: "message.updated", properties: { sessionID: "s", info: { id: "m2", role: "assistant" } } });
  assert.deepEqual(t(assistant), []);
});

test("simple events map one to one", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "file.edited", properties: { file: "a.ts" } })), [{ type: "file_edited" }]);
  assert.deepEqual(t(ev({ type: "permission.asked", properties: {} })), [{ type: "permission_asked" }]);
  assert.deepEqual(t(ev({ type: "permission.replied", properties: {} })), [{ type: "permission_replied" }]);
  assert.deepEqual(t(ev({ type: "session.idle", properties: {} })), [{ type: "session_idle" }]);
  assert.deepEqual(t(ev({ type: "session.error", properties: {} })), [{ type: "session_error" }]);
});

test("session.created counts only top-level sessions", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.created", properties: { info: { id: "a" } } })), [{ type: "session_started" }]);
  assert.deepEqual(t(ev({ type: "session.created", properties: { info: { id: "b", parentID: "a" } } })), []);
});

test("unknown or malformed events yield nothing and do not throw", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.compacted", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "message.part.updated", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "message.updated", properties: {} })), []);
  assert.deepEqual(t(ev({})), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "adapter/translate.test.ts"`
Expected: FAIL, cannot find module `./translate.ts`.

- [ ] **Step 3: Implement `adapter/translate.ts`**

```ts
import type { Event } from "@opencode-ai/sdk/v2";
import type { TamagoEvent } from "../core/events.ts";
import type { ToolKind } from "../core/state.ts";

const KIND_BY_TOOL: Record<string, ToolKind> = {
  read: "read",
  glob: "read",
  grep: "read",
  list: "read",
  edit: "edit",
  write: "edit",
  patch: "edit",
  multiedit: "edit",
  bash: "bash",
};

export function toolKind(name: string): ToolKind {
  return KIND_BY_TOOL[name] ?? "other";
}

/** Bounded set: forget everything once it grows past this many ids. */
const MAX_REMEMBERED = 5_000;

function remember(set: Set<string>, id: string): void {
  if (set.size >= MAX_REMEMBERED) set.clear();
  set.add(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createTranslator(): (event: Event) => TamagoEvent[] {
  const running = new Set<string>();
  const done = new Set<string>();
  const prompts = new Set<string>();

  return (event) => {
    const props: unknown = isRecord(event) ? event.properties : undefined;
    switch (event.type) {
      case "message.part.updated": {
        const part = isRecord(props) ? props.part : undefined;
        if (!isRecord(part) || part.type !== "tool") return [];
        const callID = typeof part.callID === "string" ? part.callID : "";
        const tool = typeof part.tool === "string" ? part.tool : "";
        const state = isRecord(part.state) ? part.state : undefined;
        const status = state && typeof state.status === "string" ? state.status : "";
        if (status === "running") {
          if (running.has(callID) || done.has(callID)) return [];
          remember(running, callID);
          return [{ type: "tool_started" }];
        }
        if (status === "completed" || status === "error") {
          if (done.has(callID)) return [];
          remember(done, callID);
          const started = running.delete(callID);
          const out: TamagoEvent[] = started ? [] : [{ type: "tool_started" }];
          out.push(status === "completed" ? { type: "tool_finished", kind: toolKind(tool) } : { type: "tool_failed" });
          return out;
        }
        return [];
      }
      case "message.updated": {
        const info = isRecord(props) ? props.info : undefined;
        if (!isRecord(info) || info.role !== "user" || typeof info.id !== "string") return [];
        if (prompts.has(info.id)) return [];
        remember(prompts, info.id);
        return [{ type: "prompt_sent" }];
      }
      case "file.edited":
        return [{ type: "file_edited" }];
      case "permission.asked":
        return [{ type: "permission_asked" }];
      case "permission.replied":
        return [{ type: "permission_replied" }];
      case "session.idle":
        return [{ type: "session_idle" }];
      case "session.error":
        return [{ type: "session_error" }];
      case "session.created": {
        const info = isRecord(props) ? props.info : undefined;
        if (isRecord(info) && typeof info.parentID === "string") return [];
        return [{ type: "session_started" }];
      }
      default:
        return [];
    }
  };
}
```
The defensive `isRecord` checks exist because the translator is the boundary with the outside world: the spec says malformed events are ignored, not translated, and the plugin must never throw into the TUI.

- [ ] **Step 4: Run the tests and tsc**

```bash
node --test "core/*.test.ts" "adapter/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`. If tsc cannot resolve `@opencode-ai/sdk/v2`, confirm `@opencode-ai/sdk` is in `devDependencies` (Task 1) and installed.

- [ ] **Step 5: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/adapter/translate.ts .config/opencode/plugin/tamago/adapter/translate.test.ts
git commit -m "feat(opencode): translate sdk events into tamago events"
```

---

### Task 9: Disk store with lock and atomic rename, plus error log

**Files:**
- Create: `.config/opencode/plugin/tamago/adapter/store.ts`
- Create: `.config/opencode/plugin/tamago/adapter/log.ts`
- Test: `.config/opencode/plugin/tamago/adapter/store.test.ts`

**Interfaces:**
- Consumes: `hydrate`, `freshCareer`, `Career`, `Delta` from `../core/state.ts`; `merge` from `../core/merge.ts`; `decideLock` from `../core/lock.ts`.
- Produces:
  ```ts
  // store.ts
  export type Loaded = { career: Career; corrupt: boolean }
  export type Store = { load(): Loaded; flush(delta: Delta): Career | undefined }
  export function createStore(dir: string, now?: () => number): Store
  export const CAREER_FILE = "career.json"
  export const LOCK_DIR = "career.lock"
  // log.ts
  export function logError(dir: string, err: unknown): void
  ```
  `flush` returns the merged career on success and `undefined` when the lock is held, in which case the caller must keep its delta.

- [ ] **Step 1: Write the failing tests**

`adapter/store.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, utimesSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOCK_STALE_MS } from "../core/lock.ts";
import { EMPTY_DELTA, freshCareer, type Delta } from "../core/state.ts";
import { CAREER_FILE, LOCK_DIR, createStore } from "./store.ts";

const scratch = () => mkdtempSync(join(tmpdir(), "tamago-store-"));
const d = (patch: Partial<Delta>): Delta => ({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, ...patch });

test("load on an empty directory yields a fresh, non-corrupt egg and creates the directory", () => {
  const dir = join(scratch(), "nested", "deeper");
  const store = createStore(dir, () => 42);
  const loaded = store.load();
  assert.equal(loaded.corrupt, false);
  assert.deepEqual(loaded.career, freshCareer(42));
  assert.ok(existsSync(dir));
});

test("flush merges deltas into the file and returns the merged career", () => {
  const dir = scratch();
  const store = createStore(dir, () => 7);
  const first = store.flush(d({ prompts: 2 }));
  assert.ok(first);
  assert.equal(first.prompts, 2);
  const second = store.flush(d({ prompts: 1, filesEdited: 3 }));
  assert.ok(second);
  assert.equal(second.prompts, 3);
  assert.equal(second.filesEdited, 3);
  assert.equal(second.hatchedAt, 7);
  const onDisk = JSON.parse(readFileSync(join(dir, CAREER_FILE), "utf8"));
  assert.equal(onDisk.prompts, 3);
  assert.ok(!existsSync(join(dir, LOCK_DIR)), "lock released");
});

test("two stores over the same directory see each other's progress", () => {
  const dir = scratch();
  const a = createStore(dir);
  const b = createStore(dir);
  a.flush(d({ sessions: 1 }));
  b.flush(d({ sessions: 1 }));
  assert.equal(a.load().career.sessions, 2);
});

test("a corrupt file loads as a fresh egg flagged corrupt", () => {
  const dir = scratch();
  writeFileSync(join(dir, CAREER_FILE), "{not json");
  const loaded = createStore(dir, () => 3).load();
  assert.equal(loaded.corrupt, true);
  assert.deepEqual(loaded.career, freshCareer(3));
});

test("flush waits while a fresh lock is held", () => {
  const dir = scratch();
  mkdirSync(join(dir, LOCK_DIR));
  const store = createStore(dir);
  assert.equal(store.flush(d({ prompts: 1 })), undefined);
  assert.ok(existsSync(join(dir, LOCK_DIR)), "foreign lock left alone");
});

test("flush steals a stale lock", () => {
  const dir = scratch();
  const lock = join(dir, LOCK_DIR);
  mkdirSync(lock);
  const old = (Date.now() - LOCK_STALE_MS - 1000) / 1000;
  utimesSync(lock, old, old);
  const merged = createStore(dir).flush(d({ prompts: 1 }));
  assert.ok(merged);
  assert.equal(merged.prompts, 1);
  assert.ok(!existsSync(lock), "lock released after steal");
});

test("flush leaves no temporary files behind", () => {
  const dir = scratch();
  createStore(dir).flush(d({ errors: 1 }));
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  assert.deepEqual(readdirSync(dir).sort(), [CAREER_FILE]);
});
```
Note the last test uses `require` inside an ESM test only to keep imports tidy; if Node rejects it, import `readdirSync` at the top with the others instead.

- [ ] **Step 2: Run the tests to verify they fail**

`node --test "adapter/store.test.ts"`
Expected: FAIL, cannot find module `./store.ts`.

- [ ] **Step 3: Implement `adapter/log.ts`**

```ts
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const ERROR_LOG = "error.log";

/** Best effort: logging must never throw into the TUI. */
export function logError(dir: string, err: unknown): void {
  try {
    mkdirSync(dir, { recursive: true });
    const text = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    appendFileSync(join(dir, ERROR_LOG), `${new Date().toISOString()} ${text}\n`);
  } catch {
    // Nothing left to do.
  }
}
```

- [ ] **Step 4: Implement `adapter/store.ts`**

```ts
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decideLock } from "../core/lock.ts";
import { merge } from "../core/merge.ts";
import { freshCareer, hydrate, type Career, type Delta } from "../core/state.ts";

export const CAREER_FILE = "career.json";
export const LOCK_DIR = "career.lock";

export type Loaded = { career: Career; corrupt: boolean };
export type Store = {
  load(): Loaded;
  /** Returns the merged career, or undefined when another instance holds the lock. */
  flush(delta: Delta): Career | undefined;
};

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}

export function createStore(dir: string, now: () => number = Date.now): Store {
  const file = join(dir, CAREER_FILE);
  const lock = join(dir, LOCK_DIR);

  function read(): Loaded {
    mkdirSync(dir, { recursive: true });
    try {
      return hydrate(JSON.parse(readFileSync(file, "utf8")), now());
    } catch (err) {
      if (isNotFound(err)) return { career: freshCareer(now()), corrupt: false };
      return { career: freshCareer(now()), corrupt: true };
    }
  }

  function acquire(): boolean {
    mkdirSync(dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        mkdirSync(lock);
        return true;
      } catch {
        let heldSinceMs: number | undefined;
        try {
          heldSinceMs = statSync(lock).mtimeMs;
        } catch {
          heldSinceMs = undefined;
        }
        const decision = decideLock({ held: true, heldSinceMs, now: now() });
        if (decision !== "steal") return false;
        rmSync(lock, { recursive: true, force: true });
      }
    }
    return false;
  }

  function release(): void {
    rmSync(lock, { recursive: true, force: true });
  }

  return {
    load: read,
    flush(delta) {
      if (!acquire()) return undefined;
      try {
        const merged = merge(read().career, delta);
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(merged, null, 2));
        renameSync(tmp, file);
        return merged;
      } finally {
        release();
      }
    },
  };
}
```
`decideLock` uses the lock directory's mtime as its age. `now()` defaults to `Date.now` so the stale test, which backdates the directory with `utimesSync`, compares against real time.

- [ ] **Step 5: Run the tests and tsc**

```bash
node --test "core/*.test.ts" "adapter/*.test.ts" && ./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: all pass, `OK`.

- [ ] **Step 6: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/adapter/store.ts .config/opencode/plugin/tamago/adapter/log.ts .config/opencode/plugin/tamago/adapter/store.test.ts
git commit -m "feat(opencode): persist tamago career with a lock and atomic rename"
```

---

### Task 10: Views

**Files:**
- Create: `.config/opencode/plugin/tamago/view/sidebar.tsx`
- Create: `.config/opencode/plugin/tamago/view/home.tsx`

**Interfaces:**
- Consumes: `frameAt` from `../core/sprites.ts`; `stage`, `xp`, `next` from `../core/stage.ts`; `fmt`, `bar` from `../core/format.ts`; `Activity`, `Career`, `Session` from `../core/state.ts`; `TuiThemeCurrent` from `@opencode-ai/plugin/tui`.
- Produces:
  ```tsx
  // sidebar.tsx
  export const MOOD: Record<Activity, string>
  export function spriteColor(theme: TuiThemeCurrent, activity: Activity): RGBA
  export type FooterInfo = { parent: string; name: string; version: string }
  export function SidebarView(props: {
    name: string
    theme: () => TuiThemeCurrent
    session: () => Session
    career: () => Career
    frame: () => number
    footer: () => FooterInfo
  }): JSX.Element
  // home.tsx
  export function HomeView(props: {
    name: string
    theme: () => TuiThemeCurrent
    career: () => Career
    frame: () => number
  }): JSX.Element
  ```
  Props are accessors so Solid re-renders when the signals behind them change.

No automated tests for views; the gate is `tsc --noEmit` here and a visual check in Task 11.

- [ ] **Step 1: Write `view/sidebar.tsx`**

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { stage, xp } from "../core/stage.ts";
import type { Activity, Career, Session } from "../core/state.ts";

export const MOOD: Record<Activity, string> = {
  idle: "chilling",
  thinking: "thinking...",
  working: "working",
  waiting: "needs you",
  hurt: "ouch",
  sleeping: "zzz",
};

export function spriteColor(theme: TuiThemeCurrent, activity: Activity): RGBA {
  switch (activity) {
    case "hurt":
      return theme.error;
    case "waiting":
      return theme.warning;
    case "sleeping":
      return theme.textMuted;
    default:
      return theme.accent;
  }
}

export type FooterInfo = { parent: string; name: string; version: string };

export function SidebarView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  session: () => Session;
  career: () => Career;
  frame: () => number;
  footer: () => FooterInfo;
}): JSX.Element {
  const lines = () => frameAt(stage(props.career()), props.session().activity, props.frame());
  const color = () => spriteColor(props.theme(), props.session().activity);

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={2}>
        <box flexDirection="column" flexShrink={0}>
          {lines().map((line) => (
            <text fg={color()}>{line}</text>
          ))}
        </box>
        <box flexDirection="column" justifyContent="center">
          <text fg={props.theme().text}>
            <b>{props.name}</b>
          </text>
          <text fg={props.theme().textMuted}>
            {stage(props.career())} · {fmt(xp(props.career()))} xp
          </text>
          <text fg={props.theme().textMuted}>{MOOD[props.session().activity]}</text>
        </box>
      </box>
      <text>
        <span style={{ fg: props.theme().textMuted }}>{props.footer().parent}/</span>
        <span style={{ fg: props.theme().text }}>{props.footer().name}</span>
      </text>
      <text fg={props.theme().textMuted}>
        <span style={{ fg: props.theme().success }}>•</span> <b>Open</b>
        <span style={{ fg: props.theme().text }}>
          <b>Code</b>
        </span>{" "}
        <span>{props.footer().version}</span>
      </text>
    </box>
  );
}
```
The last two `<text>` blocks reproduce the built-in footer (directory with branch, then the OpenCode version line) that our `single_winner` registration replaces.

- [ ] **Step 2: Write `view/home.tsx`**

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { bar, fmt } from "../core/format.ts";
import { frameAt } from "../core/sprites.ts";
import { next, stage, xp } from "../core/stage.ts";
import { TOOL_KINDS, type Career } from "../core/state.ts";

const BAR_WIDTH = 20;

export function HomeView(props: {
  name: string;
  theme: () => TuiThemeCurrent;
  career: () => Career;
  frame: () => number;
}): JSX.Element {
  const lines = () => frameAt(stage(props.career()), "idle", props.frame());
  const tools = () => TOOL_KINDS.reduce((sum, kind) => sum + props.career().tools[kind], 0);
  const progress = () => {
    const coming = next(props.career());
    if (!coming) return `${bar(1, BAR_WIDTH)} ${fmt(xp(props.career()))} xp · final form`;
    return `${bar(coming.progress, BAR_WIDTH)} ${fmt(xp(props.career()))} / ${fmt(coming.threshold)} xp → ${coming.stage}`;
  };

  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="column">
        {lines().map((line) => (
          <text fg={props.theme().accent}>{line}</text>
        ))}
      </box>
      <text fg={props.theme().text}>
        <b>{props.name}</b>
        <span style={{ fg: props.theme().textMuted }}> · {stage(props.career())}</span>
      </text>
      <text fg={props.theme().textMuted}>{progress()}</text>
      <text fg={props.theme().textMuted}>
        sessions {fmt(props.career().sessions)} · prompts {fmt(props.career().prompts)} · tools {fmt(tools())} · files{" "}
        {fmt(props.career().filesEdited)}
      </text>
    </box>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: `OK`. If tsc reports that `<box>` or `<text>` are unknown JSX elements, the `jsxImportSource` in `tsconfig.json` is not `@opentui/solid` or `@opentui/solid` is not installed. If it reports `RGBA` is not exported from `@opentui/core`, change the `spriteColor` return type to `TuiThemeCurrent["accent"]`.

- [ ] **Step 4: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/view/sidebar.tsx .config/opencode/plugin/tamago/view/home.tsx
git commit -m "feat(opencode): add tamago sidebar and home views"
```

---

### Task 11: Plugin entry, registration in `tui.jsonc`, live check

**Files:**
- Create: `.config/opencode/plugin/tamago/index.tsx`
- Modify: `.config/opencode/tui.jsonc` (the `plugin` array)

**Interfaces:**
- Consumes: everything above.
- Produces: `export default { id: "opencode-tamago", tui }` as a `TuiPluginModule`.

- [ ] **Step 1: Write `index.tsx`**

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { logError } from "./adapter/log.ts";
import { createStore } from "./adapter/store.ts";
import { createTranslator } from "./adapter/translate.ts";
import type { TamagoEvent } from "./core/events.ts";
import { merge } from "./core/merge.ts";
import { reduce } from "./core/reduce.ts";
import { stage, stageIndex, type StageId } from "./core/stage.ts";
import { EMPTY_DELTA, addDelta, initialSession, isEmpty, type Career, type Delta, type Session } from "./core/state.ts";
import { HomeView } from "./view/home.tsx";
import { SidebarView, type FooterInfo } from "./view/sidebar.tsx";

const id = "opencode-tamago";
const DATA_DIR = join(homedir(), ".local", "share", "opencode-tamago");
const TICK_MS = 500;
const FLUSH_MS = 2_000;
/** Slow animations advance once every this many ticks (2 s). */
const SLOW_FRAME_TICKS = 4;
/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;

const SUBSCRIBED = [
  "message.part.updated",
  "message.updated",
  "file.edited",
  "permission.asked",
  "permission.replied",
  "session.idle",
  "session.error",
  "session.created",
] as const;

const tui: TuiPlugin = async (api, options) => {
  const name = typeof options?.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
  const store = createStore(DATA_DIR);
  const translate = createTranslator();

  const loaded = store.load();
  const [career, setCareer] = createSignal<Career>(loaded.career);
  const [session, setSession] = createSignal<Session>(initialSession(Date.now()));
  const [ticks, setTicks] = createSignal(0);
  let pending: Delta = EMPTY_DELTA;
  let known: StageId = stage(loaded.career);

  if (loaded.corrupt) {
    api.ui.toast({ variant: "warning", title: name, message: "Saved progress was unreadable. Starting from a fresh egg." });
  }

  const guard =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      try {
        fn(...args);
      } catch (err) {
        logError(DATA_DIR, err);
      }
    };

  const announce = (next: Career) => {
    const current = stage(next);
    if (stageIndex(current) > stageIndex(known)) {
      api.ui.toast({ variant: "success", title: name, message: `${name} evolved: ${current}!` });
    }
    known = current;
  };

  const show = (next: Career) => {
    setCareer(next);
    announce(next);
  };

  const apply = (event: TamagoEvent) => {
    const out = reduce(session(), event, Date.now());
    setSession(out.session);
    if (isEmpty(out.delta)) return;
    pending = addDelta(pending, out.delta);
    show(merge(career(), out.delta));
  };

  const onEvent = guard((event: Event) => {
    for (const internal of translate(event)) apply(internal);
  });
  for (const type of SUBSCRIBED) api.lifecycle.onDispose(api.event.on(type, onEvent));

  const tick = setInterval(
    guard(() => {
      apply({ type: "tick" });
      setTicks((t) => t + 1);
    }),
    TICK_MS,
  );

  const flush = guard(() => {
    if (isEmpty(pending)) {
      // Nothing of ours to write, but other instances may have progressed.
      const fresh = store.load();
      if (!fresh.corrupt) show(fresh.career);
      return;
    }
    const merged = store.flush(pending);
    if (!merged) return; // lock held elsewhere: keep the delta, retry next time
    pending = EMPTY_DELTA;
    show(merged);
  });
  const flusher = setInterval(flush, FLUSH_MS);

  api.lifecycle.onDispose(() => {
    clearInterval(tick);
    clearInterval(flusher);
    if (!isEmpty(pending) && store.flush(pending)) pending = EMPTY_DELTA;
  });

  const frame = () => {
    const activity = session().activity;
    if (activity === "working" || activity === "thinking") return ticks();
    if (activity === "sleeping") return 0;
    return Math.floor(ticks() / SLOW_FRAME_TICKS);
  };

  const footer = (sessionID: string) => (): FooterInfo => {
    const info = api.state.session.get(sessionID);
    const dir = info?.directory || api.state.path.directory;
    const home = homedir();
    const short = dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
    const branch = info?.directory === api.state.path.directory ? api.state.vcs?.branch : undefined;
    const parts = (branch ? `${short}:${branch}` : short).split("/");
    return { parent: parts.slice(0, -1).join("/"), name: parts.at(-1) ?? "", version: api.app.version };
  };

  api.slots.register({
    order: FOOTER_ORDER,
    slots: {
      sidebar_footer(ctx, props) {
        return (
          <SidebarView
            name={name}
            theme={() => ctx.theme.current}
            session={session}
            career={career}
            frame={frame}
            footer={footer(props.session_id)}
          />
        );
      },
    },
  });

  api.slots.register({
    slots: {
      home_logo(ctx) {
        return <HomeView name={name} theme={() => ctx.theme.current} career={career} frame={frame} />;
      },
    },
  });
};

const plugin: TuiPluginModule & { id: string } = { id, tui };

export default plugin;
```

- [ ] **Step 2: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit && echo OK
```
Expected: `OK`. Likely friction points and their fixes:
- `api.event.on(type, onEvent)` rejects the handler type: change `onEvent`'s parameter to `(event: Event)` exactly as written; the handler accepting the full union is assignable to a handler for any member.
- `ctx.theme.current` not found: the slot context type is `TuiSlotContext = { theme: TuiTheme }`; `TuiTheme.current` is `TuiThemeCurrent`. Check the import of the view prop type.
- `api.state.vcs` possibly undefined: already handled with `?.`.

- [ ] **Step 3: Register the plugin in `tui.jsonc`**

Edit `.config/opencode/tui.jsonc` so the `plugin` array reads:
```jsonc
  "plugin": [
    "@slkiser/opencode-quota@latest",
    ["./plugin/tamago/index.tsx", { "name": "Tamago" }]
  ]
```
Keep the existing comments above the array untouched.

- [ ] **Step 4: Launch OpenCode and check the home screen**

Run `opencode` in any project. Expected on the home screen: the egg sprite replaces the OpenCode logo, followed by `Tamago · egg`, a progress bar line `[--------------------] 0 / 200 xp → hatchling`, and the counters line at zero. If the logo is unchanged, check `~/.local/share/opencode-tamago/error.log` and the OpenCode logs under `.config/opencode/logs/` for a load error of `plugin/tamago/index.tsx`.

- [ ] **Step 5: Check the sidebar footer during a session**

Start a session and send a prompt that runs a few tools (for example, ask it to list and read two files). Expected at the bottom of the sidebar: the sprite with eyes `o o` and a spinning mark while tools run, `thinking...` right after the prompt, `working` while tools run, `chilling` once the session goes idle, and below it the directory line and the `• OpenCode <version>` line exactly as before the plugin. The XP line should grow as tools complete. If the footer is not visible, confirm the sidebar is open and the plugin registered with `order: 50`.

- [ ] **Step 6: Check persistence and the corrupt-file path**

```bash
cat ~/.local/share/opencode-tamago/career.json
```
Expected: a JSON object with the counters just earned and no `career.lock` directory next to it. Then quit OpenCode, run `echo '{' > ~/.local/share/opencode-tamago/career.json`, start OpenCode: a warning toast says progress was unreadable, and the home screen shows a fresh egg. Delete the broken file afterwards if you want to keep the earned progress (you cannot; it was overwritten by the test), or leave the fresh egg.

- [ ] **Step 7: Commit (ask the user first)**

```bash
git add .config/opencode/plugin/tamago/index.tsx .config/opencode/tui.jsonc
git commit -m "feat(opencode): add opencode-tamago tui plugin"
```

---

### Task 12: doctor.sh check and parallel-instance validation

**Files:**
- Modify: `scripts/doctor.sh` (insert a new section right after the `open-review` section, before the `Documentation matches reality` section)

**Interfaces:**
- Consumes: the plugin directory from Task 1 and its `tsc`.

- [ ] **Step 1: Add the section to `doctor.sh`**

Insert immediately before the line `# ----...` that precedes `section "Documentation matches reality"`:
```bash
# --------------------------------------------------------------------------
section "opencode-tamago"
# The TUI plugin is raw .tsx that Bun compiles when OpenCode starts; nothing
# checks its types before then, so tsc is the only gate. Same shape as the
# open-review check: warn, not fail, when node_modules is missing so a fresh
# clone still passes.
if [[ -d .config/opencode/plugin/tamago/core ]]; then
  if ! command -v node >/dev/null; then
    warn "node not on PATH -- cannot run the opencode-tamago tests"
  elif (cd .config/opencode/plugin/tamago && node --test "core/*.test.ts" "adapter/*.test.ts" >/dev/null 2>&1); then
    ok "opencode-tamago tests pass"
  else
    fail "opencode-tamago tests fail -- run: (cd .config/opencode/plugin/tamago && node --test \"core/*.test.ts\" \"adapter/*.test.ts\")"
  fi

  if [[ -x .config/opencode/plugin/tamago/node_modules/.bin/tsc ]]; then
    if (cd .config/opencode/plugin/tamago && ./node_modules/.bin/tsc --noEmit >/dev/null 2>&1); then
      ok "opencode-tamago typechecks"
    else
      fail "opencode-tamago has type errors -- run: (cd .config/opencode/plugin/tamago && ./node_modules/.bin/tsc --noEmit)"
    fi
  else
    warn "opencode-tamago typecheck skipped -- run 'pnpm install --ignore-workspace' in .config/opencode/plugin/tamago"
  fi
fi
```
If the `open-review` section is wrapped in a `--quick` guard, wrap this section in the same guard so `--quick` keeps skipping node-based checks. Read lines 182 to 222 of `doctor.sh` to see the exact guard in use.

- [ ] **Step 2: Run doctor and shellcheck**

```bash
shellcheck scripts/doctor.sh && ./scripts/doctor.sh 2>&1 | grep -A3 "opencode-tamago"
```
Expected: shellcheck clean; two `ok` lines for tests and typecheck. `./scripts/doctor.sh --quick` must still exit 0 (the pre-existing tuicr Brewfile warning is known and unrelated).

- [ ] **Step 3: Validate two instances in parallel**

Open two terminals. In each, run `opencode` in a different project. In instance A, run a prompt that executes several tools. Within about 4 seconds, instance B's sidebar XP line should reflect A's progress. Then run tools in both at the same time for a minute, quit both, and check:
```bash
cat ~/.local/share/opencode-tamago/career.json; ls ~/.local/share/opencode-tamago/
```
Expected: counters equal to the sum of what both instances did (compare with the `tools` counts you observed), no `career.lock` directory, no `*.tmp` file, and `error.log` absent or empty.

- [ ] **Step 4: Commit (ask the user first)**

```bash
git add scripts/doctor.sh
git commit -m "chore(doctor): check opencode-tamago tests and types"
```

---

## Self-review against the spec

- **Goal / two kinds of fun:** reactive activity in Task 3 (reducer) and Task 11 (live wiring); progression in Task 5 (stages) and Task 10/11 (home view, evolution toast).
- **Out of scope list:** no `/pet`, no renaming from the TUI, no RTK, no variants, no server plugin, no streak. The `name` option covers renaming from `tui.jsonc` only.
- **One global creature:** single `career.json` under `~/.local/share` (Task 9), not `api.kv`.
- **Parallel instances:** delta accumulation, `mkdir` lock, stale steal at 10 s, atomic rename, re-read on every flush and on empty flush (Tasks 7, 9, 11). Store test covers two stores over one directory, held lock, and stale lock.
- **TUI never crashes:** `guard` around every handler and timer (Task 11); translator ignores malformed events (Task 8); `logError` best effort (Task 9).
- **No package manager in `.config/opencode`:** install confined to the plugin directory with a before/after diff of the parent `node_modules` (Task 1).
- **Layering:** `core/` imports nothing external; `adapter/store.ts` and `adapter/log.ts` are the only `node:fs` users; only `index.tsx` touches `api.*` and timers.
- **State model, internal events, reducer rules:** Task 2 and 3 match the spec tables, including 3 s hurt recovery, 120 s sleep, wake on any non-tick event, `session_idle` resetting running tools, and `tool_finished` keeping `working`.
- **XP table and thresholds:** Task 5, values identical to the spec.
- **Sprites:** Task 6, 5 lines by 11 columns for every stage (the spec allows 6 for elder; 5 is within the rule), animation cadence in Task 11's `frame()`: every tick for working/thinking, every 4 ticks otherwise, frozen when sleeping.
- **Sidebar footer with redrawn directory and version lines, home view with bar and four counters, single evolution toast, corrupt-file warning toast:** Tasks 10 and 11.
- **Fallback to `sidebar_content` if the footer is hidden:** not needed given the upstream layout (footer is outside the scrollbox with `flexShrink={0}`); Task 11 Step 5 confirms visually.
- **Testing list:** reduce, merge, stage, sprites, lock tests exist as named in the spec; translate and store tests were added because those modules carry logic worth pinning. `doctor.sh` gains the tsc check (and the test run) in Task 12.
- **Type consistency check:** `Counters`/`Career`/`Delta` names used identically in Tasks 2 through 11; `frames`/`frameAt` signatures match between Task 6 and Task 10; `next()` returns `{ stage, threshold, progress }` in both Task 5 and Task 10; `createStore` returns `{ load, flush }` in Task 9 and is used that way in Task 11; `FooterInfo` is exported from `view/sidebar.tsx` and imported in `index.tsx`.
