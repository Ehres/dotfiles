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

`name` is the only option: the label shown next to the sprite and in toasts
until you rename the creature from the palette. A rename is saved with the
career, so every window shows it.

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

Stopping a tool yourself never hurts: an `Esc` during a run, a refused
permission or a dismissed question is neither an error nor a counted tool.

The 3 s and 120 s above are those of a median sheet. Each creature has its
own: a sensitive one stays hurt longer, an energetic one stays awake longer
and animates faster. See "Who it is".

Colors come from the active OpenCode theme: accent by default, `error` when
hurt, `warning` when waiting, `textMuted` when asleep.

## How it talks

A three-line bubble appears above the sprite in the sidebar for about five
seconds when something notable happens in the session on screen. Phrases are
local templates: no model, no network, and nothing read from prompts,
messages, todo texts or diffs, only their counts.

| Cue          | When                                            |
| ------------ | ----------------------------------------------- |
| `permission` | OpenCode asks for a permission                  |
| `granted`    | you allow the permission it just asked about    |
| `denied`     | you refuse the permission it just asked about   |
| `woke`       | the creature wakes from sleep                   |
| `long_work`  | the session goes idle after 5 min of work       |
| `big_diff`   | the session diff reaches 10 files, once         |
| `streak`     | 3 tools fail within 30 s                        |
| `compacted`  | the session is compacted                        |
| `retried`    | OpenCode retries a step                         |
| `todos_done` | every todo of the session is completed          |
| `evolved`    | the creature reaches a new stage                |
| `hatched`    | the egg hatches: the species is revealed        |

At most one bubble every 10 s; a rarer cue (an evolution, a streak) may
interrupt a common one. `granted` and `denied` only answer a `permission` the
creature actually voiced, within 30 s and once per question. Which phrase is
spoken is drawn, never rotated. Tuning lives in `core/speech/voice.ts`.

The 5 s of a bubble, the 10 s between two, the 5 min of a long work and the
3 failures of a streak are those of a median sheet; a chatty creature speaks
sooner and longer, a sensitive one complains earlier.

Three registers share the phrases. Each species has a signature: its own
phrases for every cue, in `core/speech/signature.ts` and one file per rarity under
`core/speech/signatures/`. Each temperament has its flavor for every cue, in
`core/speech/voice.ts`, next to the neutral phrases. Which register speaks is drawn
at each cue, 70 % the species, 25 % a temperament, 5 % neutral; within the
temperament share, each of the four speaks at the weight of its stat, so a
sarcastic 9 with a dreamy 3 drifts off now and then. The draw is seeded from
the hatch date, the cue and its count: every window hears the same phrase for
the same occurrence of the cue, and the same creature does not repeat itself.
At the hatch the species always speaks.

## Commands

Six commands in the palette, always under `Tamago` so they stay easy to find
whatever the creature is called; its Name only appears in their descriptions:

| Command           | What it does                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `toggle bubbles`  | mutes and unmutes; the choice is remembered across launches                                       |
| `show card`       | opens a dialog with the sprite, species and rarity, stage, XP, age, character, stats and bar      |
| `pet`             | the sprite wears a `♥` and its temperament's eyes for 2 s                                         |
| `rename`          | asks for a new name, 16 characters at most; empty keeps the old                                   |
| `hatch a new egg` | lays a fresh egg once every creature on the machine is `elder`                                    |
| `roster`          | lists every creature of this machine with its card; Enter on a resting one brings it to the front |

Petting counts nothing and changes nothing in the career. The heart is the
only non-ASCII character in a sprite: it takes one column in most terminals,
two in a few, where the top line overflows by one column while it shows.

## What it is

Every egg hatches into a species, drawn once from the hatch date and stored
with the career. Twenty species, by rarity:

| Rarity      | Species                                       |
| ----------- | --------------------------------------------- |
| `common`    | cat, owl, frog, duck, hamster, snail          |
| `uncommon`  | fox, penguin, octopus, bat, hedgehog, axolotl |
| `rare`      | robot, ghost, jellyfish, chameleon            |
| `epic`      | phoenix, kraken, unicorn                      |
| `legendary` | dragon                                        |

The egg looks the same for every species; the creature shows at
`hatchling`, with a toast and a bubble. A species never changes: the only way
to meet another one is a new egg. Two eggs may hatch the same species: the
draw has no memory. Bodies live in `core/appearance/bodies/<rarity>.ts`, signatures in
`core/speech/signatures/<rarity>.ts`.

| Rarity      | First egg | After one common elder | Cap    | Pace |
| ----------- | --------- | ---------------------- | ------ | ---- |
| `common`    | 65 %      | 61 %                   | 20 %   | 1    |
| `uncommon`  | 25 %      | 26.5 %                 | 41.9 % | 0.8  |
| `rare`      | 10 %      | 11 %                   | 21.3 % | 0.5  |
| `epic`      | 0         | 1 %                    | 11.3 % | 0.4  |
| `legendary` | 0         | 0.5 %                  | 5.6 %  | 0.25 |

A first egg never hatches an epic or a legendary: they are earned. Every
creature of the machine raised to `elder` adds luck to the next egg, 1 for a
common, 2 an uncommon, 3 a rare, 4 an epic, 5 a legendary, and each point
moves 4 % out of common toward the rarer tiers until common rests at 20 %.
Luck is read from the roster at the hatch and never stored or shown; the
species drawn is stored, so later luck changes nothing for a living creature.
The curve lives in `core/creature/luck.ts`.

The pace scales how fast XP turns into growth: a legendary creature needs four
times the XP of a common one for every stage, and the card shows its farther
thresholds. Rarer is slower, never faster, so the common creature is never the
slow one. Careers saved before species existed are the `cat`. Tables live in
`core/creature/species.ts`.

## Several creatures

A machine can hold several creatures. One is active: it is drawn, it earns
XP, it talks. The others rest in `roster/`, whole, with their name, species
and picks. `hatch a new egg` lays a fresh egg and makes it active, but only
once every creature on the machine is `elder`: a new egg costs a whole career.
`roster` lists every creature of the machine, the active one first, with the
highlighted one's card underneath; Enter on a resting creature brings it back
to the front, and nothing is earned or lost. A window opened before another
creature came to the front keeps crediting the creature it shows until its
next flush, then follows the new active one. A window still running an older
build knows only `career.json`, so its gains go to whichever creature is
active when it flushes.

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

Thresholds are for a common species; a rarer one divides its pace out of
them. The stage is never stored. It is recomputed from the counters and the
species, so it cannot drift. A `success` toast fires in each open OpenCode
window when the stage changes. Weights and thresholds live in `core/career/stage.ts`
and are meant to be tuned after real use.

## Who it is

The hatch date draws a character sheet: eight stats from 0 to 10, computed
by every window from `hatchedAt` and never stored. Four carry the names of the
temperaments, cheerful, sarcastic, stoic and dreamy: the highest one is the
creature's temperament, fixed for life. It colors the bubbles for
permissions, replies, error streaks and evolutions, and the eyes when you pet
it. Four are behavior stats: energy sets when it falls asleep and how fast it
animates, chatter how often it speaks and how long a bubble stays,
sensitivity how long it stays hurt and how many failures make a streak,
patience from when a work is long. Each stat scales its durations between
half and double; 5 is exactly the plugin's old constants.

The species weighs on the sheet without deciding it: an owl adds stoic +2,
cheerful −1, energy −2, chatter −1, patience +2; a dragon sarcastic +3,
sensitivity −2, energy +2; a cat nothing, so every creature from before the
sheet keeps its temperament. Every other species has its own line, from a
frog's stoic +1 to a phoenix's cheerful +3 and a kraken's cold anger, sarcastic
+2, stoic +2, sensitivity +2. About one owl in six, and one dragon in four,
takes its species' temperament rather than its draw. The modifiers live in
`core/creature/species.ts`; tune a species before one has hatched, since changing its
line changes every living one. The card shows the four behavior stats as bars
from `hatchling` on.

From the `young` stage, the counters add a vocation: a craft, scribe, shell or
sage, whichever weighted score is highest, and a stance, prudent from five
questions asked per hundred prompts, bold below. Weights and the threshold
live in `core/creature/character.ts`. The card states the whole character:
`sarcastic · prudent shell`.

## Data

Everything lives in `~/.local/share/opencode-tamago/`:

- `career.json`: the cumulative counters (including the questions the
  assistant asked), the hatch date, the species, the name with the time it was
  chosen, and the Picks made at Milestones (empty for now). One active creature
  per machine, shared by every project.
- `roster/<hatchedAt>.json`: the resting creatures, one file each, same
  format as `career.json`. Never deleted by the plugin.
- `career.lock/`: a lock directory held for a few milliseconds during writes.
- `error.log`: exceptions swallowed by the plugin, with timestamps.

The sheet, the temperament and the behavior are derived from the hatch date
and the species: nothing new is written to disk.

Several OpenCode instances can run at once. Each keeps its gains in memory and
merges them into `career.json` every 2 s under the lock, so progress made in
one window shows up in the others within a couple of seconds and nothing is
lost. A lock older than 10 s is treated as orphaned and taken over. A window
still running an older build of the plugin keeps the top-level fields it does
not know exactly as it found them, so upgrading with a window open loses
nothing.

To start over, quit OpenCode and delete `career.json`: the next egg draws a
new species. If the file is not valid JSON, the plugin sets it aside as
`career.json.corrupt-<timestamp>`, says so in a single warning toast, and
starts a fresh egg. If the disk itself
fails, the plugin keeps your gains in memory, retries with a growing pause up
to a minute, logs the error once per distinct message, and after three
consecutive failures shows a single error toast pointing at `error.log`.

## Development

Types are installed locally in this directory only. Never run a package
manager in `.config/opencode` itself: it breaks the LSPs.

```sh
pnpm install --ignore-workspace   # types for the editor and tsc, nothing at runtime
node --test "core/**/__tests__/*.test.ts" "adapter/__tests__/*.test.ts"
./node_modules/.bin/tsc --noEmit
```

`scripts/doctor.sh` at the repository root runs both checks. The views and the
adapter are verified by launching OpenCode: open two instances side by side,
run some tools in one, and watch the other's XP follow.

Layout:

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

`AGENTS.md` holds the rules for changing the plugin, `CONTEXT.md` the
vocabulary, and `IDEAS.md` the backlog of things it could do next.
