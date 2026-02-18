#!/bin/sh

# timer_ctl.sh — Start, stop, or toggle the SketchyBar timer
# Usage: timer_ctl.sh start [minutes]   (default: 25)
#        timer_ctl.sh stop
#        timer_ctl.sh toggle [minutes]  (default: 25)

for p in /opt/homebrew/bin /usr/local/bin; do
	case ":$PATH:" in
	*":$p:"*) ;;
	*) PATH="$p:$PATH" ;;
	esac
done

TIMER_FILE="/tmp/sketchybar_timer"
DONE_FILE="/tmp/sketchybar_timer_done"
ALARM_PID_FILE="/tmp/sketchybar_timer_alarm_pid"
DEFAULT_MINUTES=25

kill_alarm() {
	if [ -f "$ALARM_PID_FILE" ]; then
		ALARM_PID=$(cat "$ALARM_PID_FILE")
		pkill -P "$ALARM_PID" 2>/dev/null
		kill "$ALARM_PID" 2>/dev/null
		rm -f "$ALARM_PID_FILE"
	fi
}

case "$1" in
start)
	rm -f "$DONE_FILE"
	MINUTES="${2:-$DEFAULT_MINUTES}"
	END_EPOCH=$(($(date +%s) + MINUTES * 60))
	echo "$END_EPOCH" >"$TIMER_FILE"
	sketchybar --trigger timer_update
	;;
stop)
	kill_alarm
	rm -f "$TIMER_FILE" "$DONE_FILE"
	sketchybar --trigger timer_update
	;;
toggle)
	if [ -f "$TIMER_FILE" ] || [ -f "$DONE_FILE" ]; then
		kill_alarm
		rm -f "$TIMER_FILE" "$DONE_FILE"
	else
		MINUTES="${2:-$DEFAULT_MINUTES}"
		END_EPOCH=$(($(date +%s) + MINUTES * 60))
		echo "$END_EPOCH" >"$TIMER_FILE"
	fi
	sketchybar --trigger timer_update
	;;
*)
	echo "Usage: $0 {start [minutes]|stop|toggle [minutes]}"
	exit 1
	;;
esac
