import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics } from "./compute-metrics.ts";
import type { Config, NormalizedEvent } from "./types.ts";

const config: Config = {
  windowStart: "2026-06-01",
  windowEnd: "2026-06-05",
  workDayStartHour: 9,
  workDayEndHour: 18,
  lunchStartHour: 12,
  lunchEndHour: 14,
  choppyDayThreshold: 4,
  timeZone: "Europe/Paris",
};

const events: NormalizedEvent[] = [
  // A: Mon 10:00-11:00, organizer, 3 attendees
  { summary: "A", start: "2026-06-01T10:00:00+02:00", end: "2026-06-01T11:00:00+02:00", attendeeCount: 3, isOrganizer: true, responseStatus: "accepted", isRecurring: false, isAllDay: false },
  // B: Mon 12:30-13:00, recurring, lunch, 5 attendees
  { summary: "B", start: "2026-06-01T12:30:00+02:00", end: "2026-06-01T13:00:00+02:00", attendeeCount: 5, isOrganizer: false, responseStatus: "accepted", isRecurring: true, isAllDay: false },
  // C: Tue 08:00-08:30, out-of-hours, 2 attendees
  { summary: "C", start: "2026-06-02T08:00:00+02:00", end: "2026-06-02T08:30:00+02:00", attendeeCount: 2, isOrganizer: false, responseStatus: "accepted", isRecurring: false, isAllDay: false },
  // D: declined -> excluded
  { summary: "D", start: "2026-06-03T10:00:00+02:00", end: "2026-06-03T11:00:00+02:00", attendeeCount: 4, isOrganizer: false, responseStatus: "declined", isRecurring: false, isAllDay: false },
  // E: all-day -> excluded
  { summary: "E", start: "2026-06-04T00:00:00+02:00", end: "2026-06-05T00:00:00+02:00", attendeeCount: 10, isOrganizer: false, responseStatus: "accepted", isRecurring: false, isAllDay: true },
];

test("computeMetrics aggregates volume, size, timing, recurrence and load", () => {
  const m = computeMetrics(events, config);

  assert.deepEqual(m.window, { start: "2026-06-01", end: "2026-06-05", businessDays: 5, workingHours: 45 });
  assert.deepEqual(m.volume, { totalMeetingHours: 2, meetingCount: 3, percentOfWorkingTime: 4.4 });
  assert.deepEqual(m.size, { avgAttendees: 3.3, estimatedCostPersonHours: 6.5 });
  assert.deepEqual(m.timing, { outOfHoursCount: 1, lunchMeetingsCount: 1 });
  assert.deepEqual(m.recurrence, { recurringHours: 0.5, recurringSharePercent: 25 });
  assert.deepEqual(m.load, { organizerCount: 1, participantCount: 2, organizerHours: 1, participantHours: 1 });
});

test("computeMetrics reports the largest free block and no choppy days for this fixture", () => {
  const m = computeMetrics(events, config);
  // Tue/Wed/Thu/Fri have no counted timed meetings -> a full 9h working day is free.
  assert.equal(m.fragmentation.largestFocusBlockHours, 9);
  assert.equal(m.fragmentation.choppyDays, 0);
});

test("computeMetrics handles an empty calendar without dividing by zero", () => {
  const m = computeMetrics([], config);
  assert.equal(m.volume.totalMeetingHours, 0);
  assert.equal(m.volume.percentOfWorkingTime, 0);
  assert.equal(m.size.avgAttendees, 0);
  assert.equal(m.recurrence.recurringSharePercent, 0);
  assert.equal(m.fragmentation.largestFocusBlockHours, 9);
});
