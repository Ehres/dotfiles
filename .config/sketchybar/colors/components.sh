#!/bin/bash

# ┌─────────────────────────────────────────────┐
# │  Component Tokens — SketchyBar               │
# │  Maps UI elements to semantic tokens          │
# └─────────────────────────────────────────────┘

source "${BASH_SOURCE[0]%/*}/semantic.sh"

# Bar
export BAR_BG=$TRANSPARENT

# Item defaults
export ICON_DEFAULT=$TEXT
export LABEL_DEFAULT=$TEXT

# Item background (25% white overlay — composite, not a Catppuccin primitive)
export ITEM_BG=0x40ffffff

# Space indicators
export SPACE_BG=$ITEM_BG

# Status icons (mail, messages, slack, battery, etc.)
export ICON_OK=$STATUS_OK
export ICON_WARNING=$STATUS_WARNING
export ICON_ERROR=$STATUS_ERROR

# Network
export ICON_CONNECTED=$CONNECTED
export ICON_VPN=$VPN_ACTIVE
export ICON_DISCONNECTED=$DISCONNECTED
