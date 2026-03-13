#!/bin/sh
# Shared battery icon helpers for SketchyBar plugins.
# Source this file, then call:
#   battery_discharge_icon <percentage>  -> nf-md-battery icon (no charging)
#   battery_charging_icon  <percentage>  -> nf-md-battery-charging icon

battery_discharge_icon() {
	num="${1%%\%*}"
	case "$num" in
	100) echo "󰁹" ;;
	9[0-9]) echo "󰂂" ;;
	8[0-9]) echo "󰂁" ;;
	7[0-9]) echo "󰂀" ;;
	6[0-9]) echo "󰁿" ;;
	5[0-9]) echo "󰁾" ;;
	4[0-9]) echo "󰁽" ;;
	3[0-9]) echo "󰁼" ;;
	2[0-9]) echo "󰁻" ;;
	1[0-9]) echo "󰁺" ;;
	*) echo "󰂃" ;;
	esac
}

battery_charging_icon() {
	num="${1%%\%*}"
	case "$num" in
	100) echo "󰂅" ;;
	9[0-9]) echo "󰂋" ;;
	8[0-9]) echo "󰂊" ;;
	7[0-9]) echo "󰢞" ;;
	6[0-9]) echo "󰂉" ;;
	5[0-9]) echo "󰢝" ;;
	4[0-9]) echo "󰂈" ;;
	3[0-9]) echo "󰂇" ;;
	2[0-9]) echo "󰂆" ;;
	1[0-9]) echo "󰢜" ;;
	*) echo "󰢟" ;;
	esac
}
