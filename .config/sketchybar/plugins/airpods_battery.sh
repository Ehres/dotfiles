#!/usr/bin/env bash

DEVICES="$(system_profiler SPBluetoothDataType -json -detailLevel basic 2>/dev/null | jq -rc '.SPBluetoothDataType[0].device_connected[] | select ( .[] | .device_minorType == "Headphones")' | jq '.[]')"
if [ "$DEVICES" = "" ]; then
	sketchybar -m --set "$NAME" drawing=off \
		--set spacer_updates_headphones drawing=off
else
	sketchybar -m --set "$NAME" drawing=on \
		--set spacer_updates_headphones drawing=on
	left="$(echo "$DEVICES" | jq -r .device_batteryLevelLeft)"
	right="$(echo "$DEVICES" | jq -r .device_batteryLevelRight)"
	case="$(echo "$DEVICES" | jq -r .device_batteryLevelCase)"

	# Build label dynamically - only show available components
	label=""

	# Left AirPod
	if [[ "$left" != "null" ]]; then
		label="$left"
	fi

	# Case (only if available)
	if [[ "$case" != "null" ]]; then
		[[ -n "$label" ]] && label="$label "
		label="$label$case"
	fi

	# Right AirPod
	if [[ "$right" != "null" ]]; then
		[[ -n "$label" ]] && label="$label "
		label="$label$right"
	fi

	sketchybar -m --set "$NAME" label="$label"
fi
