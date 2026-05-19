# tmux Window Title — Claude Activity Skill — Design Spec

**Goal:** Let Claude update the tmux window title to reflect its current activity (🧠 thinking, ✍️ writing, 🧪 running, ⏳ idle, ❓ asking, 🚫 blocked, ✅ done) so a user managing multiple Claude sessions can tell at a glance which pane needs attention.

**Context:** Layers on top of `scripts/tmux-window-status` (the helper landed in the prior palette work). That helper currently manages a single emoji **prefix** set by the human via the `tmux-palette` "Set Window Status…" flow. This spec adds a second, independent **suffix** layer driven by Claude. Rendered name becomes `[<prefix>] <base> [<suffix>]` — orthogonal layers, neither stomps the other.

**Mechanism:** Hybrid. Claude Code **hooks** drive the mechanical lifecycle transitions (no Claude cognition required, no context tokens). A small **skill** drives the three intent-bearing states only Claude can recognize from context (❓ 🚫 ✅).

---

## Architecture

### Two-layer window naming

The helper grows a suffix layer. Both layers are stored as window-local tmux options:

| Option | Set by | Purpose |
| --- | --- | --- |
| `@base-name` | helper (lazy) | original window name, captured on first decoration |
| `@status-prefix` | human via palette | prefix emoji (existing palette UX) |
| `@status-suffix` | Claude via hook/skill | suffix emoji (new — this spec) |
| `@suffix-owner` | helper (lazy) | `$TMUX_PANE` of the Claude session that owns the suffix layer for this window (new — see "Multi-Claude in one window" below) |

Render on every state change:

```
[<status-prefix> ]<base-name>[ <status-suffix>]
```

When both layers are unset, the rendered name is just `<base-name>`.

### Helper API (extended)

`scripts/tmux-window-status` gains four commands. Existing commands keep working unchanged so the palette JSON does not need to be touched.

| Command | Effect |
| --- | --- |
| `set <emoji>` *(existing)* | Alias of `set-prefix` |
| `clear` *(existing, broadened)* | Clears both layers, restores `@base-name` |
| `set-prefix <emoji>` *(new)* | Sets `@status-prefix`, rerenders |
| `clear-prefix` *(new)* | Unsets `@status-prefix`, rerenders |
| `set-suffix <emoji>` *(new)* | Sets `@status-suffix`, rerenders |
| `clear-suffix` *(new)* | Unsets `@status-suffix`, rerenders |

Implementation notes:

- A single internal `render` function reads the three options and rebuilds the window name. Every command mutates one option then calls `render`.
- `@base-name` capture stays lazy: set on the first decoration call if not already present.
- All commands no-op silently when `$TMUX` is unset or `tmux` is missing from `PATH`. The guard lives inside the helper so callers (hooks, skill, palette) need no special handling.
- `set-suffix` / `clear-suffix` additionally respect the suffix ownership lock (see next section). The prefix commands are unaffected — only one human drives the prefix.

### Multi-Claude in one window — suffix ownership lock

Two Claude sessions split across panes in the same tmux window would otherwise clobber each other's suffix on every hook fire. The helper enforces a per-window ownership lock so only the first Claude to write the suffix in a given window controls it.

- `set-suffix <emoji>`:
  - Read `@suffix-owner` and the current pane id (`$TMUX_PANE`).
  - If `@suffix-owner` is set and **does not** match the current pane: **no-op** (silently — another Claude owns the suffix here).
  - If `@suffix-owner` is unset, or points to a pane not present in `tmux list-panes -F '#{pane_id}'` (stale owner — Claude died, terminal closed, etc.): claim ownership by setting `@suffix-owner` to `$TMUX_PANE`, then proceed.
  - Set `@status-suffix` and rerender.
- `clear-suffix`: unsets both `@status-suffix` **and** `@suffix-owner` — the owner explicitly relinquishes. Next `set-suffix` from any pane can then claim.
- `clear` (the broadened version): unsets all four options (`@status-prefix`, `@status-suffix`, `@suffix-owner`, `@base-name`).
- The prefix layer is unaffected by this lock — `set-prefix` and `clear-prefix` ignore `@suffix-owner` entirely.

Result: in a one-Claude window, behavior is identical to the single-writer case. In a two-Claude window, whichever session writes first owns the title; the other is invisible in the title but still functional. When the owner ends (its `SessionEnd` hook fires `clear-suffix`), the lock releases and the other session can claim on its next write.

### Hooks (mechanical states)

Hooks fire automatically at Claude Code lifecycle moments. They cover the transitions Claude does not need to think about.

| Event | Matcher | Command | Sets suffix to |
| --- | --- | --- | --- |
| `SessionStart` | — | `~/scripts/tmux-window-status clear-suffix` | *(cleared)* |
| `UserPromptSubmit` | — | `~/scripts/tmux-window-status set-suffix 🧠` | 🧠 |
| `PreToolUse` | `Edit\|Write\|MultiEdit` | `~/scripts/tmux-window-status set-suffix ✍️` | ✍️ |
| `PreToolUse` | `Bash` | `~/scripts/tmux-window-status set-suffix 🧪` | 🧪 |
| `Stop` | — | `~/scripts/tmux-window-status set-suffix ⏳` | ⏳ |
| `SessionEnd` | — | `~/scripts/tmux-window-status clear-suffix` | *(cleared)* |

Hooks fire at the top-level Claude Code process. Subagent tool calls are not expected to re-trigger these hooks in the parent's name (to be verified during implementation).

### Skill (intent-bearing states)

`.claude/skills/tmux-window-status/SKILL.md` documents three manual overrides Claude makes when context requires more nuance than the hooks can supply:

| Override | Trigger |
| --- | --- |
| `set-suffix ❓` | Right before asking the user a clarifying question |
| `set-suffix 🚫` | When surfacing a blocker (cannot proceed) |
| `set-suffix ✅` | After completing a task and reporting back |

Each manual call overrides whatever the hooks last set on the suffix layer. The skill enforces a **subagent guard**: if dispatched as a subagent, skip the skill entirely (avoids title flapping driven by subagent tool calls).

---

## File layout

```
dotfiles/
├── scripts/
│   ├── tmux-window-status              # extended in place
│   └── tests/
│       └── test-tmux-window-status.sh  # extended with layered coverage
├── .claude/
│   └── skills/
│       └── tmux-window-status/
│           ├── SKILL.md                # new — the three manual overrides
│           └── hooks.json              # new — the hook fragment to merge
└── docs/superpowers/specs/
    └── 2026-05-19-tmux-window-status-skill-design.md  # this file
```

### Storage decisions

- **Skill body.** `dotfiles/.claude/skills/tmux-window-status/` — versioned in the dotfiles repo. Install step copies or symlinks the directory to `~/.claude/skills/tmux-window-status/`. (`~/.claude/skills/<name>/` is a fresh leaf, so a targeted symlink is conflict-free.)
- **Hook config.** Lives in `~/.claude/settings.json` (currently outside dotfiles, no hooks defined yet). The skill bundle ships `hooks.json` as the source of truth for the fragment; the implementation plan uses the `update-config` skill (or a manual merge) to add the entries.

---

## Vocabulary

| Emoji | State | Driver |
| --- | --- | --- |
| 🧠 | Thinking / exploring | hook (`UserPromptSubmit`) |
| ✍️ | Writing — actively editing files | hook (`PreToolUse:Edit\|Write\|MultiEdit`) |
| 🧪 | Running — executing commands, tests, builds | hook (`PreToolUse:Bash`) |
| ⏳ | Idle — Claude stopped working | hook (`Stop`) |
| ❓ | Asking a clarifying question | skill |
| 🚫 | Blocked | skill |
| ✅ | Done — task complete | skill |
| *(cleared)* | — | hook (`SessionStart`, `SessionEnd`) |

User may refine the vocabulary later — keeping the set small for v1.

---

## Testing

Extend `scripts/tests/test-tmux-window-status.sh`:

- `set-prefix` / `clear-prefix` assertions (parity with the existing `set` / `clear`).
- `set-suffix` / `clear-suffix` assertions.
- Layered render: prefix + suffix together, prefix-only, suffix-only, neither.
- `clear` clears all options (both layers + owner).
- Back-compat: `set <emoji>` still behaves like `set-prefix`.
- **Ownership lock** (suffix layer):
  - First `set-suffix` with `TMUX_PANE=%1` claims ownership.
  - Subsequent `set-suffix` with `TMUX_PANE=%2` no-ops (suffix unchanged).
  - `clear-suffix` from `%1` releases ownership.
  - After release, `set-suffix` from `%2` claims and updates.
  - Stale owner: `@suffix-owner=%99` but `%99` not in mocked `list-panes` output → next `set-suffix` from `%1` treats lock as unset and claims.

The mocked `tmux` gains state files for `@status-prefix`, `@status-suffix`, `@suffix-owner` alongside the existing `@base-name`, plus a `list-panes` mock that returns a configurable list of live pane ids.

---

## Edge cases

- **Not in tmux.** Helper no-ops; hooks run the helper which no-ops; skill calls run the helper which no-ops.
- **Helper missing on `PATH`.** Hook commands tolerate exit-code failure (`|| true` in the hook wrapper, or post-install verification step).
- **Subagent invocations.** Skill guards explicitly. Hooks rely on Claude Code's natural scoping (subagent tool calls don't fire parent hooks); confirmed during implementation.
- **Stale state from before the upgrade.** Any window with an existing prefix decoration still has `@base-name` set; the first new call rerenders cleanly using both layers.
- **Race between hook and skill on the suffix (same pane).** Both go through the same `render`. Last writer wins on the suffix layer; layers remain independent.
- **Two Claudes in one window.** Suffix ownership lock (see Architecture) silences the non-owner. Each Claude in a separate window is unaffected (different `@suffix-owner` per window).
- **Dead-pane lock.** If a Claude session is killed before its `SessionEnd` hook runs (terminal closed, OS reboot), `@suffix-owner` may point to a no-longer-existing pane. The helper detects this on every `set-suffix` via `tmux list-panes` and treats a stale owner as unset.

---

## Out of scope

- 👀 "PR in review" stays human-driven only — Claude does not set it.
- No runtime toggle to disable individual hook events; user removes them from `settings.json` if they want.
- No history of past statuses, no telemetry.
- No stacking multiple suffix states ("running AND blocked"). Last write wins.
- No per-pane visibility in the title when multiple Claudes run in one window — only the owner is shown. Pane-title or stacked-suffix variants are deferred upgrades, not v1.

---

## Open questions for the implementation plan

- **Exact hook event names.** Verify `UserPromptSubmit`, `PreToolUse`, `Stop`, `SessionStart`, `SessionEnd` against the current Claude Code docs. Adjust if any are renamed or absent.
- **`PreToolUse:Bash` over-firing.** Every `Bash` call is not "running tests" — could be `ls`, `git status`, etc. Acceptable noise level for v1; if it becomes distracting, narrow the matcher to commands matching `test|pytest|jest|npm test|cargo test|build`.
- **Skill install mechanism.** Symlink the directory into `~/.claude/skills/`, stow it, or document a copy step. Decided in the plan.
