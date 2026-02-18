#!/bin/bash

##### AirPods Battery #####

sketchybar --add item headphones right \
	--set headphones icon="󱡏" \
	script="$PLUGIN_DIR/airpods_battery.sh" \
	update_freq=30 \
	icon.padding_left=$STANDALONE_ICON_PADDING \
	icon.padding_right=$STANDALONE_ICON_PADDING \
	"${item_bg[@]}" \
	--subscribe headphones bluetooth_change

sketchybar --add item spacer_headphones_timer right \
	--set spacer_headphones_timer width=$SPACER_WIDTH \
	padding_left=$SPACER_PADDING \
	padding_right=$SPACER_PADDING \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
