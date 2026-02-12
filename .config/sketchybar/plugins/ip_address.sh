#!/bin/sh

source "$HOME/.config/colors.sh" # Loads all defined colors

# Check for VPN by looking for utun interfaces with IP addresses
# Tunnelblick and most VPNs use utun interfaces
VPN_IP=$(ifconfig | grep -A 4 "^utun" | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{print $2}')

# Get regular WiFi/Ethernet IP
WIFI_IP=$(scutil --nwi | grep address | sed 's/.*://' | tr -d ' ' | head -1)

if [[ $VPN_IP != "" ]]; then
	# VPN State - show VPN IP
	ICON=
	LABEL="VPN: $VPN_IP"
	BORDER_COLOR=$BORDER_VPN
elif [[ $WIFI_IP != "" ]]; then
	# Connected State - show WiFi/Ethernet IP
	ICON=
	LABEL=$WIFI_IP
	BORDER_COLOR=$BORDER_CONNECTED
else
	# Disconnected State
	ICON=
	LABEL="Not Connected"
	BORDER_COLOR=$BORDER_DISCONNECTED
fi

# Update the item itself
sketchybar --set $NAME icon="$ICON" label="$LABEL"
