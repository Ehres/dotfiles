import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReport } from "./format-report.ts";
import type { Metrics } from "./types.ts";

const metrics: Metrics = {
  window: { start: "2026-06-01", end: "2026-06-05", businessDays: 5, workingHours: 45 },
  volume: { totalMeetingHours: 2, meetingCount: 3, percentOfWorkingTime: 4.4 },
  size: { avgAttendees: 3.3, estimatedCostPersonHours: 6.5 },
  timing: { outOfHoursCount: 1, lunchMeetingsCount: 1 },
  fragmentation: { largestFocusBlockHours: 9, choppyDays: 0 },
  recurrence: { recurringHours: 0.5, recurringSharePercent: 25 },
  load: { organizerCount: 1, participantCount: 2, organizerHours: 1, participantHours: 1 },
};

test("formatReport renders a headline and every section", () => {
  const report = formatReport(metrics);
  assert.match(report, /# Meeting report — 2026-06-01 → 2026-06-05/);
  assert.match(report, /\*\*2h in meetings across 3 meetings — 4\.4% of your working time/);
  assert.match(report, /## Time & volume/);
  assert.match(report, /## Size & cost/);
  assert.match(report, /## Timing/);
  assert.match(report, /## Fragmentation/);
  assert.match(report, /## Recurrence/);
  assert.match(report, /## Load/);
  assert.match(report, /Estimated cost: 6\.5 person-hours/);
});
