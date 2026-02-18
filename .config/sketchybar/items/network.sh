#!/bin/bash

##### Network Group (WiFi Signal, VPN Status) #####

sketchybar --add item wifi_signal right \
	--set wifi_signal script="$PLUGIN_DIR/wifi_signal.sh" \
	update_freq=10 \
	icon.padding_left=$NETWORK_ICON_PADDING \
	icon.padding_right=$NETWORK_ICON_PADDING \
	label.drawing=off \
	--subscribe wifi_signal wifi_change \
	\
	--add item vpn_status right \
	--set vpn_status script="$PLUGIN_DIR/vpn_status.sh" \
	update_freq=30 \
	icon.padding_left=$NETWORK_VPN_PADDING_LEFT \
	icon.padding_right=$NETWORK_VPN_PADDING_RIGHT \
	label.drawing=off \
	\
	--add bracket network_group wifi_signal vpn_status \
	--set network_group "${bracket_bg[@]}"

sketchybar --add item spacer_network_comm right \
	--set spacer_network_comm width=$SPACER_WIDTH \
	padding_left=$SPACER_PADDING \
	padding_right=$SPACER_PADDING \
	icon.drawing=off \
	label.drawing=off \
	background.drawing=off
