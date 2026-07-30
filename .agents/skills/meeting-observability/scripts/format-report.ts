import type { Metrics } from "./types.ts";

export function formatReport(m: Metrics): string {
  return [
    `# Meeting report — ${m.window.start} → ${m.window.end}`,
    "",
    `**${m.volume.totalMeetingHours}h in meetings across ${m.volume.meetingCount} meetings — ${m.volume.percentOfWorkingTime}% of your working time (${m.window.businessDays} business days).**`,
    "",
    "## Time & volume",
    `- Total meeting time: ${m.volume.totalMeetingHours}h`,
    `- Meetings: ${m.volume.meetingCount}`,
    `- Share of working time: ${m.volume.percentOfWorkingTime}% (of ${m.window.workingHours}h available)`,
    "",
    "## Size & cost",
    `- Average attendees: ${m.size.avgAttendees}`,
    `- Estimated cost: ${m.size.estimatedCostPersonHours} person-hours`,
    "",
    "## Timing",
    `- Out-of-hours meetings: ${m.timing.outOfHoursCount}`,
    `- Lunch-time meetings: ${m.timing.lunchMeetingsCount}`,
    "",
    "## Fragmentation",
    `- Largest free/focus block in a working day: ${m.fragmentation.largestFocusBlockHours}h`,
    `- Choppy days: ${m.fragmentation.choppyDays}`,
    "",
    "## Recurrence",
    `- Time in recurring meetings: ${m.recurrence.recurringHours}h (${m.recurrence.recurringSharePercent}%)`,
    "",
    "## Load",
    `- As organizer: ${m.load.organizerCount} meetings, ${m.load.organizerHours}h`,
    `- As participant: ${m.load.participantCount} meetings, ${m.load.participantHours}h`,
  ].join("\n");
}
