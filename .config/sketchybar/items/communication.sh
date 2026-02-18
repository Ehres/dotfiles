#!/bin/bash

##### Communication Group (Mail, Messages, Slack) #####

sketchybar --add item mail right \
	--set mail update_freq=30 \
	script="$PLUGIN_DIR/mail.sh" \
	click_script="open -a Mail" \
	padding_left=$COMM_ITEM_PADDING \
	padding_right=$COMM_ITEM_PADDING \
	icon.padding_left=$COMM_FIRST_ICON_PADDING \
	icon.padding_right=$COMM_ICON_PADDING \
	label.padding_left=$COMM_LABEL_PADDING_LEFT \
	label.padding_right=$COMM_LABEL_PADDING_RIGHT \
	\
	--add item messages right \
	--set messages update_freq=30 \
	script="$PLUGIN_DIR/messages.sh" \
	click_script="open -a Messages" \
	padding_left=$COMM_ITEM_PADDING \
	padding_right=$COMM_ITEM_PADDING \
	icon.padding_left=$COMM_ICON_PADDING \
	icon.padding_right=$COMM_ICON_PADDING \
	label.padding_left=$COMM_LABEL_PADDING_LEFT \
	label.padding_right=$COMM_LABEL_PADDING_RIGHT \
	\
	--add item slack right \
	--set slack update_freq=30 \
	script="$PLUGIN_DIR/slack.sh" \
	padding_left=$COMM_ITEM_PADDING \
	padding_right=$COMM_ITEM_PADDING \
	icon.padding_left=$COMM_ICON_PADDING \
	icon.padding_right=$COMM_ICON_PADDING \
	label.padding_left=$COMM_LABEL_PADDING_LEFT \
	label.padding_right=$COMM_LAST_LABEL_PADDING \
	--subscribe slack front_app_switched \
	\
	--add bracket communication_group mail messages slack \
	--set communication_group "${bracket_bg[@]}"

sketchybar --add item spacer_comm_updates right \
	--set spacer_comm_updates width=$SPACER_WIDTH \
	padding_left=$SPACER_PADDING \
	padding_right=$SPACER_PADDING \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
