#!/bin/bash
set -euo pipefail

spec_path=${1:?usage: open-spec.sh PATH}
if [ ! -f "$spec_path" ]; then
  printf 'Spec not found: %s\n' "$spec_path"
  exit 0
fi
if [ -z "${TMUX:-}" ]; then
  printf 'Read the spec at %s (not in tmux).\n' "$spec_path"
  exit 0
fi

panes=$(tmux list-panes -a -F '#{pane_id} #{pane_pid}') || {
  printf 'Unable to list tmux panes; read the spec at %s\n' "$spec_path" >&2
  exit 1
}
target=
if [ -n "${TMUX_PANE:-}" ] && printf '%s\n' "$panes" | awk -v id="$TMUX_PANE" '$1 == id { found=1 } END { exit !found }'; then
  target=$TMUX_PANE
else
  pid=$PPID
  while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null; do
    target=$(printf '%s\n' "$panes" | awk -v pid="$pid" '$2 == pid { print $1; exit }')
    [ -z "$target" ] || break
    parent=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [ -n "$parent" ] || break
    pid=$parent
  done
fi

if [ -z "$target" ]; then
  printf 'Unable to resolve the invoking tmux pane; read the spec at %s\n' "$spec_path" >&2
  exit 1
fi
tmux split-window -t "$target" -h -p 60 -c "$(dirname "$spec_path")" \
  nvim -R -c 'lua vim.diagnostic.enable(false, { bufnr = 0 })' -c 'setlocal nospell' -- "$spec_path"
