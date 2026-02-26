#!/bin/bash
# shellcheck source=../properties.sh

##### Updates Group #####

sketchybar --add item brew_updates right \
	--set brew_updates update_freq=300 \
	icon="󰏗" \
	script="$PLUGIN_DIR/brew_updates.sh" \
	drawing=off \
	icon.padding_left="$STANDALONE_ICON_PADDING" \
	icon.padding_right="$STANDALONE_ICON_PADDING" \
	label.padding_left="$PADDING_TIGHT" \
	label.padding_right="$STANDALONE_ICON_PADDING" \
	\
	--add bracket updates_group brew_updates \
	--set updates_group "${bracket_bg[@]}"

sketchybar --add item spacer_updates_headphones right \
	--set spacer_updates_headphones width="$SPACER_WIDTH" \
	padding_left="$SPACER_PADDING" \
	padding_right="$SPACER_PADDING" \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
