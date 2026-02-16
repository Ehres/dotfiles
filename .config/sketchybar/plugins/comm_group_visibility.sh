#!/bin/sh

# Helper: show/hide communication group bracket, spacer and separators
# based on the drawing state of mail, messages, and slack items.
# Sourced by each communication plugin after updating its own state.

MAIL_DRAWING=$(sketchybar --query mail | jq -r '.geometry.drawing')
MESSAGES_DRAWING=$(sketchybar --query messages | jq -r '.geometry.drawing')
SLACK_DRAWING=$(sketchybar --query slack | jq -r '.geometry.drawing')

# Separator visibility rules:
# sep_mail_messages: on if mail=on AND (messages=on OR slack=on)
# sep_messages_slack: on if messages=on AND slack=on
if [ "$MAIL_DRAWING" = "on" ] && { [ "$MESSAGES_DRAWING" = "on" ] || [ "$SLACK_DRAWING" = "on" ]; }; then
	SEP_MAIL_MESSAGES="on"
else
	SEP_MAIL_MESSAGES="off"
fi

if [ "$MESSAGES_DRAWING" = "on" ] && [ "$SLACK_DRAWING" = "on" ]; then
	SEP_MESSAGES_SLACK="on"
else
	SEP_MESSAGES_SLACK="off"
fi

if [ "$MAIL_DRAWING" = "off" ] && [ "$MESSAGES_DRAWING" = "off" ] && [ "$SLACK_DRAWING" = "off" ]; then
	sketchybar --set communication_group background.drawing=off \
		--set spacer_network_comm drawing=off \
		--set sep_mail_messages drawing=off \
		--set sep_messages_slack drawing=off
else
	sketchybar --set communication_group background.drawing=on \
		--set spacer_network_comm drawing=on \
		--set sep_mail_messages drawing="$SEP_MAIL_MESSAGES" \
		--set sep_messages_slack drawing="$SEP_MESSAGES_SLACK"
fi
