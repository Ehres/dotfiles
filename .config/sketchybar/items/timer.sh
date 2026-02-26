#!/bin/bash
# shellcheck source=../properties.sh

##### Timer #####

sketchybar --add event timer_update

sketchybar --add item timer right \
	--set timer icon="󰔛" \
	script="$PLUGIN_DIR/timer.sh" \
	click_script="$PLUGIN_DIR/timer_ctl.sh stop" \
	update_freq=0 \
	drawing=off \
	icon.padding_left="$STANDALONE_ICON_PADDING" \
	icon.padding_right="$STANDALONE_ICON_PADDING" \
	label.padding_left="$PADDING_TIGHT" \
	label.padding_right="$STANDALONE_ICON_PADDING" \
	--subscribe timer timer_update \
	--add bracket timer_group timer \
	--set timer_group "${bracket_bg[@]}"
