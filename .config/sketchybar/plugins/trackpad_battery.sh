#!/bin/sh
# shellcheck source=../colors/components.sh
# shellcheck source=battery_icons.sh
. "$CONFIG_DIR/colors/components.sh"
. "$CONFIG_DIR/plugins/battery_icons.sh"

PERCENTAGE="$(ioreg -p IOService -n "BNBTrackpadDevice" -r 2>/dev/null |
	grep '"BatteryPercent" =' | grep -v ExtendedFeatures | sed 's/.*= //')"

if [ -z "$PERCENTAGE" ]; then
	sketchybar --set "$NAME" drawing=off \
		--set spacer_network_trackpad drawing=off
	exit 0
fi

sketchybar --set "$NAME" drawing=on \
	--set spacer_network_trackpad drawing=on

case "$PERCENTAGE" in
[6-9][0-9] | 100) COLOR="$ICON_OK" ;;
[2-5][0-9]) COLOR="$ICON_WARNING" ;;
*) COLOR="$ICON_ERROR" ;;
esac

BATT_ICON="$(battery_discharge_icon "$PERCENTAGE")"

sketchybar --set "$NAME" icon.color="$COLOR" label="$BATT_ICON" label.drawing=on label.color="$COLOR"
