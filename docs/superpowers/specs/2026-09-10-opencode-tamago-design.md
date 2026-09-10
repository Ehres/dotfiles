# opencode-tamago

A terminal tamagotchi that lives inside the OpenCode TUI. It reacts to the
current coding session in real time and grows over the long run from the
accumulated activity across all sessions and projects.

## Goal

Two kinds of fun, nothing else:

- **Reactive companion.** The creature mirrors what the session is doing:
  thinking on a prompt, working while tools run, waiting on a permission,
  hurt on an error, asleep when idle for a while. Zero upkeep.
- **Long-term progression.** Activity accumulates into experience points that
  drive evolution stages, from an egg to an elder form.

Out of scope for this version: a `/pet` command, renaming from the TUI, an RTK
token-savings signal, evolution variants, a server-side plugin, penalties,
death, and streaks.

## Constraints

- One creature, global to the machine, shared by every project.
- Several OpenCode instances run in parallel and must not lose progress.
- The TUI must never crash because of the plugin.
- No package manager run in `.config/opencode` itself (it breaks the LSPs).
- Local file plugin first; extraction to an npm package later if warranted.

## Platform facts this design relies on

Verified against `@opencode-ai/plugin` 1.17.11 and 1.18.30 (identical
`tui.d.ts`) and OpenCode 1.18.30:

- A TUI plugin is a `.tsx` module exporting `{ id, tui }` and is referenced
  from `tui.jsonc` by relative path. OpenCode's own repo does this with
  `.opencode/plugins/tui-smoke.tsx`, so no build step is needed.
- Components are Solid JSX (`/** @jsxImportSource @opentui/solid */`) whose
  elements (`<box>`, `<text>`, `<span>`) come from OpenTUI, Anomalyco's own
  terminal renderer. Bun resolves `@opentui/solid` and `solid-js` from the
  OpenCode installation at runtime.
- The TUI plugin API exposes `api.slots.register` (slots `sidebar_footer`,
  `home_logo` among others), `api.event.on` for every SDK event,
  `api.theme.current` for colors, `api.ui.toast`, and `api.lifecycle`.
- The v2 plugin API is server-side only (agents, commands, skills, catalog,
  integrations) and does not touch the TUI. It is not used here.

## Architecture

TUI-only plugin. The TUI process receives all server events, so a server
plugin adds nothing for this scope.

```
.config/opencode/
  tui.jsonc                      # plugin: ["./plugin/tamago/index.tsx", { name: "Tamago" }]
  plugin/tamago/
    index.tsx                    # adapter: SDK events → core events, state → JSX, disk I/O
    core/
      state.ts                   # Session, Career, Delta types and defaults
      events.ts                  # internal event union
      reduce.ts                  # reduce(session, event, now) → { session, delta }
      merge.ts                   # merge(career, delta) → career
      stage.ts                   # xp(career), stage(career), next(career)
      sprites.ts                 # sprites[stage][activity] → frames
      lock.ts                    # pure decisions about lock ownership and staleness
      *.test.ts                  # node:test, core only
    view/
      sidebar.tsx                # sidebar_footer view
      home.tsx                   # home_logo view
    package.json                 # devDependencies for types only, isolated from the parent
    tsconfig.json                # same rules as open-review (erasableSyntaxOnly, verbatimModuleSyntax)
```

Layering rule, identical to `open-review`: `core/` knows nothing about
OpenCode, Solid, or the terminal and only manipulates data and strings.
`view/` receives state and returns JSX. `index.tsx` is the only module that
touches `api.*`, timers, and the filesystem.

Plugin id: `opencode-tamago`. Default creature name: `Tamago`, overridable
through the plugin options object in `tui.jsonc`.

## State model

```ts
type Activity = "idle" | "thinking" | "working" | "waiting" | "hurt" | "sleeping"

type Session = {           // per instance, never persisted
  activity: Activity
  since: number            // timestamp of the last activity change
  runningTools: number     // tools in flight, to know when work is over
}

type Career = {            // global, persisted on disk
  sessions: number
  prompts: number
  tools: { read: number; edit: number; bash: number; other: number }
  filesEdited: number
  errors: number
  hatchedAt: number
}

type Delta = Omit<Career, "hatchedAt">   // counters gained locally since the last flush
```

The evolution stage is never stored. It is derived from `Career` by
`stage(career)`, so it cannot drift.

### Internal events

The adapter translates SDK events into this union. The core never sees SDK
types, which isolates it from API changes and keeps tests declarative.

| Internal event | Source SDK event |
|---|---|
| `prompt_sent` | user message part updated |
| `tool_started` | tool part status `running` |
| `tool_finished` with tool kind | tool part status `completed` |
| `tool_failed` | tool part status `error` |
| `file_edited` | `file.edited` |
| `permission_asked` | `permission.asked` |
| `permission_replied` | `permission.replied` |
| `session_idle` | `session.idle` |
| `session_error` | `session.error` |
| `session_started` | first event seen for the TUI's current session |
| `tick` | adapter timer, every 500 ms |

Tool kind is mapped from the tool name: `read` for read and glob and grep,
`edit` for edit and write and patch, `bash` for bash, `other` for the rest.

### Reducer rules

`reduce(session, event, now)` returns the new `Session` and a `Delta` to add.

- `prompt_sent` → `thinking`; delta `prompts + 1`.
- `tool_started` → `working`, `runningTools + 1`.
- `tool_finished` → `runningTools - 1`; delta `tools[kind] + 1`; when the
  count reaches zero the activity stays `working` until `session_idle`.
- `tool_failed` → `hurt`, `runningTools - 1`; delta `errors + 1`.
- `session_error` → `hurt`; delta `errors + 1`.
- `permission_asked` → `waiting`. `permission_replied` → `working`.
- `file_edited` → delta `filesEdited + 1`; activity unchanged.
- `session_idle` → `idle`.
- `session_started` → delta `sessions + 1`.
- `tick`: `hurt` older than 3 s returns to the activity it interrupted
  (`working` if tools are running, else `idle`); `idle` older than 120 s
  becomes `sleeping`. Any non-tick event wakes a `sleeping` creature.

## Progression

Experience is a weighted sum over `Career`. Weights and thresholds live in a
table in `stage.ts`, not in code paths.

```
xp = prompts × 2
   + tools.read × 1 + tools.edit × 3 + tools.bash × 2 + tools.other × 1
   + filesEdited × 5
   + sessions × 10
```

Errors add nothing and remove nothing. The creature suffers in the moment,
never over time.

| Stage | XP threshold | Sprite idea |
|---|---|---|
| egg | 0 | an egg that trembles while working |
| hatchling | 200 | a blob with eyes |
| young | 1 500 | a body with small limbs |
| adult | 6 000 | full form |
| elder | 20 000 | full form with a crown or beard |

Thresholds are a first guess. They will be tuned after a week of real use by
editing the table.

Adding a signal is one internal event plus one reducer line plus one weight.
Adding a stage is one table row plus its sprites. Evolution variants, if ever
wanted, would be a `variant(career)` function next to `stage(career)`.

## Persistence with parallel instances

Several TUIs write concurrently, so read-modify-write on a shared file would
lose counters. The design keeps only deltas in memory and merges under a lock.

- File: `~/.local/share/opencode-tamago/career.json`. Not `api.kv`, whose
  write semantics across instances are not under our control.
- Each instance accumulates a `Delta` since its last flush.
- Every 2 s, if the delta is non-empty, the adapter flushes: acquire the lock,
  read `career.json`, `merge(career, delta)`, write to a temporary file in the
  same directory, rename over `career.json`, release the lock, reset the delta.
- Lock: a directory `career.lock` created with `mkdir`, which fails if it
  already exists. On failure the flush is retried at the next tick and the
  delta keeps accumulating, so nothing is lost, only delayed. A lock older
  than 10 s is considered orphaned and taken over.
- Because every flush re-reads the file, each instance sees progress made by
  the others within about 2 s.
- On load, the stored `Career` is merged over defaults so a field added later
  gets its initial value without a migration step. An unreadable file is
  replaced by a fresh egg and a single `warning` toast says so.
- `Session` is per instance and never written.

Evolution toasts fire in each instance when its own view of the stage
changes, so once per open window. Acceptable.

## Rendering

### Sprites

`sprites[stage][activity]` returns a list of frames, each frame an array of
lines. Two frames per pair are enough. The adapter alternates frames every
500 ms in `working` and `thinking`, every 2 s in `idle`, and never in
`sleeping`. All frames of a stage share the same dimensions so the sidebar
never jumps: 5 lines by 11 columns from egg to adult, elder may use 6 lines.

Egg, `idle` then `working`:

```
   .---.        .---.
  /     \      /  ~  \
 |   .   |    | ~   ~ |
  \     /      \  ~  /
   '---'        '---'
```

Hatchling, `hurt` then `sleeping`:

```
   .---.        .---.
  ( x x )      ( - - )  z
   \ ^ /        \ _ /  Z
    '-'          '-'
```

Colors come from `api.theme.current`, never hardcoded: `accent` for eyes,
`error` in `hurt`, `warning` in `waiting`, `textMuted` in `sleeping`.

### Sidebar view (`sidebar_footer`)

Sprite on the left, three lines on the right: name, stage with XP, mood in
words.

```
    .---.
   ( o o )   Tamago
    \ ^ /    young · 1 840 xp
     '-'     working
```

If the footer turns out to be pushed off-screen when the sidebar is taller
than the terminal, fall back to `sidebar_content` with a high order value, as
opencode-quota does.

### Home view (`home_logo`)

The same sprite, then a progress bar toward the next stage, then four counters
on one line: sessions, prompts, tools, files.

### Toasts

Exactly one kind: on evolution, variant `success`, `"Tamago evolved: young!"`.
No toasts on errors.

## Error handling

Every event handler and timer callback in the adapter is wrapped so an
exception is swallowed and appended to
`~/.local/share/opencode-tamago/error.log`. Unknown or malformed SDK events
are ignored, not translated. A failed flush is retried; a failed read yields a
fresh egg as described above.

## Testing

`core/` only, with `node:test`, and `tsc --noEmit` as the gate. Same rules as
`open-review`: `import type` for type-only imports, explicit `.ts` extensions,
erasable syntax only, no runtime dependencies.

- `reduce.test.ts`: replay event sequences and assert activity and deltas,
  including the 3 s hurt recovery and the 120 s sleep threshold via
  explicit `now` values.
- `merge.test.ts`: merging deltas is commutative and associative over
  counters; `hatchedAt` is preserved.
- `stage.test.ts`: XP from a known career, stage at each threshold, next
  stage and remaining XP.
- `sprites.test.ts`: every stage and activity pair has at least one frame;
  all frames within a stage share the same width and height.
- `lock.test.ts`: staleness decision from lock age and now, without touching
  the filesystem.

The adapter and views are verified by launching OpenCode. `doctor.sh` gains
one check for the plugin's `tsc --noEmit`, downgraded to a warning when its
`node_modules` is missing, exactly like the `open-review` check.

## Validation

Run the plugin's `tsc --noEmit` and `node --test`, then `./scripts/doctor.sh
--quick`, then launch two OpenCode instances side by side and confirm that
tool activity in one is reflected in the other's XP within a few seconds and
that no counter is lost.
