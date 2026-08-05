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
| **OpenCode**   | AI coding agent, MCP + plugins | `.config/opencode/opencode.json`   |
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

# Configure secrets. The service is literally "Keychain Access" and the account
# is the key name -- that is what fnox.toml looks up. Swapping the two silently
# produces entries fnox cannot read.
security add-generic-password -s "Keychain Access" -a GITLAB_PERSONAL_ACCESS_TOKEN -w
security add-generic-password -s "Keychain Access" -a CONTEXT7_API_KEY -w
fnox --config .config/opencode/fnox.toml list   # Verify both resolve

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

Zinit and TPM bootstrap themselves on first `zsh` / `tmux` launch (step 5), and
mise installs its tools from `.config/mise/config.toml` when the shell activates
it. There is nothing else to run.

### 3. Symlink

```bash
stow .
```

`.stow-local-ignore` keeps dependency trees and repo documentation out of `$HOME`.
Dry-run first with `stow -n -v .` if you want to see the plan.

### 4. Secrets

Secrets live in the macOS Keychain and are injected by `fnox` through the `oc`
alias. The service is the literal string `Keychain Access` and the account is the
key name; supplying them the other way round creates entries `fnox` cannot read.

```bash
security add-generic-password -s "Keychain Access" -a GITLAB_PERSONAL_ACCESS_TOKEN -w
security add-generic-password -s "Keychain Access" -a CONTEXT7_API_KEY -w

# Both keys should print a value, not a "not found" error
fnox --config .config/opencode/fnox.toml get CONTEXT7_API_KEY
```

### 5. Plugins

```bash
exec zsh                    # Zsh plugins
tmux; C-b + I               # Tmux plugins
nvim                        # Neovim plugins
```

### 6. Validate

```bash
./scripts/doctor.sh
```

</details>

## Aliases

```bash
oc          # OpenCode with fnox secrets
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
**`./scripts/wifi-rssi.swift`** - Wi-Fi RSSI helper, compiled on demand by SketchyBar  
**`./scripts/claude-bash-guard.sh`** - `PreToolUse` hook blocking irreversible shell commands  
**`./scripts/regenerate-tailles.mjs`** - Regenerate Notion pruning reminders

## Notes

- **Prefix**: Tmux = `C-b`, Skhd = `ctrl+shift` / `ctrl+cmd` / `shift+alt`
- **Theme**: TokyoNight everywhere, except SketchyBar (Catppuccin Macchiato).
  Shared accent `#7aa2f7`
- **Fonts**: FiraCode Nerd Font; Hack Nerd Font for SketchyBar icons
- **Node**: 24.13.0 via mise (`.config/mise/config.toml` is the source of truth)
- **Secrets**: macOS Keychain, read through `fnox`; never committed

---

**Conventions for agents and humans**: [AGENTS.md](AGENTS.md) — commit format,
shell and Lua style, the SketchyBar token architecture, and the stow invariant.
