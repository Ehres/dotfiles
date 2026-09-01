# AGENTS.md — Dotfiles Repository

Personal macOS dotfiles managed with GNU Stow. Configuration-only repo (no
application code, no test suite, no build system).

## Repository Layout

```
.agents/                 # Shared by BOTH agents; stow links it to ~/.agents
  rules/                 # context7.md, git-commit.md (~/.claude/rules → here)
  skills/                # Skill library (~/.claude/skills → ~/.agents/skills)
  .skill-lock.json       # Manifest making the library reinstallable
.config/
  ghostty/config         # Terminal emulator
  lazygit/config.yml     # Git TUI
  mise/config.toml       # Runtime version manager
  nvim/                  # Neovim (LazyVim framework)
    lua/config/          # options, keymaps, autocmds
    lua/plugins/         # Plugin specs (one per file)
    stylua.toml          # Lua formatter settings
  opencode/              # OpenCode AI IDE config
    plugin/              # TypeScript plugins
  raycast/               # Launcher scripts
  sketchybar/            # macOS status bar
    colors/              # 3-layer color tokens (palette → semantic → components)
    spacing/             # 3-layer spacing tokens (scale → semantic → components)
    items/               # Bar item definitions (bash)
    plugins/             # Event-driven scripts (bash)
  yazi/                  # File manager theme
scripts/                 # Versioned helpers; stow links to ~/scripts
.skhdrc                  # Hotkey daemon
.tmux.conf               # Terminal multiplexer
.yabairc                 # Window manager
.zshrc                   # Shell config (Zinit + Powerlevel10k)
.stow-local-ignore       # Keeps node_modules and repo docs out of $HOME
AGENTS.md                # This file. CLAUDE.md is a symlink to it, so both
CLAUDE.md                #   agents read the same conventions
Brewfile                 # Homebrew package manifest
```

Agent instructions follow one rule: **the global surface carries tool protocols
only** (how to fetch docs, when to ask before committing); **project surfaces
carry domain rules**. Domain rules for another repository belong in that
repository, not in `~/.config/opencode/AGENTS.md`, or they get injected into
every unrelated session.

## Commands

### Deployment

```bash
stow .                              # Symlink dotfiles to $HOME
brew bundle install                 # Install all Homebrew dependencies
```

### Validation

```bash
./scripts/doctor.sh                 # Run this after changing any config
./scripts/doctor.sh --quick         # Skips brew, stylua/shellcheck and nvim
```

`doctor.sh` is the check to run before claiming a config change works. Every
check in it corresponds to something that was found broken *silently*: `stow`
aborting on conflicts, binaries a config depends on being absent, versioned
Cellar paths, the tmux session-name mismatch, and README links pointing at
files that do not exist. It exits non-zero on failures; warnings do not fail.

Individual checks, if you want one in isolation:

```bash
stow -n -v .                        # Symlink drift, and conflicts before `stow .`
brew bundle check --verbose         # Declared in Brewfile vs actually installed
stylua --check .config/nvim/        # Lua formatting
shellcheck .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh
nvim --headless "+checkhealth" +qa  # Neovim plugin health
```

### Reloading Services

```bash
sketchybar --reload                 # Reload status bar
brew services restart sketchybar    # Restart sketchybar service
brew services restart borders       # Restart JankyBorders
yabai --restart-service             # Restart window manager
skhd --restart-service              # Restart hotkey daemon
tmux source-file ~/.tmux.conf       # Reload tmux (or prefix + r)
```

### Neovim

```bash
nvim                                # Plugins auto-install on first launch
# Inside nvim: :Lazy sync           # Update all plugins
# Inside nvim: :checkhealth         # Diagnose issues
```

### Formatting (Lua only)

```bash
stylua .config/nvim/                # Format Neovim Lua files
```

There are no test suites, CI pipelines, or build steps in this repo.

## Git Conventions

Commit messages use **Angular format**: `type(scope): description`

- **Types**: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`
- **Scopes**: tool name — `sketchybar`, `nvim`, `tmux`, `terminal`, `brewfile`,
  `raycast`, `git`, `opencode`, etc.
- Messages are lowercase, imperative, no trailing period
- Examples from history:
  - `feat(brewfile): create file`
  - `refactor(sketchybar): remove white separators`
  - `chore(nvim): update deps`

## Code Style

### Shell Scripts (Bash — SketchyBar, items, plugins)

- Shebang:
  - `#!/bin/bash` for any script using bash features: `[[`, `=~`,
    `BASH_REMATCH`, arrays, `mapfile`, `source`
  - `#!/bin/sh` only for strictly POSIX scripts — must then use `.` instead of
    `source`, and `[` instead of `[[`
  - Mixing `#!/bin/sh` with bash-only syntax is a shellcheck error
- Variables: `UPPER_SNAKE_CASE` for exported/config values, `lower_snake` for
  locals in complex scripts
- Quote **all** `$VAR` references in sketchybar calls — this includes spacing
  and color tokens, not just `$NAME`/`$PLUGIN_DIR`:
  `icon.padding_left="$SPACE_ICON_PADDING"`, `icon.color="$ICON_OK"`
- `shellcheck source` directives: when a script uses variables or arrays
  defined in a file sourced upstream (e.g. by `sketchybarrc`), add a directive
  immediately after the shebang so shellcheck can resolve them:
  - Items using `bracket_bg`/`item_bg`: `# shellcheck source=../properties.sh`
  - Plugins sourcing tokens directly: `# shellcheck source=../colors/components.sh`
- Array element quoting: quote each element that contains a `$VAR` expansion:
  ```bash
  item_bg=(
    "background.color=$ITEM_BG"
    "background.corner_radius=$ITEM_CORNER_RADIUS"
  )
  ```
- Splitting command output into arrays: never use `arr=($(cmd))` — use
  `mapfile` to avoid word-splitting and globbing (requires `#!/bin/bash`):
  ```bash
  mapfile -t INDICES < <(echo "$JSON" | jq -r '.[].index')
  ```
- Sourcing design-token files in plugins: use `.`/`source` matching the
  shebang, and add the corresponding `# shellcheck source=` directive:
  ```bash
  #!/bin/sh
  # shellcheck source=../colors/components.sh
  . "$CONFIG_DIR/colors/components.sh"
  ```
- Use design tokens — never hardcode colors or spacing values:
  - Colors: source from `colors/components.sh` (which chains
    `semantic.sh` → `palette.sh`). Use component tokens like `$ICON_OK`,
    `$ICON_ERROR`, `$BAR_BG`, not palette primitives like `$GREEN` directly
  - Spacing: source from `spacing/components.sh` (which chains
    `semantic.sh` → `scale.sh`). Use component tokens like
    `$SYSTEM_ITEM_PADDING`, not scale primitives like `$SPACE_SM` directly
- Color format: `0xAARRGGBB` (SketchyBar native)
- Palette: Catppuccin Macchiato for SketchyBar
- Items use tab indentation for `sketchybar --set` continuation lines
- Group related items in a single chained `sketchybar` call with `\` separators
- End each group with a bracket + spacer item pattern
- Plugins should exit early (`exit 0`) on missing/empty data

### Lua (Neovim — LazyVim)

- Formatter: StyLua — 2-space indent, 120-char column width
- Plugin specs: one file per plugin in `lua/plugins/`, each returning a table
- Follow LazyVim conventions for plugin spec structure
- Use `vim.keymap.set()` for keymaps, always include `desc` field
- Prefer `local function` for helper functions within config files

### TypeScript (OpenCode plugins)

- Used only for `.config/opencode/plugin/*.ts` files
- Import from `@opencode-ai/plugin`
- Package manager: pnpm (lockfile at `.config/opencode/`)

### TypeScript (skill scripts, run by Node directly)

- `.agents/skills/open-review/src/*.ts` runs under Node's native type stripping:
  no build step, and **no runtime dependencies**. Keep it that way — the only
  things in `node_modules` are `typescript` and `@types/node`, and they are
  devDependencies used by the typechecker, never imported by the code.
- Stripping **erases** types, it does not check them, so the syntax it cannot
  erase is **forbidden**: no `enum`, no `namespace`, no constructor parameter
  properties. `tsconfig.json` sets `erasableSyntaxOnly` so the editor rejects
  those while you write.
- Two things are **required**, not forbidden — do not "clean them up":
  `import type` for every type-only import, and an explicit `.ts` extension on
  every relative import. `verbatimModuleSyntax` and `allowImportingTsExtensions`
  enforce them, and Node needs the extension to resolve the file at all.
- Because nothing checks types at runtime, `tsc --noEmit` is the gate:
  `(cd .agents/skills/open-review && ./node_modules/.bin/tsc --noEmit)`.
  It exists because two real defects — a crash in `--since-last` and a union
  narrowing lost inside a callback — were found by it while the whole suite
  passed. `doctor.sh` runs it, and degrades to a warning when `node_modules` is
  missing so a fresh clone still works.
- Tests are `node:test`. A directory path argument does not work — run
  `node --test` from the skill directory, or pass a quoted glob.
- Decisions are pure functions over a facts record; only one module per external
  tool is allowed to spawn it. That is what makes the tests worth having.

### TOML (mise, stylua, yazi)

- Follow each tool's native config format

### Tmux

- TokyoNight theme with `#7aa2f7` (blue) active accent, `#3b4261` inactive
- Vim-aware pane navigation via `C-hjkl`
- Prefix: `C-b` (tmux default — not remapped)

## Design System (SketchyBar)

The status bar uses a strict 3-layer token architecture for both colors and
spacing. Never skip layers:

```
Layer 1 (Primitives) → Layer 2 (Semantic) → Layer 3 (Components)
```

- **Colors**: `palette.sh` → `semantic.sh` → `components.sh`
- **Spacing**: `scale.sh` → `semantic.sh` → `components.sh`

Items and plugins should only reference **Layer 3 (component tokens)**.
Semantic tokens are for building new component tokens. Palette/scale primitives
are the raw values and should not appear in item or plugin scripts.

## Key Architecture Decisions

- **Stow-based**: entire repo mirrors `$HOME` structure; `stow .` creates
  symlinks. New config files must be placed where they'd live under `$HOME`
- **Theme consistency**: TokyoNight for Neovim/Ghostty/Tmux/OpenCode;
  Catppuccin Macchiato for SketchyBar. Active accent: `#7aa2f7`
- **Vim navigation everywhere**: `hjkl` bindings in skhd, tmux,
  and Neovim with seamless cross-boundary pane switching

## Agent Guidelines

- **Use skills when relevant** — load specialized skills before substantial work
- After validated implementation work, proactively propose a logical commit with
  an Angular-format message. Do not commit without explicit user approval.
- When a change is ready to share, proactively offer to prepare a pull request:
  confirm the branch is ready, draft a concise title and description, and
  summarize validation. Create the pull request only on explicit request.
- For an open pull request, proactively monitor CI and review feedback, report
  blockers promptly, and propose or implement approved follow-up changes.
- Before creating a worktree, check whether OpenCode is already running from a
  linked Git worktree. Reuse it when it is; do not create another worktree.
- **Use @explore subagent** to search the codebase when unsure where to find
  relevant information
- **Use context7** for up-to-date tool documentation
- **Always ask questions** with the `questions` tool when requirements are
  ambiguous
- After modifying SketchyBar configs, remind the user to reload:
  `sketchybar --reload`
- After modifying Neovim plugins, note that changes take effect on next
  `nvim` launch (or `:Lazy sync` for dependency updates)
- When adding new Homebrew dependencies, add them to `Brewfile` with a comment
