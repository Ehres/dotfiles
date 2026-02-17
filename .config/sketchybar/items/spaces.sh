#!/bin/bash

##### Left Side — Per-Display Space Brackets #####
# Two complete item pools (one per display), created once.
# Controller updates content dynamically with --set only.
# Layout per display: [before.1..9] spacer [active - App] spacer [after.1..9]
#
# display=N pins each item to its monitor. On a given display, items
# assigned to the other display are invisible and take no space.
# When only 1 display exists, all d2_* items are hidden by the controller.

MAX_POOL=9

for D in 1 2; do
	P="d${D}" # prefix

	# ── Before-active pool (9 slots) ──
	before_members=()
	for i in $(seq 1 $MAX_POOL); do
		sketchybar --add item "${P}_before.${i}" left \
			--set "${P}_before.${i}" \
			display=$D \
			icon="$i" \
			icon.padding_left=$SPACE_ICON_PADDING \
			icon.padding_right=$SPACE_ICON_PADDING \
			label.drawing=off \
			drawing=off
		before_members+=("${P}_before.${i}")
	done

	sketchybar --add bracket "${P}_bracket_before" "${before_members[@]}" \
		--set "${P}_bracket_before" "${bracket_bg[@]}" background.drawing=off

	# ── Spacer: before → active ──
	sketchybar --add item "${P}_spacer_before" left \
		--set "${P}_spacer_before" \
		display=$D \
		width=$SPACE_BRACKET_SPACER_WIDTH \
		padding_left=$SPACER_PADDING \
		padding_right=$SPACER_PADDING \
		icon.drawing=off \
		label.drawing=off \
		background.drawing=off \
		drawing=off

	# ── Active space ──
	sketchybar --add item "${P}_active" left \
		--set "${P}_active" \
		display=$D \
		icon="1" \
		icon.padding_left=$SPACE_ICON_PADDING \
		icon.padding_right=$SPACE_ICON_PADDING \
		label="" \
		label.drawing=off \
		label.padding_left=$SPACE_ACTIVE_LABEL_PADDING_LEFT \
		label.padding_right=$SPACE_ACTIVE_LABEL_PADDING_RIGHT

	sketchybar --add bracket "${P}_bracket_active" "${P}_active" \
		--set "${P}_bracket_active" "${bracket_bg[@]}"

	# ── Spacer: active → after ──
	sketchybar --add item "${P}_spacer_after" left \
		--set "${P}_spacer_after" \
		display=$D \
		width=$SPACE_BRACKET_SPACER_WIDTH \
		padding_left=$SPACER_PADDING \
		padding_right=$SPACER_PADDING \
		icon.drawing=off \
		label.drawing=off \
		background.drawing=off \
		drawing=off

	# ── After-active pool (9 slots) ──
	after_members=()
	for i in $(seq 1 $MAX_POOL); do
		sketchybar --add item "${P}_after.${i}" left \
			--set "${P}_after.${i}" \
			display=$D \
			icon="$i" \
			icon.padding_left=$SPACE_ICON_PADDING \
			icon.padding_right=$SPACE_ICON_PADDING \
			label.drawing=off \
			drawing=off
		after_members+=("${P}_after.${i}")
	done

	sketchybar --add bracket "${P}_bracket_after" "${after_members[@]}" \
		--set "${P}_bracket_after" "${bracket_bg[@]}" background.drawing=off
done

# Controller (hidden, subscribes to events)
sketchybar --add item space_controller left \
	--set space_controller \
	drawing=off \
	width=0 \
	padding_left=0 \
	padding_right=0 \
	script="$PLUGIN_DIR/space_controller.sh" \
	--subscribe space_controller space_change front_app_switched display_change
