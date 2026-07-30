#!/bin/sh
# shellcheck source=../colors/components.sh

. "$CONFIG_DIR/colors/components.sh"

# --- Lire le RSSI WiFi via un helper Swift précompilé ---
# `swift -e` recompilait le source à chaque tick : 120 ms et 124 Mo de RSS
# toutes les 10 s. Compilé, c'est 10 ms et 9 Mo. Le binaire est mis en cache et
# reconstruit uniquement si le source est plus récent.
WIFI_SRC="$HOME/scripts/wifi-rssi.swift"
WIFI_BIN="${XDG_CACHE_HOME:-$HOME/.cache}/sketchybar/wifi-rssi"

if [ ! -x "$WIFI_BIN" ] || [ "$WIFI_SRC" -nt "$WIFI_BIN" ]; then
	mkdir -p "$(dirname "$WIFI_BIN")"
	swiftc -O -o "$WIFI_BIN" "$WIFI_SRC" 2>/dev/null
fi

if [ -x "$WIFI_BIN" ]; then
	WIFI_INFO=$("$WIFI_BIN" 2>/dev/null)
else
	# Repli si les outils Swift sont absents : l'icône dégrade en "déconnecté"
	# plutôt que de faire échouer l'item.
	WIFI_INFO="off 0"
fi

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
