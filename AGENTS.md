# AGENTS.md — Dotfiles Repository

Personal macOS dotfiles managed with GNU Stow. Configuration-only repo (no
application code, no test suite, no build system).

## Repository Layout

```
.aerospace.toml          # AeroSpace window manager
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
.skhdrc                  # Hotkey daemon
.tmux.conf               # Terminal multiplexer
.yabairc                 # Window manager
.zshrc                   # Shell config (Zinit + Powerlevel10k)
Brewfile                 # Homebrew package manifest
```

## Commands

### Deployment

```bash
stow .                              # Symlink dotfiles to $HOME
brew bundle install                 # Install all Homebrew dependencies
```

### Validation

```bash
./scripts/doctor.sh                 # Health check (tools, symlinks, versions, secrets)
./scripts/install-deps.sh           # Full dependency install from scratch
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

- Shebang: `#!/bin/bash` for items/config, `#!/bin/sh` or `#!/usr/bin/env sh`
  for simple plugins
- Variables: `UPPER_SNAKE_CASE` for exported/config values, `lower_snake` for
  locals in complex scripts
- Always quote variables in sketchybar `--set` calls: `"$NAME"`, `"$PLUGIN_DIR/..."`
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

### TOML (AeroSpace, mise, stylua, yazi)

- Follow each tool's native config format
- AeroSpace: use consistent `alt-` prefix for keybindings

### Tmux

- TokyoNight theme with `#7aa2f7` (blue) active accent, `#3b4261` inactive
- Vim-aware pane navigation via `C-hjkl`
- Prefix: `Ctrl+Space`

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
- **Secrets via fnox**: secrets stored in macOS Keychain, accessed through
  `fnox` — never committed. See `fnox.toml` files
- **Theme consistency**: TokyoNight for Neovim/Ghostty/Tmux/OpenCode;
  Catppuccin Macchiato for SketchyBar. Active accent: `#7aa2f7`
- **Vim navigation everywhere**: `hjkl` bindings in AeroSpace, skhd, tmux,
  and Neovim with seamless cross-boundary pane switching

## Agent Guidelines

- **Use skills when relevant** — load specialized skills before substantial work
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
