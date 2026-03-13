#!/bin/sh
# shellcheck source=../colors/components.sh
# shellcheck source=updates_group_visibility.sh

. "$CONFIG_DIR/colors/components.sh"

# ── PATH: garantir que nvim et jq sont trouvables ──
for p in /opt/homebrew/bin /usr/local/bin; do
  case ":$PATH:" in
  *":$p:"*) ;;
  *) PATH="$p:$PATH" ;;
  esac
done

ICON=""

# ── Guard: nvim doit être installé ──
if ! command -v nvim >/dev/null 2>&1; then
  sketchybar --set "$NAME" drawing=off
  . "$PLUGIN_DIR/updates_group_visibility.sh"
  exit 0
fi

# ── Vérification headless des mises à jour lazy.nvim ──
# Step 1: git fetch all plugins (blocks until done, 120s watchdog)
sh -c 'sleep 120 && kill -9 $PPID 2>/dev/null' &
WATCHDOG=$!
nvim --headless "+Lazy! check" +qa 2>/dev/null
kill "$WATCHDOG" 2>/dev/null

# Step 2: read pending count via public lazy.status API
COUNT=$(nvim --headless -c "lua io.write(require('lazy.status').has_updates() and tostring(tonumber(require('lazy.status').updates():match('%d+'))) or '0'); vim.cmd('qa!')" 2>/dev/null)

# ── Fallback: vide ou non-numérique → 0 ──
case "$COUNT" in
'' | *[!0-9]*) COUNT=0 ;;
esac

# ── Cacher si rien à mettre à jour ──
if [ "$COUNT" -eq 0 ]; then
  sketchybar --set "$NAME" drawing=off
  . "$PLUGIN_DIR/updates_group_visibility.sh"
  exit 0
fi

# ── Couleur par seuil ──
if [ "$COUNT" -ge 21 ]; then
  ICON_COLOR="$ICON_ERROR"
elif [ "$COUNT" -ge 11 ]; then
  ICON_COLOR="$ICON_WARNING"
else
  ICON_COLOR="$STATUS_INFO"
fi

sketchybar --set "$NAME" \
  icon="$ICON" \
  label="$COUNT" \
  icon.color="$ICON_COLOR" \
  drawing=on

. "$PLUGIN_DIR/updates_group_visibility.sh"
