#!/bin/bash
# shellcheck source=../colors/components.sh
# shellcheck source=comm_group_visibility.sh

. "$CONFIG_DIR/colors/components.sh"

STATUS_LABEL=$(lsappinfo info -only StatusLabel "Slack")
ICON="󰒱"
if [[ $STATUS_LABEL =~ \"label\"=\"([^\"]*)\" ]]; then
	LABEL="${BASH_REMATCH[1]}"

	if [[ $LABEL == "" ]]; then
		ICON_COLOR="$ICON_OK"
		DRAWING="off"
	elif [[ $LABEL == "•" ]]; then
		ICON_COLOR="$ICON_WARNING"
		DRAWING="on"
	elif [[ $LABEL =~ ^[0-9]+$ ]]; then
		ICON_COLOR="$ICON_ERROR"
		DRAWING="on"
	else
		exit 0
	fi
else
	exit 0
fi

sketchybar --set "$NAME" icon="$ICON" label="${LABEL}" icon.color="${ICON_COLOR}" drawing="${DRAWING}"

. "$PLUGIN_DIR/comm_group_visibility.sh"
