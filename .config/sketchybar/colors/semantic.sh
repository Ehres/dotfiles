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
