# tmux window status via tmux-palette — design

**Date:** 2026-05-19
**Status:** Approved
**Author:** Maxime Grebauval

## Context

Daily tmux workflow involves many windows in `perso` and `boulot` sessions,
each tied to a piece of in-progress work (a feature branch, a PR, an
investigation). The window name (`#W`) shown in the powerkit status bar is
usually descriptive of *what is running* (e.g. `nvim`, `dev-server`) or the
branch/feature, but it carries no signal about the *workflow state* of that
work:

- Is it actively being worked on?
- Is it waiting on a stakeholder?
- Is the PR open and awaiting review?
- Is it blocked?

Today, this state lives only in the user's head, which makes scanning the
window list to decide "what should I pick back up?" slow and error-prone.

The `tmux-palette` plugin is already installed and bound to `C-Space`, with a
user-level `~/.config/tmux-palette/commands.json` and TokyoNight `theme.json`.
It supports custom palettes (separate JSON files under
`~/.config/tmux-palette/palettes/`) referenced from the main palette via
`{ "action": { "palette": "<name>" } }`.

The dotfiles repo uses GNU `stow` to symlink everything under `~` from the
repo root, but `~/.config/tmux-palette/` is currently a plain directory with
real files inside it — outside `stow`'s scope.

## Goals

1. Tag each tmux window with a workflow status visible directly in the status
   bar, via a short emoji prefix on the window name
2. Set / change / clear the status from the existing tmux-palette UI with no
   new tmux keybinding
3. Preserve the original (descriptive) window name so the status can be cleared
   without losing context
4. Allow switching freely between statuses (e.g. `In Progress` → `PR In Review`
   → `Done`) without prefix accretion
5. Bring the tmux-palette user config under `stow` management in the dotfiles
   repo, so future palette edits are versioned

## Non-goals

- Changing the status bar colour/style per status (powerkit owns the status
  bar; status is conveyed via the emoji prefix only)
- Persisting status across tmux server restarts (the window itself doesn't
  persist; status doesn't need to either)
- Multi-window or session-level status
- Freeform / typed status text (the value comes from a fixed, fast-to-pick
  set; freeform would defeat the visual-scan goal)

## Design

### Status set

Seven palette entries (six statuses + clear):

| Emoji | Title                 | Meaning                                   |
| ----- | --------------------- | ----------------------------------------- |
| ⏳    | Awaiting Stakeholder  | Waiting on a stakeholder response         |
| 👀    | PR In Review          | PR open, awaiting review                  |
| 🚧    | In Progress           | Active work happening here                |
| 🚫    | Blocked               | Blocked on something external             |
| 🧠    | Thinking              | Exploring / researching, not yet building |
| ✅    | Done                  | Work finished                             |
| 🧹    | Clear Status          | Restore the original window name          |

### Components

#### 1. Helper script — `scripts/tmux-window-status`

A small bash script in `scripts/` (already symlinked at `~/scripts/` via
stow), responsible for the rename mechanics. Two subcommands:

- `tmux-window-status set <emoji>`
  - If the window option `@base-name` is not set, store the current window
    name (`#W`) in it. This becomes the "original name".
  - Rename the window to `<emoji> <base-name>`.
  - Idempotent across status switches: the second call replaces the emoji
    only; `<base-name>` stays untouched.
- `tmux-window-status clear`
  - If `@base-name` is set, rename the window back to it and unset the
    option. If not set, no-op.

Why a script (vs inline `tmux` actions in JSON):

- Single source of truth for the "preserve original name" logic
- Lets us swap statuses without parsing/stripping emoji prefixes from the
  current name (which is fragile)
- Keeps the palette JSON declarative and short

#### 2. Custom palette — `.config/tmux-palette/palettes/window-status.json`

```jsonc
{
  "title": "Window Status",
  "items": [
    { "icon": "⏳", "title": "Awaiting Stakeholder",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status set ⏳'" } },
    { "icon": "👀", "title": "PR In Review",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status set 👀'" } },
    { "icon": "🚧", "title": "In Progress",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status set 🚧'" } },
    { "icon": "🚫", "title": "Blocked",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status set 🚫'" } },
    { "icon": "🧠", "title": "Thinking",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status set 🧠'" } },
    { "icon": "✅", "title": "Done",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status set ✅'" } },
    { "icon": "🧹", "title": "Clear Status",
      "action": { "tmux": "run-shell '~/scripts/tmux-window-status clear'" } }
  ]
}
```

#### 3. Entry point in main palette — `.config/tmux-palette/commands.json`

A single new item is appended to the existing `commands.json`:

```jsonc
{
  "icon": "🏷️",
  "title": "Set Window Status…",
  "category": "Window",
  "action": { "palette": "window-status" }
}
```

This opens the dedicated palette. No new tmux keybinding is added.

### Flow

```
C-Space  →  type "status"  →  Enter on "Set Window Status…"
         →  pick e.g. "PR In Review"  →  window in status bar becomes "👀 my-feature"
```

To clear: `C-Space` → "status" → Enter → "Clear Status".

### Stow integration

`~/.config/tmux-palette/` currently contains real files (`commands.json`,
`theme.json`). Bringing it under `stow`:

1. Create `.config/tmux-palette/` in the repo.
2. Move `~/.config/tmux-palette/commands.json` and `theme.json` into the
   repo location (preserving content; `commands.json` then gets the new
   `Set Window Status…` entry appended).
3. Create `.config/tmux-palette/palettes/window-status.json` in the repo.
4. Delete `~/.config/tmux-palette/` (originals are now in the repo).
5. Run `stow .` from the repo root.

After this, `~/.config/tmux-palette/commands.json`, `theme.json`, and
`palettes/window-status.json` are symlinks into the repo. Plugin runtime
files written by tmux-palette itself (if any — none today) would still land
inside the symlinked directory, but the user-managed config is now versioned.

### README update

Add a row to the Tools table in `README.md`:

```
| **tmux-palette** | Command palette for tmux | [→](.config/tmux-palette/) |
```

(Or similar — the link should resolve to the new repo path. A short
`.config/tmux-palette/README.md` describing the window-status palette can be
added if it helps, but is not required.)

## Edge cases

- **Switching statuses**: `@base-name` persists across status changes, so
  `⏳ foo` → `🚧 foo` → `✅ foo` flows naturally without prefix accretion.
- **Manual rename after status set**: if the user renames a window manually
  while a status is set, `@base-name` becomes stale; clearing restores the
  *original* name (pre-status), not the manually-renamed name. Trade-off
  accepted — uncommon, and easily fixed (clear + manually rename + re-set).
- **`automatic-rename`**: tmux automatically disables `automatic-rename` on
  any window that has been explicitly renamed. Setting a status will pin the
  name. This is the desired behaviour — a status only makes sense if the name
  stops drifting.
- **Empty `@base-name` on `clear`**: clearing when no status was set is a
  no-op; no error surfaced.
- **Window name with special characters**: bash quoting around the rename
  argument handles spaces and most punctuation. Emoji are passed as literal
  multibyte strings in the JSON `action` field — `tmux run-shell` and
  `rename-window` both accept them.

## Affected files

- `scripts/tmux-window-status` (new, executable)
- `.config/tmux-palette/commands.json` (moved from `~`, one entry appended)
- `.config/tmux-palette/theme.json` (moved from `~`, unchanged)
- `.config/tmux-palette/palettes/window-status.json` (new)
- `README.md` (Tools table row added)

## Out of scope (future)

- Per-status colour on the window name in the status bar (would require
  hooking into powerkit's `window-status-format` and risks fighting the
  current TokyoNight theming)
- Filtering / picking only windows with a given status (would require a
  second palette that enumerates windows and filters by emoji prefix)
- Cross-session status overview
