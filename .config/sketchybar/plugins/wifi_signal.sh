#!/bin/sh

source "$CONFIG_DIR/colors/components.sh"

# --- Lire le RSSI WiFi via Swift CoreWLAN ---
WIFI_INFO=$(swift -e '
import CoreWLAN
if let iface = CWWiFiClient.shared().interface() {
    let rssi = iface.rssiValue()
    let power = iface.powerOn()
    print("\(power ? "on" : "off") \(rssi)")
} else {
    print("off 0")
}
' 2>/dev/null)

WIFI_POWER=$(echo "$WIFI_INFO" | awk '{print $1}')
RSSI=$(echo "$WIFI_INFO" | awk '{print $2}')

# --- Déterminer l'état et l'icône ---
if [ "$WIFI_POWER" = "on" ] && [ "$RSSI" != "0" ] && [ -n "$RSSI" ]; then
	# WiFi connecté — classifier la force du signal
	if [ "$RSSI" -ge -50 ] 2>/dev/null; then
		ICON="󰤨" # Excellent (≥ -50 dB)
		COLOR=$ICON_CONNECTED
	elif [ "$RSSI" -ge -65 ] 2>/dev/null; then
		ICON="󰤥" # Bon (-50 à -65 dB)
		COLOR=$ICON_CONNECTED
	elif [ "$RSSI" -ge -75 ] 2>/dev/null; then
		ICON="󰤢" # Moyen (-65 à -75 dB)
		COLOR=$ICON_WARNING
	else
		ICON="󰤟" # Faible (< -75 dB)
		COLOR=$ICON_ERROR
	fi
else
	# WiFi éteint ou non associé — vérifier Ethernet
	ETHERNET_IP=$(scutil --nwi 2>/dev/null | grep "address" | head -1 | sed 's/.*: //')

	if [ -n "$ETHERNET_IP" ]; then
		ICON="󰈀" # Ethernet connecté
		COLOR=$ICON_CONNECTED
	else
		ICON="󰤭" # Déconnecté
		COLOR=$ICON_DISCONNECTED
	fi
fi

# --- Mettre à jour sketchybar ---
sketchybar --set "$NAME" \
	icon="$ICON" \
	icon.color="$COLOR" \
	label.drawing=off
