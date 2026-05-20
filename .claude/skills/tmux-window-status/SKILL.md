---
name: tmux-window-status
description: Update the tmux window title's suffix slot with an emoji reflecting your current activity. Use right before asking the user a clarifying question (❓), when surfacing a blocker (🚫), or after completing a task and reporting back (✅). Mechanical states (🧠 thinking, ✍️ writing, 🧪 running, ⏳ idle) are handled automatically by Claude Code hooks — do not set those yourself from this skill.
---

# tmux-window-status

Signal your current state to the user via the tmux window title's suffix slot. The user runs several Claude sessions across tmux windows; this lets them see at a glance which session needs attention.

## When to update

Only three states are this skill's responsibility — the rest are handled automatically by hooks.

| Emoji | When to set |
| --- | --- |
| ❓ | The very next thing you send is a clarifying question to the user. |
| 🚫 | You are surfacing a blocker — something prevents progress and the user needs to act. |
| ✅ | The task is complete and you have reported the result. |

Set the emoji **just before** the message that matches its meaning, so the title flips at the same moment the user sees the prompt change.

## How to update

Call the helper from Bash:

```
~/scripts/tmux-window-status set-suffix ❓
~/scripts/tmux-window-status set-suffix 🚫
~/scripts/tmux-window-status set-suffix ✅
```

The helper no-ops silently when not in tmux, so the call is always safe.

Do not announce the title change in chat — it is ambient signal, not a notification.

## Subagent guard

If you are a subagent dispatched via the Agent tool, **skip this skill entirely**. Only the top-level Claude Code session should write the window suffix. Subagents updating the title would flap it on every parent transition.

## Why no 🧠 / ✍️ / 🧪 / ⏳ here

Those states are set by Claude Code hooks in `~/.claude/settings.json` (event-driven, automatic). Setting them from this skill would duplicate the hook and waste a tool call.
