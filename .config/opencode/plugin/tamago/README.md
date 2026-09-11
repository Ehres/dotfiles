# opencode-tamago

A terminal tamagotchi that lives inside the OpenCode TUI. It mirrors what the
current session is doing in real time, and grows over weeks from the activity
accumulated across every session and project on the machine.

```
   .---.
  ( o o )   Tamago
   \ ^ /    young · 1,840 xp
    '-'     working
```

Zero upkeep: nothing to feed, nothing dies. The creature suffers in the moment
when something fails and recovers a few seconds later.

## Install

The plugin is a local `.tsx` file loaded by OpenCode without a build step.
It is referenced from `.config/opencode/tui.jsonc`:

```jsonc
{
  "plugin": [["./plugin/tamago/index.tsx", { "name": "Tamago" }]]
}
```

`name` is the only option. It is the label shown next to the sprite and in
toasts.

## How it reacts

The sprite appears in the sidebar footer of a session and under the prompt on
the home screen. Each OpenCode session has its own mood, and the sidebar shows
the mood of the session on screen. Subagent sessions never drive the mood: their
tools still earn XP, their prompts do not count. Activity follows the session:

| Activity   | Triggered by                                   | Ends                                  |
| ---------- | ---------------------------------------------- | ------------------------------------- |
| `thinking` | you send a prompt                              | a tool starts, or the session idles   |
| `working`  | a tool starts running                          | the session idles                     |
| `waiting`  | OpenCode asks for a permission                 | you reply                             |
| `hurt`     | a tool fails, or the session errors            | after 3 s, working if busy, else idle |
| `idle`     | the session goes idle                          | after 120 s, falls asleep             |
| `sleeping` | 120 s of idle                                  | any activity                          |

Colors come from the active OpenCode theme: accent by default, `error` when
hurt, `warning` when waiting, `textMuted` when asleep.

## How it grows

Every counted action adds experience. Errors add nothing and remove nothing.

```
xp = prompts × 2
   + tools.read × 1 + tools.edit × 3 + tools.bash × 2 + tools.other × 1
   + filesEdited × 5
   + sessions × 10
```

| Stage       | XP     |
| ----------- | ------ |
| `egg`       | 0      |
| `hatchling` | 200    |
| `young`     | 1 500  |
| `adult`     | 6 000  |
| `elder`     | 20 000 |

The stage is never stored. It is recomputed from the counters, so it cannot
drift. A `success` toast fires in each open OpenCode window when the stage
changes. Weights and thresholds live in `core/stage.ts` and are meant to be
tuned after real use.

## Data

Everything lives in `~/.local/share/opencode-tamago/`:

- `career.json`: the cumulative counters and the hatch date. One creature per
  machine, shared by every project.
- `career.lock/`: a lock directory held for a few milliseconds during writes.
- `error.log`: exceptions swallowed by the plugin, with timestamps.

Several OpenCode instances can run at once. Each keeps its gains in memory and
merges them into `career.json` every 2 s under the lock, so progress made in
one window shows up in the others within a couple of seconds and nothing is
lost. A lock older than 10 s is treated as orphaned and taken over.

To start over, quit OpenCode and delete `career.json`. If the file is not
valid JSON, the plugin sets it aside as `career.json.corrupt-<timestamp>`,
says so in a single warning toast, and starts a fresh egg. If the disk itself
fails, the plugin keeps your gains in memory, retries with a growing pause up
to a minute, logs the error once per distinct message, and after three
consecutive failures shows a single error toast pointing at `error.log`.

## Development

Types are installed locally in this directory only. Never run a package
manager in `.config/opencode` itself: it breaks the LSPs.

```sh
pnpm install --ignore-workspace   # types for the editor and tsc, nothing at runtime
node --test "core/*.test.ts" "adapter/*.test.ts"
./node_modules/.bin/tsc --noEmit
```

`scripts/doctor.sh` at the repository root runs both checks. The views and the
adapter are verified by launching OpenCode: open two instances side by side,
run some tools in one, and watch the other's XP follow.

Layout:

```
index.tsx      the only module that touches api.* and timers; wires the layers
core/          pure data and strings; knows nothing about OpenCode or Solid
adapter/       the only layer touching SDK event shapes and the disk
view/          Solid components fed with accessors, returning JSX
```

`AGENTS.md` holds the rules for changing the plugin, `CONTEXT.md` the
vocabulary, and `IDEAS.md` the backlog of things it could do next.
