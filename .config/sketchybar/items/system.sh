#!/bin/bash
# shellcheck source=../properties.sh

##### System Group (Clock, Battery, Volume) #####
# Right items stack right-to-left: clock (first added) = far right edge

# Register Bluetooth event for AirPods detection
sketchybar -m --add event bluetooth_change "com.apple.bluetooth.status"

sketchybar --add item clock right \
	--set clock update_freq=10 \
	icon= \
	script="$PLUGIN_DIR/clock.sh" \
	padding_left="$SYSTEM_ITEM_PADDING" \
	padding_right="$SYSTEM_ITEM_PADDING" \
	icon.padding_left="$SYSTEM_ICON_PADDING" \
	icon.padding_right="$SYSTEM_ICON_PADDING" \
	label.padding_right="$SYSTEM_LAST_LABEL_PADDING" \
	\
	--add item battery right \
	--set battery script="$PLUGIN_DIR/battery.sh" \
	update_freq=120 \
	padding_left="$SYSTEM_ITEM_PADDING" \
	padding_right="$SYSTEM_ITEM_PADDING" \
	icon.padding_left="$SYSTEM_ICON_PADDING" \
	icon.padding_right="$SYSTEM_ICON_PADDING" \
	--subscribe battery system_woke power_source_change \
	\
	--add item volume right \
	--set volume script="$PLUGIN_DIR/volume.sh" \
	padding_left="$SYSTEM_ITEM_PADDING" \
	padding_right="$SYSTEM_ITEM_PADDING" \
	icon.padding_left="$SYSTEM_FIRST_ICON_PADDING" \
	icon.padding_right="$SYSTEM_ICON_PADDING" \
	--subscribe volume volume_change \
	\
	--add bracket system_group clock battery volume \
	--set system_group "${bracket_bg[@]}"

sketchybar --add item spacer_system_network right \
	--set spacer_system_network width="$SPACER_WIDTH" \
	padding_left="$SPACER_PADDING" \
	padding_right="$SPACER_PADDING" \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
