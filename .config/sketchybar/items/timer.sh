#!/bin/bash
# shellcheck source=../properties.sh

##### Timer #####

sketchybar --add event timer_update

sketchybar --add item timer_gap right \
	--set timer_gap "${gap_item[@]}" drawing=off

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

# ── Yabai status badge (shown when yabai is not running) ──
sketchybar --add item yabai_status_gap right \
	--set yabai_status_gap "${gap_item[@]}" drawing=off

sketchybar --add item yabai_status right \
	--set yabai_status \
	icon="󱂬" \
	label="yabai off" \
	drawing=off \
	icon.padding_left=$SYSTEM_FIRST_ICON_PADDING \
	icon.padding_right=$SYSTEM_ICON_PADDING \
	label.padding_right=$SYSTEM_LAST_LABEL_PADDING \
	--add bracket yabai_status_group yabai_status \
	--set yabai_status_group "${bracket_bg[@]}"
