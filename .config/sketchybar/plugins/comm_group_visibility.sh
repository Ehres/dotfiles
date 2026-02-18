#!/bin/sh

# Helper: show/hide communication group bracket and spacer
# based on the drawing state of mail, messages, and slack items.
# Sourced by each communication plugin after updating its own state.

MAIL_DRAWING=$(sketchybar --query mail | jq -r '.geometry.drawing')
MESSAGES_DRAWING=$(sketchybar --query messages | jq -r '.geometry.drawing')
SLACK_DRAWING=$(sketchybar --query slack | jq -r '.geometry.drawing')

if [ "$MAIL_DRAWING" = "off" ] && [ "$MESSAGES_DRAWING" = "off" ] && [ "$SLACK_DRAWING" = "off" ]; then
	sketchybar --set communication_group background.drawing=off \
		--set spacer_network_comm drawing=off
else
	sketchybar --set communication_group background.drawing=on \
		--set spacer_network_comm drawing=on
fi
