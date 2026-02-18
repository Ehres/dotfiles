#!/bin/sh

source "$CONFIG_DIR/colors/components.sh"

TIMER_FILE="/tmp/sketchybar_timer"
DONE_FILE="/tmp/sketchybar_timer_done"

# ── État "expired" → fond rouge persistant, pas de polling ──
if [ -f "$DONE_FILE" ]; then
	sketchybar --set "$NAME" \
		label="00:00" \
		icon.color="$TIMER_ALERT_FG" \
		label.color="$TIMER_ALERT_FG" \
		drawing=on \
		update_freq=0 \
		--set timer_group background.color="$TIMER_ALERT_BG"
	exit 0
fi

# ── Pas de timer → cacher et restaurer les couleurs par défaut ──
if [ ! -f "$TIMER_FILE" ]; then
	sketchybar --set "$NAME" \
		drawing=off \
		update_freq=0 \
		icon.color="$ICON_DEFAULT" \
		label.color="$LABEL_DEFAULT" \
		--set timer_group background.color="$ITEM_BG"
	exit 0
fi

END_EPOCH=$(cat "$TIMER_FILE")
NOW=$(date +%s)
REMAINING=$((END_EPOCH - NOW))

# ── Timer terminé → transition vers "expired" ──
if [ "$REMAINING" -le 0 ]; then
	rm -f "$TIMER_FILE"
	touch "$DONE_FILE"
	sketchybar --set "$NAME" \
		label="00:00" \
		icon.color="$TIMER_ALERT_FG" \
		label.color="$TIMER_ALERT_FG" \
		drawing=on \
		update_freq=0 \
		--set timer_group background.color="$TIMER_ALERT_BG"
	osascript -e 'display notification "Time is up!" with title "Timer"'

	# Alarme en boucle (5 secondes max, arrêtable via stop)
	(
		ALARM_END=$(($(date +%s) + 5))
		while [ "$(date +%s)" -lt "$ALARM_END" ]; do
			afplay /System/Library/Sounds/Sosumi.aiff &
			AFPLAY_PID=$!
			sleep 0.8
			kill $AFPLAY_PID 2>/dev/null
		done
	) &
	echo $! >/tmp/sketchybar_timer_alarm_pid

	exit 0
fi

# ── Timer actif → afficher le décompte ──
MIN=$((REMAINING / 60))
SEC=$((REMAINING % 60))
LABEL=$(printf "%02d:%02d" "$MIN" "$SEC")

if [ "$REMAINING" -le 60 ]; then
	COLOR="$ICON_WARNING"
else
	COLOR="$STATUS_INFO"
fi

sketchybar --set "$NAME" \
	label="$LABEL" \
	icon.color="$COLOR" \
	label.color="$LABEL_DEFAULT" \
	drawing=on \
	update_freq=1 \
	--set timer_group background.color="$ITEM_BG"
