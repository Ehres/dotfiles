#!/bin/bash
# shellcheck source=../properties.sh

##### Magic Trackpad Battery #####

sketchybar --add item trackpad right \
	--set trackpad icon="󰟸" \
	script="$PLUGIN_DIR/trackpad_battery.sh" \
	update_freq=120 \
	drawing=off \
	icon.padding_left="$STANDALONE_ICON_PADDING" \
	icon.padding_right="$STANDALONE_ICON_PADDING" \
	"${item_bg[@]}" \
	--subscribe trackpad bluetooth_change

sketchybar --add item spacer_trackpad_comm right \
	--set spacer_trackpad_comm width="$SPACER_WIDTH" \
	padding_left="$SPACER_PADDING" \
	padding_right="$SPACER_PADDING" \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
