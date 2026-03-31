#!/usr/bin/env bash
# shellcheck source=../colors/components.sh
# shellcheck source=battery_icons.sh
. "$CONFIG_DIR/colors/components.sh"
. "$CONFIG_DIR/plugins/battery_icons.sh"

DEVICES="$(system_profiler SPBluetoothDataType -json -detailLevel basic 2>/dev/null | jq -rc '.SPBluetoothDataType[0].device_connected[] | select ( .[] | .device_minorType == "Headphones")' | jq '.[]')"
if [ "$DEVICES" = "" ]; then
	sketchybar -m --set "$NAME" drawing=off
else
	sketchybar -m --set "$NAME" drawing=on
	left="$(echo "$DEVICES" | jq -r .device_batteryLevelLeft)"
	right="$(echo "$DEVICES" | jq -r .device_batteryLevelRight)"
	case_lvl="$(echo "$DEVICES" | jq -r .device_batteryLevelCase)"

	# Build label with battery icons, track minimum level for color
	label=""
	min_pct=100

	# Left AirPod
	if [[ "$left" != "null" ]]; then
		num="${left/\%/}"
		label="$(battery_discharge_icon "$left")"
		[[ "$num" -lt "$min_pct" ]] && min_pct="$num"
	fi

	# Case (only if available)
	if [[ "$case_lvl" != "null" ]]; then
		num="${case_lvl/\%/}"
		[[ -n "$label" ]] && label="$label "
		label="$label$(battery_discharge_icon "$case_lvl")"
		[[ "$num" -lt "$min_pct" ]] && min_pct="$num"
	fi

	# Right AirPod
	if [[ "$right" != "null" ]]; then
		num="${right/\%/}"
		[[ -n "$label" ]] && label="$label "
		label="$label$(battery_discharge_icon "$right")"
		[[ "$num" -lt "$min_pct" ]] && min_pct="$num"
	fi

	# Label color based on minimum level across all components
	case "$min_pct" in
	[6-9][0-9] | 100) LABEL_COLOR="$ICON_OK" ;;
	[2-5][0-9]) LABEL_COLOR="$ICON_WARNING" ;;
	*) LABEL_COLOR="$ICON_ERROR" ;;
	esac

	sketchybar -m --set "$NAME" label="$label" label.color="$LABEL_COLOR"
fi
