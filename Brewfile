# Dotfiles Brewfile
# Install all dependencies with: brew bundle install

# Taps
tap "FelixKratz/formulae"          # For SketchyBar and JankyBorders
tap "asmvik/formulae"              # Yabai + Skhd (taken over from koekeishiya in 2025)

# Core Tools
brew "stow"                        # Symlink manager for dotfiles
brew "git"                         # Version control
brew "zsh"                         # Shell
brew "bash"                        # Bash 5.x; macOS ships 3.2, tmux-powerkit needs >=5.2

# Development Environment
brew "neovim"                      # Modern Vim-based editor
brew "tmux"                        # Terminal multiplexer
brew "mise"                        # Runtime version manager (replaces nvm, rbenv, pyenv)
brew "pnpm"                        # Fast, disk space efficient package manager

# Terminal & File Management
brew "yazi"                        # Blazing fast terminal file manager
brew "fzf"                         # Fuzzy finder
brew "zoxide"                      # Smart directory jumping (better cd)
brew "lazygit"                     # Git terminal UI
brew "btop"                        # Interactive system monitor

# Enhanced CLI Tools
brew "ripgrep"                     # Better grep (rg command)
brew "fd"                          # Better find
brew "bat"                         # Better cat with syntax highlighting
brew "eza"                         # Better ls with colors and icons
brew "jq"                          # JSON processor
brew "coreutils"                   # GNU core utilities
brew "git-delta"                   # Syntax-highlighting pager; core.pager and lazygit both use it
brew "gum"                         # Interactive prompts for shell scripts
brew "sevenzip"                    # 7z archives
brew "webp"                        # WebP encode/decode

# Git & Review Tooling
brew "gh"                          # GitHub CLI; `gh dash` backs the tmux dash session
brew "tuicr"                       # Code-review TUI, bound to prefix+R in tmux (moved to core from agavra/tap)
brew "dlvhdr/formulae/diffnav"      # File-tree navigator wrapping delta
brew "kitlangton/tap/ghui"         # GitHub TUI
brew "jnsahaj/lumen/lumen"         # AI commit messages / diff summaries

# Linters & Formatters (the commands AGENTS.md documents)
brew "stylua"                      # Lua formatter for .config/nvim
brew "shellcheck"                  # Shell linter enforcing the AGENTS.md shell rules

# Agent Tooling
brew "rtk"                         # Token-reduction rewriter used by the opencode plugin

# Preview Dependencies (for yazi and other tools)
brew "ffmpegthumbnailer"           # Video thumbnails
brew "unar"                        # Archive preview and extraction
brew "poppler"                     # PDF preview and rendering

# Language Runtimes
brew "python@3.12"                 # Required by tmux-fzf-links (hardcoded in .tmux.conf)
brew "rust"                        # Toolchain for cargo-installed binaries on PATH

# Window Management & Desktop
brew "sketchybar"                  # Customizable macOS status bar
brew "borders"                     # Active window border highlight (JankyBorders)
brew "asmvik/formulae/yabai"       # BSP tiling window manager
brew "asmvik/formulae/skhd"        # System-wide hotkey daemon

# GUI Applications
cask "ghostty"                     # GPU-accelerated terminal emulator
cask "raycast"                     # Spotlight replacement and launcher
cask "discord"                     # Voice and text chat
cask "notion"                      # Notes and project management
cask "notion-calendar"             # Calendar client
cask "arc"                         # Chromium-based browser
cask "google-chrome"               # Second browser, also drives chrome-devtools MCP
cask "slack"                       # Work chat; skhd binds it to ctrl+shift+cmd - s
cask "linear"                      # Issue tracker; skhd binds it to ctrl+shift+cmd - l
cask "signal"                      # Encrypted messaging
cask "granola"                     # Meeting notes
cask "figma"                       # Design
cask "orbstack"                    # Containers and Linux VMs
cask "superwhisper"                # Local dictation
cask "1password-cli"               # `op` CLI
cask "github@beta"                 # GitHub Desktop (beta channel)
cask "bazecor"                     # Dygma Defy keyboard configurator (see VirtualDefy.json)

# Fonts
cask "font-fira-code-nerd-font"   # Monospace font with programming ligatures and icons
cask "font-hack-nerd-font"        # Used by SketchyBar for icons

# Language Servers (used by OpenCode LSP)
brew "lua-language-server"        # Lua LSP for Neovim config files
