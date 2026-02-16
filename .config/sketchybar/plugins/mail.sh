#!/bin/sh

source "$CONFIG_DIR/colors/components.sh"

ICON="󰇮"

# Find Mail database (V10=Sonoma/Sequoia, fallback older versions)
DB=""
for V in 10 9 8 7; do
	CANDIDATE="$HOME/Library/Mail/V${V}/MailData/Envelope Index"
	if [ -r "$CANDIDATE" ]; then
		DB="$CANDIDATE"
		break
	fi
done

[ -z "$DB" ] && exit 0

COUNT=$(sqlite3 -readonly "$DB" \
	"SELECT COALESCE(SUM(unread_count), 0) FROM mailboxes WHERE url LIKE '%/INBOX';" 2>/dev/null)

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

source "$PLUGIN_DIR/comm_group_visibility.sh"
