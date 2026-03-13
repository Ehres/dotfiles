#!/bin/sh

# Helper: show/hide updates group bracket and spacer
# based on the drawing state of brew_updates and nvim_updates.
# Sourced by each updates plugin after updating its own state.

BREW_DRAWING=$(sketchybar --query brew_updates | jq -r '.geometry.drawing')
NVIM_DRAWING=$(sketchybar --query nvim_updates | jq -r '.geometry.drawing')

if [ "$BREW_DRAWING" = "off" ] && [ "$NVIM_DRAWING" = "off" ]; then
	sketchybar --set updates_group background.drawing=off \
		--set spacer_comm_updates drawing=off
else
	sketchybar --set updates_group background.drawing=on \
		--set spacer_comm_updates drawing=on
fi
