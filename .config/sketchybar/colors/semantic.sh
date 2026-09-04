#!/bin/bash

# ┌─────────────────────────────────────────────┐
# │  Semantic Tokens                              │
# │  Maps meaning to palette primitives           │
# └─────────────────────────────────────────────┘

source "${BASH_SOURCE[0]%/*}/palette.sh"

# Status
export STATUS_OK=$GREEN
export STATUS_WARNING=$YELLOW
export STATUS_ERROR=$RED
export STATUS_INFO=$SKY
export STATUS_INACTIVE=$OVERLAY0

# Connectivity
export CONNECTED=$GREEN
export VPN_ACTIVE=$SKY
export DISCONNECTED=$OVERLAY0

# Yabai modes — categorical accents, not severity states
export MODE_RESIZE=$SAPPHIRE
export MODE_ARRANGE=$MAUVE
export MODE_MOVE=$PEACH
export MODE_APP=$LAVENDER
export MODE_LAYOUT=$TEAL
export MODE_OFF=$SUBTEXT1
