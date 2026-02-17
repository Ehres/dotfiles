#!/bin/bash

##### Reusable Property Arrays #####
item_bg=(
	background.color=$ITEM_BG
	background.corner_radius=$ITEM_CORNER_RADIUS
	background.height=$ITEM_BG_HEIGHT
)

bracket_bg=(
	"${item_bg[@]}"
	background.border_width=0
	background.drawing=on
)

separator=(
	width=$SEPARATOR_WIDTH
	padding_left=$SEPARATOR_PADDING
	padding_right=$SEPARATOR_PADDING
	icon.drawing=off
	label.drawing=off
	background.drawing=on
	background.color=$SEPARATOR_COLOR
	background.height=$SEPARATOR_HEIGHT
)
