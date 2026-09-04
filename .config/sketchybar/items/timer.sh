#!/bin/bash
# shellcheck source=../properties.sh

##### Timer #####

sketchybar --add event timer_update
sketchybar --add event yabai_status_update

# shellcheck disable=SC2154
sketchybar --add item timer_gap right \
	--set timer_gap "${gap_item[@]}" drawing=off

# shellcheck disable=SC2154
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

# ── Yabai status/mode badge ──
# shellcheck disable=SC2154
sketchybar --add item yabai_status_gap right \
	--set yabai_status_gap "${gap_item[@]}" drawing=off

# shellcheck disable=SC2154
sketchybar --add item yabai_status right \
	--set yabai_status \
	icon="󱂬" \
	label="yabai off" \
	script="$PLUGIN_DIR/yabai_status.sh" \
	update_freq=0 \
	drawing=off \
	icon.padding_left="$SYSTEM_FIRST_ICON_PADDING" \
	icon.padding_right="$SYSTEM_ICON_PADDING" \
	label.padding_right="$SYSTEM_LAST_LABEL_PADDING" \
	--subscribe yabai_status yabai_status_update \
	--add bracket yabai_status_group yabai_status \
	--set yabai_status_group "${bracket_bg[@]}"

sketchybar --trigger yabai_status_update
