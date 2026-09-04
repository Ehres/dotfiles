#!/bin/bash

# ┌─────────────────────────────────────────────────┐
# │  Space Controller — Multi-Display                │
# │  Manages 2 × 3 static brackets on the left:      │
# │    Display N: [before] [active - App] [after]    │
# │  Each display shows only its own spaces.          │
# │  Uses only --set commands (no --remove/--add).   │
# │  Triggers: space_change, front_app_switched,     │
# │            display_change                        │
# └─────────────────────────────────────────────────┘
# shellcheck disable=SC1091
# shellcheck source=../colors/components.sh
source "$CONFIG_DIR/colors/components.sh"
# shellcheck disable=SC1091
# shellcheck source=../spacing/components.sh
source "$CONFIG_DIR/spacing/components.sh"

pgrep -x yabai > /dev/null 2>&1 && YABAI_RUNNING=true || YABAI_RUNNING=false

MAX_POOL=9
MAX_DISPLAY=2

# ── Detect display count ────────────────────────────────────────────
DISPLAY_COUNT=$(yabai -m query --displays 2>/dev/null | jq 'length')
if [ -z "$DISPLAY_COUNT" ] || [ "$DISPLAY_COUNT" = "null" ] || [ "$DISPLAY_COUNT" -lt 1 ]; then
	DISPLAY_COUNT=1
fi
if [ "$DISPLAY_COUNT" -gt "$MAX_DISPLAY" ]; then
	DISPLAY_COUNT=$MAX_DISPLAY
fi

# ── Build a single batched --set command ────────────────────────────
args=()

for D in $(seq 1 $MAX_DISPLAY); do
	P="d${D}"

	# ── Display doesn't exist → hide everything ────────────────
	if [ "$D" -gt "$DISPLAY_COUNT" ]; then
		for i in $(seq 1 $MAX_POOL); do
			args+=(--set "${P}_before.${i}" drawing=off)
			args+=(--set "${P}_after.${i}" drawing=off)
		done
		args+=(--set "${P}_spacer_before" drawing=off)
		args+=(--set "${P}_active" drawing=off)
		args+=(--set "${P}_spacer_after" drawing=off)
		args+=(--set "${P}_bracket_before" background.drawing=off)
		args+=(--set "${P}_bracket_active" background.drawing=off)
		args+=(--set "${P}_bracket_after" background.drawing=off)
		continue
	fi

	# ── Query spaces on this display ───────────────────────────
	SPACES_JSON=$(yabai -m query --spaces --display "$D" 2>/dev/null)
	if [ -z "$SPACES_JSON" ] || [ "$SPACES_JSON" = "null" ]; then
		SPACES_JSON='[{"index":1,"has-focus":true,"is-visible":true}]'
	fi

	SPACE_INDICES=()
	while IFS= read -r SPACE_INDEX; do
		SPACE_INDICES+=("$SPACE_INDEX")
	done < <(printf '%s\n' "$SPACES_JSON" | jq -r '.[].index')
	TOTAL=${#SPACE_INDICES[@]}

	# Visible space on this display (one per display, always exists)
	ACTIVE=$(echo "$SPACES_JSON" | jq -r '.[] | select(."is-visible" == true) | .index')
	if [ -z "$ACTIVE" ] || [ "$ACTIVE" = "null" ]; then
		ACTIVE=$(echo "$SPACES_JSON" | jq -r '.[] | select(."has-focus" == true) | .index')
	fi
	if [ -z "$ACTIVE" ] || [ "$ACTIVE" = "null" ]; then
		ACTIVE="${SPACE_INDICES[0]}"
	fi

	# Does this display have the globally focused space?
	HAS_FOCUS=$(echo "$SPACES_JSON" | jq '[.[] | select(."has-focus" == true)] | length')

	# Position of visible space within display's space list
	ACTIVE_POS=0
	for i in "${!SPACE_INDICES[@]}"; do
		if [ "${SPACE_INDICES[$i]}" -eq "$ACTIVE" ]; then
			ACTIVE_POS=$i
			break
		fi
	done

	# ── Resolve front app for this display ─────────────────────
	APP=""
	if [ "$HAS_FOCUS" -gt 0 ]; then
		# Focused display: use event payload or query focused window
		if [ "$SENDER" = "front_app_switched" ]; then
			APP="$INFO"
		else
			APP=$(yabai -m query --windows --window 2>/dev/null | jq -r '.app // empty' 2>/dev/null)
		fi
	else
		# Non-focused display: find the topmost non-minimized window
		# on the visible space (most recently focused on that display)
		APP=$(yabai -m query --windows --space "$ACTIVE" 2>/dev/null |
			jq -r '[.[] | select(."is-minimized" == false and ."is-hidden" == false)] | first | .app // empty' 2>/dev/null)
	fi

	# ── Before pool ────────────────────────────────────────────
	BEFORE_COUNT=$ACTIVE_POS
	slot=1
	if [ "$BEFORE_COUNT" -gt 0 ]; then
		for ((i = 0; i < BEFORE_COUNT; i++)); do
			sid="${SPACE_INDICES[$i]}"
			args+=(--set "${P}_before.${slot}" icon="$sid" drawing=on
				"click_script=yabai -m space --focus $sid")
			slot=$((slot + 1))
		done
	fi
	if [ "$BEFORE_COUNT" -lt "$MAX_POOL" ]; then
		for ((slot = BEFORE_COUNT + 1; slot <= MAX_POOL; slot++)); do
			args+=(--set "${P}_before.${slot}" drawing=off)
		done
	fi

	# Before bracket + spacer visibility
	if [ "$BEFORE_COUNT" -gt 0 ]; then
		args+=(--set "${P}_bracket_before" background.drawing=on)
		args+=(--set "${P}_spacer_before" drawing=on)
	else
		args+=(--set "${P}_bracket_before" background.drawing=off)
		args+=(--set "${P}_spacer_before" drawing=off)
	fi

	# ── Active space ───────────────────────────────────────────
	args+=(--set "${P}_active" icon="$ACTIVE" drawing=on
		"click_script=yabai -m space --focus $ACTIVE")

	if [ -n "$APP" ]; then
		args+=(--set "${P}_active" label="- $APP" label.drawing=on)
	else
		args+=(--set "${P}_active" label.drawing=off)
	fi

	args+=(--set "${P}_bracket_active" background.drawing=on)

	# ── After pool ─────────────────────────────────────────────
	AFTER_START=$((ACTIVE_POS + 1))
	AFTER_COUNT=$((TOTAL - AFTER_START))
	slot=1
	if [ "$AFTER_COUNT" -gt 0 ]; then
		for ((i = AFTER_START; i < TOTAL; i++)); do
			sid="${SPACE_INDICES[$i]}"
			args+=(--set "${P}_after.${slot}" icon="$sid" drawing=on
				"click_script=yabai -m space --focus $sid")
			slot=$((slot + 1))
		done
	fi
	if [ "$AFTER_COUNT" -lt "$MAX_POOL" ]; then
		for ((slot = AFTER_COUNT + 1; slot <= MAX_POOL; slot++)); do
			args+=(--set "${P}_after.${slot}" drawing=off)
		done
	fi

	# After bracket + spacer visibility
	if [ "$AFTER_COUNT" -gt 0 ]; then
		args+=(--set "${P}_bracket_after" background.drawing=on)
		args+=(--set "${P}_spacer_after" drawing=on)
	else
		args+=(--set "${P}_bracket_after" background.drawing=off)
		args+=(--set "${P}_spacer_after" drawing=off)
	fi
done

# ── Apply yabai state: dim spaces ───────────────────────────────────
if [ "$YABAI_RUNNING" = false ]; then
	for D in $(seq 1 $MAX_DISPLAY); do
		P="d${D}"
		for i in $(seq 1 $MAX_POOL); do
			args+=(--set "${P}_before.${i}" icon.color="$STATUS_INACTIVE" label.color="$STATUS_INACTIVE")
			args+=(--set "${P}_after.${i}" icon.color="$STATUS_INACTIVE" label.color="$STATUS_INACTIVE")
		done
		args+=(--set "${P}_active" icon.color="$STATUS_INACTIVE" label.color="$STATUS_INACTIVE" label.drawing=off)
	done
else
	for D in $(seq 1 $MAX_DISPLAY); do
		P="d${D}"
		for i in $(seq 1 $MAX_POOL); do
			args+=(--set "${P}_before.${i}" icon.color="$ICON_DEFAULT" label.color="$LABEL_DEFAULT")
			args+=(--set "${P}_after.${i}" icon.color="$ICON_DEFAULT" label.color="$LABEL_DEFAULT")
		done
		args+=(--set "${P}_active" icon.color="$ICON_DEFAULT" label.color="$LABEL_DEFAULT")
	done
fi

# ── Execute atomically (single render pass, zero glitch) ───────────
sketchybar "${args[@]}"
