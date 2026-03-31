#!/bin/bash
# shellcheck source=../properties.sh

##### Network Group (WiFi Signal, VPN Status) #####

sketchybar --add item network_gap right \
	--set network_gap "${gap_item[@]}"

sketchybar --add item wifi_signal right \
	--set wifi_signal script="$PLUGIN_DIR/wifi_signal.sh" \
	update_freq=10 \
	padding_left="$NETWORK_ITEM_PADDING" \
	padding_right="$NETWORK_ITEM_PADDING" \
	icon.padding_left="$NETWORK_BOOKEND_ICON_PADDING" \
	icon.padding_right="$NETWORK_ICON_PADDING" \
	label.drawing=off \
	--subscribe wifi_signal wifi_change \
	\
	--add item vpn_status right \
	--set vpn_status script="$PLUGIN_DIR/vpn_status.sh" \
	update_freq=30 \
	padding_left="$NETWORK_ITEM_PADDING" \
	padding_right="$NETWORK_ITEM_PADDING" \
	icon.padding_left="$NETWORK_BOOKEND_ICON_PADDING" \
	icon.padding_right="$NETWORK_ICON_PADDING" \
	label.drawing=off \
	\
	--add bracket network_group wifi_signal vpn_status \
	--set network_group "${bracket_bg[@]}"
