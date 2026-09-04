#!/bin/bash

# shellcheck disable=SC1091
# shellcheck source=../colors/components.sh
source "$CONFIG_DIR/colors/components.sh"
# shellcheck disable=SC1091
# shellcheck source=../spacing/components.sh
source "$CONFIG_DIR/spacing/components.sh"

MODE="${MODE:-}"
STATE="${STATE:-}"

if [[ "$STATE" == "off" ]] || ! pgrep -x yabai >/dev/null 2>&1; then
	DRAWING=on
	LABEL="yabai off"
	COLOR="$YABAI_MODE_OFF_FG"
else
	case "$MODE" in
		resize)
			LABEL="RESIZE"
			COLOR="$YABAI_MODE_RESIZE_FG"
			;;
		arrange)
			LABEL="ARRANGE"
			COLOR="$YABAI_MODE_ARRANGE_FG"
			;;
		move)
			LABEL="MOVE"
			COLOR="$YABAI_MODE_MOVE_FG"
			;;
		app)
			LABEL="APP"
			COLOR="$YABAI_MODE_APP_FG"
			;;
		layout)
			LABEL="LAYOUT"
			COLOR="$YABAI_MODE_LAYOUT_FG"
			;;
		*)
			DRAWING=off
			LABEL=""
			COLOR="$YABAI_MODE_OFF_FG"
			;;
	esac
	if [[ -n "$LABEL" ]]; then
		DRAWING=on
	fi
fi

sketchybar --set yabai_status \
	drawing="$DRAWING" \
	label="$LABEL" \
	icon.color="$COLOR" \
	label.color="$COLOR" \
	--set yabai_status_group drawing="$DRAWING" \
	--set yabai_status_gap drawing="$DRAWING"
