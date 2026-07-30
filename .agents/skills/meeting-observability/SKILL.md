---
name: meeting-observability
description: Quantify how much time you spend in meetings from your Google Calendar. Reads calendar metadata over a window (default last 4 weeks) via the Google Calendar MCP and prints a textual report — total time, share of working time, size/cost, timing, fragmentation, recurrence, organizer vs participant load. Use when asked to analyze meeting load, meeting time, or calendar usage.
---

# Meeting Observability

Produce a quantitative report of the user's own meeting load. Metadata only — never read or store meeting descriptions/bodies as content.

## Steps

1. **Resolve the window.** Default: the last 4 weeks ending today. If the user gave a range or a phrase like "last week"/"last 4 weeks", use that. Express as `windowStart` and `windowEnd` (`YYYY-MM-DD`, inclusive).

2. **Find the primary calendar and its timezone.** Call `mcp__claude_ai_Google_Calendar__list_calendars`. Use the calendar marked primary; note its `timeZone`.

3. **Fetch events.** Call `mcp__claude_ai_Google_Calendar__list_events` for the primary calendar between `windowStart` and `windowEnd` (single events expanded, not recurring masters, if the tool supports it).

4. **Normalize each event** to this exact shape (skip cancelled events):
   - `summary`: event title (used only for your own reference; not required to be accurate).
   - `start` / `end`: ISO 8601 with offset. If the event only has a date (no time), set `isAllDay: true` and use `T00:00:00` + the calendar offset.
   - `attendeeCount`: number of attendees; if none listed, `1`.
   - `isOrganizer`: `true` if the organizer is the user (`organizer.self === true`).
   - `responseStatus`: the user's own attendee `responseStatus` (`accepted` | `tentative` | `needsAction` | `declined`); if the user is not in the attendee list, `"none"`.
   - `isRecurring`: `true` if the event has a `recurringEventId`.
   - `isAllDay`: `true` if the event has a date but no dateTime.

5. **Write two files to a scratch directory** (use your session scratchpad dir):
   - `events.json`: the JSON array of normalized events.
   - `config.json`: `{ "windowStart": "...", "windowEnd": "...", "timeZone": "<primary calendar timeZone>" }`. Add `workDayStartHour`, `workDayEndHour`, `lunchStartHour`, `lunchEndHour`, or `choppyDayThreshold` only if the user asked to override the defaults (9–18, 12–14, threshold 4).

6. **Run the report:**
   ```bash
   node ~/.claude/skills/meeting-observability/scripts/run.ts <scratch>/events.json <scratch>/config.json
   ```
   If Node's type stripping errors, retry with `npx tsx` instead of `node`.

7. **Relay the script's Markdown output** to the user. Optionally add 2–3 salient observations drawn ONLY from the numbers (e.g. "31% of your meetings are recurring", "your largest free block is only 1.5h") — no usefulness judgement.

## Notes

- All computation is deterministic and lives in `scripts/`. Do not compute metrics yourself; always run the script so the numbers are exact.
- Timezone/day-boundary handling uses the primary calendar's timezone. Events near midnight may bucket to an adjacent day — acceptable for this report.
