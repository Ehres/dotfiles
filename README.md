# dotfiles

> Personal macOS dev environment: TokyoNight + AI tools + Vim navigation

## Tools

| Tool           | Purpose                        | Config                             |
| -------------- | ------------------------------ | ---------------------------------- |
| **Ghostty**    | Terminal emulator              | `.config/ghostty/config`           |
| **Tmux**       | Terminal multiplexer           | `.tmux.conf`                       |
| **Zsh**        | Shell + Zinit + Powerlevel10k  | `.zshrc`                           |
| **Neovim**     | Editor (LazyVim)               | [→](.config/nvim/README.md)        |
| **SketchyBar** | Status bar, 3-layer tokens     | [→](.config/sketchybar/README.md)  |
| **Yabai**      | BSP tiling WM (+ skhd, borders)| `.yabairc`, `.skhdrc`              |
| **Yazi**       | File manager                   | `.config/yazi/theme.toml`          |
| **Lazygit**    | Git TUI                        | `.config/lazygit/config.yml`       |
| **Mise**       | Runtime manager                | `.config/mise/config.toml`         |
| **OpenCode**   | AI coding agent, MCP + plugins | `.config/opencode/opencode.jsonc` |
| **Claude Code**| AI coding agent                | `AGENTS.md` (via `CLAUDE.md`)      |
| **Agent rules and skills** | Shared by both agents | [→](.agents/)                   |

## Fresh Setup

```bash
# Quick setup
git clone <repo> ~/projects/dotfiles
cd ~/projects/dotfiles
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew bundle install           # Everything in the Brewfile
stow .                        # Create symlinks

# Install plugins
exec zsh                      # Zsh + Zinit plugins auto-install
tmux                          # Then: C-b + I
nvim                          # Plugins auto-install
```

<details>
<summary>Detailed Installation Steps</summary>

### 1. Clone

```bash
git clone <repo> ~/projects/dotfiles
cd ~/projects/dotfiles
```

### 2. Install Dependencies

```bash
# Homebrew itself, if absent
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew bundle install    # Taps, formulae and casks from the Brewfile
```

Zinit and TPM bootstrap themselves on first `zsh` / `tmux` launch (step 4), and
mise installs its tools from `.config/mise/config.toml` when the shell activates
it. There is nothing else to run.

### 3. Symlink

```bash
stow .
```

`.stow-local-ignore` keeps dependency trees and repo documentation out of `$HOME`.
Dry-run first with `stow -n -v .` if you want to see the plan.

### 4. Plugins

```bash
exec zsh                    # Zsh plugins
tmux; C-b + I               # Tmux plugins
nvim                        # Neovim plugins
```

### 5. Validate

```bash
./scripts/doctor.sh
```

</details>

## Aliases

```bash
oc          # OpenCode
lg          # LazyGit
bubu        # Brew update & upgrade & cleanup
kci/kcs/kcp # Kubernetes contexts
```

## Maintenance

```bash
# Health check
./scripts/doctor.sh

# Update everything
brew upgrade && brew cleanup
zinit self-update && zinit update --all
mise upgrade
# Tmux: C-b + U
# Nvim: :Lazy sync

# Backup
git add . && git commit -m "Update" && git push
```

## Scripts

**`./scripts/doctor.sh`** - Health check; run it after changing config (`--quick` to skip the slow checks)  
**`./scripts/tmux-sessions`** - Ensure the long-lived tmux sessions exist (idempotent)  
**`./scripts/tmux-popup`** - Back the `display-popup` bindings, passing Escape through  
**`./scripts/tmux-dash-toggle`** - Toggle in and out of the `gh dash` session  
**`./scripts/yabai-focus-app`** - focuses the most recently used visible window of a named app, or launches it.<br>
**`./scripts/wifi-rssi.swift`** - Wi-Fi RSSI helper, compiled on demand by SketchyBar  
**`./scripts/claude-bash-guard.sh`** - `PreToolUse` hook blocking irreversible shell commands  
**`./scripts/regenerate-tailles.mjs`** - Regenerate Notion pruning reminders

## Notes

### Window management modes

| Entry | Mode | Keys |
| --- | --- | --- |
| `ctrl+shift+r` | Resize | `hjkl` grow, `shift+hjkl` shrink, `Escape` exits |
| `ctrl+shift+s` | Arrange | `hjkl` swap, `shift+hjkl` warp |
| `ctrl+shift+m` | Move | `1…0` to spaces, `hjkl` to displays; `Shift` also follows |
| `ctrl+shift+a` | App | app mnemonic focuses its MRU window or launches it |
| `ctrl+shift+o` | Layout | `f` fullscreen, `t` float, `1`/`2` ratios, `b` balance |

Temporary modes exit after one action. Resize is the only persistent mode and is visibly marked `RESIZE` in SketchyBar.

- **Theme**: TokyoNight everywhere, except SketchyBar (Catppuccin Macchiato).
  Shared accent `#7aa2f7`
- **Fonts**: FiraCode Nerd Font; Hack Nerd Font for SketchyBar icons
- **Node**: 24.13.0 via mise (`.config/mise/config.toml` is the source of truth)

---

**Conventions for agents and humans**: [AGENTS.md](AGENTS.md) — commit format,
shell and Lua style, the SketchyBar token architecture, and the stow invariant.
