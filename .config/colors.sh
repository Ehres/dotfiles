#!/bin/bash

# Color definitions for sketchybar
# Format: 0xAARRGGBB (AA=alpha, RR=red, GG=green, BB=blue)

# Primary colors
export WHITE=0xffffffff
export BLACK=0xff000000

# Status colors
export BLUE=0xff8aadf4   # Connected state
export CYAN=0xff91d7e3   # VPN state
export GREEN=0xffa6da95  # Download traffic
export YELLOW=0xffeed49f # Upload traffic
export RED=0xffed8796    # Weak/error state
export GRAY=0xff6e738d   # Disconnected/inactive state

# Background colors
export BACKGROUND=0x40000000
export HIGHLIGHT=0x40ffffff

# Border colors for bracket (with full opacity for visibility)
export BORDER_CONNECTED=0xff8aadf4    # Blue border for WiFi connected
export BORDER_VPN=0xff91d7e3          # Cyan border for VPN
export BORDER_DISCONNECTED=0xff6e738d # Gray border for not connected
export BRACKET_BG=0x40000000          # Dark semi-transparent background
