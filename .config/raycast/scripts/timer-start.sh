#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Start Timer
# @raycast.mode silent

# Optional parameters:
# @raycast.icon 🍅
# @raycast.packageName SketchyBar Timer
# @raycast.argument1 { "type": "dropdown", "placeholder": "Duration", "data": [{"title": "60 min", "value": "60"}, {"title": "59 min", "value": "59"}, {"title": "58 min", "value": "58"}, {"title": "57 min", "value": "57"}, {"title": "56 min", "value": "56"}, {"title": "55 min", "value": "55"}, {"title": "54 min", "value": "54"}, {"title": "53 min", "value": "53"}, {"title": "52 min", "value": "52"}, {"title": "51 min", "value": "51"}, {"title": "50 min", "value": "50"}, {"title": "49 min", "value": "49"}, {"title": "48 min", "value": "48"}, {"title": "47 min", "value": "47"}, {"title": "46 min", "value": "46"}, {"title": "45 min", "value": "45"}, {"title": "44 min", "value": "44"}, {"title": "43 min", "value": "43"}, {"title": "42 min", "value": "42"}, {"title": "41 min", "value": "41"}, {"title": "40 min", "value": "40"}, {"title": "39 min", "value": "39"}, {"title": "38 min", "value": "38"}, {"title": "37 min", "value": "37"}, {"title": "36 min", "value": "36"}, {"title": "35 min", "value": "35"}, {"title": "34 min", "value": "34"}, {"title": "33 min", "value": "33"}, {"title": "32 min", "value": "32"}, {"title": "31 min", "value": "31"}, {"title": "30 min", "value": "30"}, {"title": "29 min", "value": "29"}, {"title": "28 min", "value": "28"}, {"title": "27 min", "value": "27"}, {"title": "26 min", "value": "26"}, {"title": "25 min", "value": "25"}, {"title": "24 min", "value": "24"}, {"title": "23 min", "value": "23"}, {"title": "22 min", "value": "22"}, {"title": "21 min", "value": "21"}, {"title": "20 min", "value": "20"}, {"title": "19 min", "value": "19"}, {"title": "18 min", "value": "18"}, {"title": "17 min", "value": "17"}, {"title": "16 min", "value": "16"}, {"title": "15 min", "value": "15"}, {"title": "14 min", "value": "14"}, {"title": "13 min", "value": "13"}, {"title": "12 min", "value": "12"}, {"title": "11 min", "value": "11"}, {"title": "10 min", "value": "10"}, {"title": "9 min", "value": "9"}, {"title": "8 min", "value": "8"}, {"title": "7 min", "value": "7"}, {"title": "6 min", "value": "6"}, {"title": "5 min", "value": "5"}, {"title": "4 min", "value": "4"}, {"title": "3 min", "value": "3"}, {"title": "2 min", "value": "2"}, {"title": "1 min", "value": "1"}] }

~/.config/sketchybar/plugins/timer_ctl.sh start "$1"
