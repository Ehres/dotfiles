#!/bin/bash
# shellcheck source=colors/components.sh
# shellcheck source=spacing/components.sh

##### Reusable Property Arrays #####
item_bg=(
	"background.color=$ITEM_BG"
	"background.corner_radius=$ITEM_CORNER_RADIUS"
	"background.height=$ITEM_BG_HEIGHT"
)

export bracket_bg=(
	"${item_bg[@]}"
	background.border_width=0
	background.drawing=on
)
