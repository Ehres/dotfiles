#!/bin/bash
# shellcheck source=../properties.sh

##### Magic Trackpad Battery #####

sketchybar --add item trackpad right \
	--set trackpad icon="󰟸" \
	script="$PLUGIN_DIR/trackpad_battery.sh" \
	update_freq=120 \
	drawing=off \
	padding_left=0 \
	padding_right="$GROUP_GAP_RIGHT" \
	icon.padding_left="$STANDALONE_ICON_PADDING" \
	icon.padding_right="$STANDALONE_ICON_PADDING" \
	"${item_bg[@]}" \
	--subscribe trackpad bluetooth_change
