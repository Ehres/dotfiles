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

# Preview Dependencies (for yazi and other tools)
brew "ffmpegthumbnailer"           # Video thumbnails
brew "unar"                        # Archive preview and extraction
brew "poppler"                     # PDF preview and rendering

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
cask "arc"                         # Chromium-based browser

# Fonts
cask "font-fira-code-nerd-font"   # Monospace font with programming ligatures and icons
cask "font-hack-nerd-font"        # Used by SketchyBar for icons

# Language Servers (used by OpenCode LSP)
brew "lua-language-server"        # Lua LSP for Neovim config files
