# Attach to tmux if a server is already running; never create sessions here.
# The long-lived sessions (Work, Perso & Configs) are declared in
# scripts/tmux-sessions and created by hand — see the tmux-sessions function.
# Note: attach picks the most recently *active* session, so this can land on
# dash or on a lingering popup session — switch with prefix+s.
# Kept above the instant prompt because this block ends in an exec.
# NO_TMUX=1 opts out. Absolute path fallback: brew shellenv has not run yet.
if [[ -o interactive && -z "$TMUX" && -z "$NO_TMUX" && -t 1 ]]; then
  _tmux=${${commands[tmux]}:-/opt/homebrew/bin/tmux}
  if [[ -x $_tmux ]]; then
    # has-session without -t only succeeds when the server has a session, so a
    # failing `exec attach` can never close the terminal.
    "$_tmux" has-session 2>/dev/null && exec "$_tmux" attach
  fi
  unset _tmux
fi

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

if [[ -f "/opt/homebrew/bin/brew" ]] then
  # If you're using macOS, you'll want this enabled
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
   mkdir -p "$(dirname $ZINIT_HOME)"
   git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# Add in Powerlevel10k
zinit ice depth=1; zinit light romkatv/powerlevel10k

# Add in zsh plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab

# Add in snippets
zinit snippet OMZL::git.zsh
zinit snippet OMZP::sudo
zinit snippet OMZP::command-not-found
zinit snippet OMZL::async_prompt.zsh
zinit snippet OMZP::git

# Load completions
autoload -Uz compinit && compinit

zinit cdreplay -q

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Keybindings
bindkey -e
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward
bindkey '^[w' kill-region

# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

# Completion styling
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

# Shell integrations
eval "$(fzf --zsh)"
eval "$(zoxide init --cmd cd zsh)"

# Tab accepts the autosuggestion when one is shown, otherwise completes as usual.
# Must come after `fzf --zsh`, which rebinds ^I itself; falling back to
# fzf-completion keeps its `**` trigger and its own fallback to fzf-tab.
# The leading underscore matters: zsh-autosuggestions skips wrapping `_*` widgets,
# which is what keeps POSTDISPLAY readable here instead of cleared.
_accept_suggestion_or_complete() {
  if [[ -n "$POSTDISPLAY" ]]; then
    zle autosuggest-accept
  elif zle -l fzf-completion; then
    zle fzf-completion
  elif zle -l fzf-tab-complete; then
    zle fzf-tab-complete
  else
    zle expand-or-complete
  fi
}
zle -N _accept_suggestion_or_complete
bindkey '^I' _accept_suggestion_or_complete

# XDG
export XDG_CONFIG_HOME="$HOME/.config"

# Exports
export LANG=en_US.UTF-8
alias python=python3
export PATH="$PATH:$HOME/.cargo/bin"
export EDITOR="nvim"
export ENHANCE_THEME=tokyo_night

# pnpm
export PNPM_HOME="/Users/maxime.grebauval/Library/pnpm"
case ":$PATH:" in
*":$PNPM_HOME:"*) ;;
*) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# opencode
export PATH=/Users/maxime.grebauval/.opencode/bin:$PATH
export OPENCODE_EXPERIMENTAL=1
export OPENCODE_EXPERIMENTAL_PLAN_MODE=0

# Mise-en-place

zinit as="command" lucid from="gh-r" for \
    id-as="mise" mv="mise* -> mise" \
    atclone="./mise* completion zsh > _mise" \
    atpull="%atclone" \
    atload='eval "$(mise activate zsh)"' \
    jdx/mise

# Aliases
alias ls='ls --color'
alias vim='nvim'
alias c='clear'
alias kci="kubectl ctx int-infra-eks-cluster-eu-west-3"
alias kcs="kubectl ctx stg-infra-eks-cluster-eu-west-3"
alias kcp="kubectl ctx prd-infra-eks-cluster-eu-west-3"
alias vi=nvim
alias oc="opencode"
alias bubu='brew update && brew outdated && brew upgrade && brew cleanup'
alias lg='lazygit'

# Yazi 
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	command yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ "$cwd" != "$PWD" ] && [ -d "$cwd" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

# Tmux
# Nothing creates the long-lived sessions behind your back: neither the
# bootstrap at the top of this file nor `tmux` itself. Run this by hand —
# typically once after a reboot. Outside tmux it also attaches, so a single
# command takes you from a bare shell to the declared layout. `~/scripts` is
# not on PATH, hence the wrapper rather than a plain call to the script.
function tmux-sessions() {
  "$HOME/scripts/tmux-sessions" || return
  [[ -n $TMUX ]] || command tmux attach
}

# Bun
export PATH="$HOME/.local/bin:$PATH"

# NOTE: do not source Ghostty's shell integration here. It composes its zle and
# precmd hooks by string-concatenating function bodies, which collides with
# powerlevel10k and leaks stray `}}` plus blank lines into the prompt. It also
# bought nothing under tmux: notify-on-command-finish needs OSC 133, and tmux
# absorbs OSC 133 instead of relaying it to the terminal.
