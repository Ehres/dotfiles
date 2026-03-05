#!/bin/sh
# shellcheck source=../colors/components.sh
. "$CONFIG_DIR/colors/components.sh"

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

sketchybar --set "$NAME" label="${PERCENTAGE}%" icon.color="$COLOR"
