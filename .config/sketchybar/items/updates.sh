#!/bin/bash
# shellcheck source=../properties.sh

##### Updates Group (Brew, Neovim) #####

sketchybar --add item brew_updates right \
	--set brew_updates update_freq=300 \
	icon="󰏗" \
	script="$PLUGIN_DIR/brew_updates.sh" \
	drawing=off \
	padding_left="$UPDATES_ITEM_PADDING" \
	padding_right="$UPDATES_ITEM_PADDING" \
	icon.padding_left="$UPDATES_FIRST_ICON_PADDING" \
	icon.padding_right="$UPDATES_ICON_PADDING" \
	label.padding_left="$UPDATES_LABEL_PADDING_LEFT" \
	label.padding_right="$UPDATES_LABEL_PADDING_RIGHT" \
	\
	--add item nvim_updates right \
	--set nvim_updates update_freq=3600 \
	icon="" \
	script="$PLUGIN_DIR/nvim_updates.sh" \
	drawing=off \
	padding_left="$UPDATES_ITEM_PADDING" \
	padding_right="$UPDATES_ITEM_PADDING" \
	icon.padding_left="$UPDATES_LAST_ICON_PADDING" \
	icon.padding_right="$UPDATES_ICON_PADDING" \
	label.padding_left="$UPDATES_LABEL_PADDING_LEFT" \
	label.padding_right="$UPDATES_LAST_LABEL_PADDING" \
	\
	--add bracket updates_group brew_updates nvim_updates \
	--set updates_group "${bracket_bg[@]}"

sketchybar --add item spacer_updates_headphones right \
	--set spacer_updates_headphones width="$SPACER_WIDTH" \
	padding_left="$SPACER_PADDING" \
	padding_right="$SPACER_PADDING" \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
