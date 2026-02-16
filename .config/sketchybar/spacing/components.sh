#!/bin/bash

# ┌─────────────────────────────────────────────┐
# │  Component Tokens — SketchyBar               │
# │  Maps UI elements to semantic tokens          │
# └─────────────────────────────────────────────┘

source "${BASH_SOURCE[0]%/*}/semantic.sh"

# Bar
export BAR_HEIGHT=$HEIGHT_BAR

# Item defaults
export DEFAULT_PADDING=$PADDING_DEFAULT
export DEFAULT_ICON_PADDING=$PADDING_DEFAULT
export DEFAULT_LABEL_PADDING=$PADDING_DEFAULT

# Standalone item icon padding (headphones)
export STANDALONE_ICON_PADDING=$PADDING_RELAXED

# System group (clock, battery, volume) — bookend pattern
export SYSTEM_ITEM_PADDING=$GAP_NONE
export SYSTEM_ICON_PADDING=$PADDING_DEFAULT
export SYSTEM_FIRST_ICON_PADDING=$PADDING_RELAXED
export SYSTEM_LAST_LABEL_PADDING=$PADDING_RELAXED

# Item background shape
export ITEM_CORNER_RADIUS=$RADIUS_DEFAULT
export ITEM_BG_HEIGHT=$HEIGHT_ITEM

# Space indicators
export SPACE_ICON_PADDING=$PADDING_RELAXED

# Spacer between groups
export SPACER_WIDTH=$GAP_DEFAULT
export SPACER_PADDING=$GAP_NONE

# Active space indicator (label shows "- AppName")
export SPACE_ACTIVE_LABEL_PADDING_LEFT=$PADDING_TIGHT
export SPACE_ACTIVE_LABEL_PADDING_RIGHT=$PADDING_RELAXED
export SPACE_BRACKET_SPACER_WIDTH=$SPACER_WIDTH

# Separator inside brackets
export SEPARATOR_WIDTH=$WIDTH_SEPARATOR
export SEPARATOR_HEIGHT=$HEIGHT_ITEM
export SEPARATOR_PADDING=$GAP_NONE

# Network group
export NETWORK_ICON_PADDING=$PADDING_RELAXED
export NETWORK_VPN_PADDING_LEFT=$PADDING_DEFAULT
export NETWORK_VPN_PADDING_RIGHT=$PADDING_RELAXED

# Communication group — item padding
export COMM_ITEM_PADDING=$GAP_NONE

# Communication group — icon padding
export COMM_ICON_PADDING=$PADDING_DEFAULT
export COMM_FIRST_ICON_PADDING=$PADDING_RELAXED

# Communication group — label padding
export COMM_LABEL_PADDING_LEFT=$PADDING_TIGHT
export COMM_LABEL_PADDING_RIGHT=$PADDING_DEFAULT
export COMM_LAST_LABEL_PADDING=$PADDING_RELAXED
