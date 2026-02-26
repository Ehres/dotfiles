#!/bin/sh
# shellcheck source=../colors/components.sh
# shellcheck source=comm_group_visibility.sh

. "$CONFIG_DIR/colors/components.sh"

ICON="󰍡"
DB="$HOME/Library/Messages/chat.db"

# Exit silently if database doesn't exist or isn't readable
[ -r "$DB" ] || exit 0

COUNT=$(sqlite3 -readonly "$DB" \
	"SELECT COUNT(*) FROM message
   WHERE is_from_me = 0
     AND is_read = 0
     AND date > 0
     AND item_type = 0
     AND associated_message_type = 0
     AND is_service_message = 0;" 2>/dev/null)

[ -z "$COUNT" ] && exit 0

if [ "$COUNT" -gt 0 ] 2>/dev/null; then
	ICON_COLOR="$ICON_ERROR"
	LABEL="$COUNT"
	DRAWING="on"
else
	ICON_COLOR="$ICON_OK"
	LABEL=""
	DRAWING="off"
fi

sketchybar --set "$NAME" icon="$ICON" label="$LABEL" icon.color="$ICON_COLOR" drawing="$DRAWING"

. "$PLUGIN_DIR/comm_group_visibility.sh"
