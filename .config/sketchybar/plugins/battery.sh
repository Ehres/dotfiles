#!/bin/bash
# shellcheck source=../colors/components.sh
# shellcheck source=battery_icons.sh

source "$CONFIG_DIR/colors/components.sh"
source "$CONFIG_DIR/plugins/battery_icons.sh"

PERCENTAGE="$(pmset -g batt | grep -Eo "\d+%" | cut -d% -f1)"
CHARGING="$(pmset -g batt | grep 'AC Power')"

if [ "$PERCENTAGE" = "" ]; then
	exit 0
fi

if [ "$CHARGING" != "" ]; then
	ICON="$(battery_charging_icon "$PERCENTAGE")"
	COLOR="$ICON_OK"
else
	ICON="$(battery_discharge_icon "$PERCENTAGE")"
	case "${PERCENTAGE}" in
	[3-9][0-9] | 100) COLOR="$ICON_OK" ;;
	[1-2][0-9]) COLOR="$ICON_WARNING" ;;
	*) COLOR="$ICON_ERROR" ;;
	esac
fi

sketchybar --set "$NAME" icon="$ICON" icon.color="$COLOR" label.drawing=off
