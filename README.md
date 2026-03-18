# dotfiles

> Personal macOS dev environment: TokyoNight + AI tools + Vim navigation

## Tools

| Tool | Purpose | Docs |
|------|---------|------|
| **OpenCode** | AI-powered IDE with MCP | [→](.config/opencode/README.md) |
| **Neovim** | Editor (LazyVim) | [→](.config/nvim/README.md) |
| **Ghostty** | Terminal emulator | [→](.config/ghostty/README.md) |
| **Tmux** | Terminal multiplexer | `.tmux.conf` |
| **Zsh** | Shell + Powerlevel10k | `.zshrc` |
| **Yazi** | File manager | [→](.config/yazi/README.md) |
| **Mise** | Runtime manager | [→](.config/mise/README.md) |

## Fresh Setup

```bash
# Quick setup
git clone <repo> ~/projects/dotfiles
cd ~/projects/dotfiles
./scripts/install-deps.sh    # Install everything
stow .                        # Create symlinks
./scripts/doctor.sh           # Validate setup

# Configure secrets
security add-generic-password -a "$USER" -s "GITLAB_PERSONAL_ACCESS_TOKEN" -w "token"
security add-generic-password -a "$USER" -s "CONTEXT7_API_KEY" -w "key"

# Install plugins
exec zsh                      # Zsh plugins auto-install
tmux                          # Then: Ctrl+Space + I
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
./scripts/install-deps.sh
```
Installs: Homebrew, packages (via Brewfile), Zinit, TPM, mise tools

### 3. Symlink
```bash
stow .
```

### 4. Secrets
```bash
security add-generic-password -a "$USER" -s "GITLAB_PERSONAL_ACCESS_TOKEN" -w "token"
security add-generic-password -a "$USER" -s "CONTEXT7_API_KEY" -w "key"
vim .config/opencode/opencode.json  # Update GITLAB_PROJECT_ID
```

### 5. Plugins
```bash
exec zsh                    # Zsh plugins
tmux; Ctrl+Space + I        # Tmux plugins  
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
# Tmux: Ctrl+Space + U
# Nvim: :Lazy sync

# Backup
git add . && git commit -m "Update" && git push
```

## Scripts

**`./scripts/install-deps.sh`** - Install all dependencies  
**`./scripts/doctor.sh`** - Validate setup (tools, symlinks, versions, secrets)

## Notes

- **Prefix**: Tmux = `Ctrl+Space`, Skhd = `Alt`
- **Theme**: TokyoNight everywhere
- **Fonts**: FiraCode Nerd Font
- **Node**: v22 via mise

---

**Detailed configuration docs**: See individual config READMEs in [.config/](.config/)
