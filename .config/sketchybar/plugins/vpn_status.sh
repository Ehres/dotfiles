#!/bin/sh

source "$HOME/.config/colors.sh"

# Détecter VPN via interfaces utun avec IP
VPN_IP=$(ifconfig 2>/dev/null |
  grep -A 4 "^utun" |
  grep "inet " |
  grep -v "127.0.0.1" |
  head -1 |
  awk '{print $2}')

if [ -n "$VPN_IP" ]; then
  # VPN actif — afficher l'icône shield
  sketchybar --set "$NAME" \
    icon="VPN" \
    icon.color="$CYAN" \
    drawing=on \
    label.drawing=off
else
  # VPN inactif — masquer complètement
  sketchybar --set "$NAME" \
    drawing=off
fi
