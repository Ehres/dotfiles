#!/bin/bash
# Health check for this dotfiles repo.
#
# Every check here exists because the corresponding thing was actually found
# broken, most of them silently. Run it after changing config, and before
# trusting that a fresh machine would come up correctly.
#
#   ./scripts/doctor.sh            # all checks
#   ./scripts/doctor.sh --quick    # skip the slow ones (nvim, brew, shellcheck)
#
# Exit status: 0 if nothing failed, 1 if any check failed. Warnings do not fail.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

QUICK=false
[[ "${1:-}" == "--quick" ]] && QUICK=true

if [[ -t 1 ]]; then
  R=$'\e[31m' G=$'\e[32m' Y=$'\e[33m' B=$'\e[1m' N=$'\e[0m'
else
  R="" G="" Y="" B="" N=""
fi

fails=0
warns=0

section() { printf '\n%s%s%s\n' "$B" "$1" "$N"; }
ok() { printf '  %sok%s    %s\n' "$G" "$N" "$1"; }
warn() {
  printf '  %swarn%s  %s\n' "$Y" "$N" "$1"
  warns=$((warns + 1))
}
fail() {
  printf '  %sFAIL%s  %s\n' "$R" "$N" "$1"
  fails=$((fails + 1))
}

# --------------------------------------------------------------------------
section "Symlinks"
# `stow .` aborted with 3415 conflicts and installed nothing, because stow does
# not read .gitignore and tried to link dependency trees into $HOME.
if ! command -v stow >/dev/null; then
  fail "stow is not installed"
elif conflicts=$(stow -n -v --target="$HOME" . 2>&1 | grep -c 'cannot stow'); [[ "$conflicts" -gt 0 ]]; then
  fail "stow reports $conflicts conflict(s) -- \`stow .\` would install nothing. Run: stow -n -v ."
else
  ok "stow has no conflicts"
fi

# Dangling links left behind when a config is removed from the repo.
dangling=$(find "$HOME" -maxdepth 2 -type l ! -exec test -e {} \; -print 2>/dev/null |
  grep -v '/\.Trash/' | grep -c "$(basename "$REPO")" || true)
if [[ "${dangling:-0}" -gt 0 ]]; then
  warn "$dangling dangling symlink(s) into this repo -- a config was removed without unstowing"
else
  ok "no dangling symlinks into the repo"
fi

# --------------------------------------------------------------------------
section "Secrets"
# The README documented the Keychain entries with service and account swapped,
# so fnox could never read them and secrets were inlined into config instead.
if ! command -v fnox >/dev/null; then
  warn "fnox is not installed -- secrets cannot be injected"
else
  while read -r key; do
    [[ -z "$key" ]] && continue
    if fnox --config .config/opencode/fnox.toml get "$key" >/dev/null 2>&1; then
      ok "$key resolves from the Keychain"
    else
      fail "$key does not resolve. Add it with: security add-generic-password -s \"Keychain Access\" -a $key -w"
    fi
  done < <(grep -oE '^[A-Z0-9_]+' .config/opencode/fnox.toml 2>/dev/null)
fi

# A plaintext token sat in a tracked file, on a public remote, for 5 months.
if leaked=$(git grep -nIE '"(client_?[Ss]ecret|[A-Z0-9_]*(TOKEN|API_KEY|PASSWORD|SECRET))"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_\-]{16,}"' -- \
  ':!*.lock' ':!*lock.json' ':!*.yaml' 2>/dev/null); [[ -n "$leaked" ]]; then
  fail "possible plaintext credential in a tracked file:"
  printf '        %s\n' "$(echo "$leaked" | cut -d: -f1-2)"
else
  ok "no plaintext credentials in tracked files"
fi

# --------------------------------------------------------------------------
section "Binaries the config depends on"
# Each of these is referenced by a config file; a missing one fails silently.
#   binary:what breaks without it
deps=(
  "delta:git pager (.gitconfig core.pager)"
  "hunk:nothing -- left over, safe to uninstall"
  "tuicr:tmux prefix+R popup"
  "gh:tmux dash session (gh dash)"
  "lazygit:tmux prefix+g popup"
  "yazi:tmux prefix+y popup"
  "btop:tmux prefix+m popup"
  "stylua:the Lua formatting command in AGENTS.md"
  "shellcheck:the shell linting rules in AGENTS.md"
  "rtk:the opencode rtk plugin"
  "mise:node and fnox provisioning"
  "nvim:EDITOR"
)
for entry in "${deps[@]}"; do
  bin="${entry%%:*}"
  why="${entry#*:}"
  if command -v "$bin" >/dev/null; then
    ok "$bin"
  elif [[ "$bin" == "hunk" ]]; then
    ok "hunk absent (no longer used)"
  else
    fail "$bin missing -- breaks: $why"
  fi
done

# python3.12 is hardcoded by absolute path in .tmux.conf, so PATH will not save us.
py=$(grep -oE '/opt/homebrew/bin/python3\.[0-9]+' .tmux.conf 2>/dev/null | head -1)
if [[ -n "$py" ]]; then
  if [[ -x "$py" ]]; then
    ok "$py (hardcoded in .tmux.conf)"
  else
    fail "$py is hardcoded in .tmux.conf but does not exist -- prefix+C-f exits silently"
  fi
fi

# --------------------------------------------------------------------------
section "Hardcoded paths that break on upgrade"
# btop's theme was pinned to /opt/homebrew/Cellar/btop/<version>/, so the next
# `brew upgrade` would silently drop it back to the default theme.
if cellar=$(grep -rlE '/opt/homebrew/Cellar/[a-z0-9_-]+/[0-9]' \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.tmux . 2>/dev/null); [[ -n "$cellar" ]]; then
  while read -r f; do
    [[ -z "$f" ]] && continue
    warn "$f pins a versioned Cellar path -- breaks on brew upgrade"
  done <<<"$cellar"
else
  ok "no versioned Cellar paths"
fi

# --------------------------------------------------------------------------
section "tmux"
# tmux-sessions looked for "Perso & configs" while the session is "Perso & Configs",
# so the exact-match lookup always failed and a duplicate was created on each run.
if [[ -x scripts/tmux-sessions ]]; then
  bad=0
  while read -r want; do
    [[ -z "$want" ]] && continue
    if tmux has-session -t "=$want" 2>/dev/null; then
      ok "session '$want' matches exactly"
    elif tmux info >/dev/null 2>&1; then
      fail "tmux-sessions declares '$want' but no session matches exactly -- running the script would create a duplicate"
      bad=1
    fi
  done < <(grep -oE '^ensure "[^"]+"' scripts/tmux-sessions | sed 's/ensure "//;s/"//')
  [[ "$bad" -eq 0 ]] || true
fi

# The popup fix depends on default-command staying empty.
if tmux info >/dev/null 2>&1; then
  dc=$(tmux show-options -g default-command 2>/dev/null | cut -d' ' -f2-)
  if [[ "$dc" == "''" || -z "$dc" ]]; then
    ok "default-command is empty (popups start their command directly)"
  else
    warn "default-command is set to $dc -- popups pay a full shell startup again"
  fi
fi

# --------------------------------------------------------------------------
section "Documentation matches reality"
# README referenced two scripts that never existed, and four READMEs likewise.
missing=0
while read -r path; do
  [[ -z "$path" ]] && continue
  [[ -e "$path" ]] || {
    warn "README.md links to missing $path"
    missing=$((missing + 1))
  }
done < <(grep -oE '\]\([^)h][^)]*\)' README.md 2>/dev/null | sed 's/](//;s/)//')
[[ "$missing" -eq 0 ]] && ok "every README link resolves"

for doc in README.md AGENTS.md; do
  while read -r s; do
    [[ -z "$s" ]] && continue
    [[ -e "$s" ]] || warn "$doc documents missing script $s"
  done < <(grep -oE '\./scripts/[A-Za-z0-9._-]+' "$doc" 2>/dev/null | sort -u)
done

# --------------------------------------------------------------------------
if ! $QUICK; then
  section "Brewfile"
  if command -v brew >/dev/null; then
    if out=$(brew bundle check --file=Brewfile --verbose 2>&1); then
      ok "everything declared is installed"
    else
      # Outdated casks are reported the same way as missing ones; only the
      # genuinely absent ones matter here.
      while read -r line; do
        [[ "$line" =~ needs\ to\ be\ installed ]] || continue
        name=$(echo "$line" | sed -E 's/.*(Cask|Formula) ([^ ]+).*/\2/')
        if brew list "$name" >/dev/null 2>&1 || brew list --cask "$name" >/dev/null 2>&1; then
          warn "$name is installed but outdated"
        else
          fail "$name is declared in the Brewfile but not installed"
        fi
      done <<<"$out"
    fi
  fi

  section "Formatting and linting"
  if command -v stylua >/dev/null; then
    if stylua --check .config/nvim/ >/dev/null 2>&1; then
      ok "stylua: .config/nvim is formatted"
    else
      warn "stylua reports unformatted Lua -- run: stylua .config/nvim/"
    fi
  fi
  if command -v shellcheck >/dev/null; then
    n=$(shellcheck -S warning .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh \
      scripts/*.sh scripts/tmux-* 2>/dev/null | grep -c '^In ' || true)
    if [[ "${n:-0}" -eq 0 ]]; then
      ok "shellcheck: no warnings"
    else
      warn "shellcheck reports $n warning(s) -- several are AGENTS.md rules"
    fi
  fi

  section "Neovim"
  if command -v nvim >/dev/null; then
    errs=$(nvim --headless "+checkhealth" +qa 2>&1 | grep -cE '^\s*- ERROR' || true)
    if [[ "${errs:-0}" -eq 0 ]]; then
      ok "checkhealth reports no errors"
    else
      warn "checkhealth reports $errs error(s) -- run :checkhealth"
    fi
  fi
fi

# --------------------------------------------------------------------------
printf '\n%s%s%s\n' "$B" "----" "$N"
if [[ "$fails" -gt 0 ]]; then
  printf '%s%d failed%s, %d warning(s)\n' "$R" "$fails" "$N" "$warns"
  exit 1
fi
printf '%sall checks passed%s, %d warning(s)\n' "$G" "$N" "$warns"
