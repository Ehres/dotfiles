#!/bin/bash
# shellcheck source=../properties.sh

##### AirPods Battery #####

sketchybar --add item headphones right \
	--set headphones icon="󱡏" \
	script="$PLUGIN_DIR/airpods_battery.sh" \
	update_freq=30 \
	padding_left=0 \
	padding_right="$GROUP_GAP_RIGHT" \
	icon.padding_left="$STANDALONE_ICON_PADDING" \
	icon.padding_right="$STANDALONE_ICON_PADDING" \
	"${item_bg[@]}" \
	--subscribe headphones bluetooth_change
