import type { Config, Metrics, NormalizedEvent } from "./types.ts";
import { businessDayList, clamp, durationHours, localDate, localHourDecimal, round } from "./calendar-math.ts";

function isCounted(e: NormalizedEvent): boolean {
  return !e.isAllDay && e.responseStatus !== "declined";
}

function computeFragmentation(
  events: NormalizedEvent[],
  config: Config,
): { largestFocusBlockHours: number; choppyDays: number } {
  const byDay = new Map<string, NormalizedEvent[]>();
  for (const e of events) {
    const day = localDate(e.start, config.timeZone);
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }

  let largestFocusBlockHours = 0;
  let choppyDays = 0;

  for (const day of businessDayList(config.windowStart, config.windowEnd)) {
    const dayEvents = byDay.get(day) ?? [];
    if (dayEvents.length >= config.choppyDayThreshold) choppyDays++;

    const intervals = dayEvents
      .map((e) => ({
        s: clamp(localHourDecimal(e.start, config.timeZone), config.workDayStartHour, config.workDayEndHour),
        e: clamp(localHourDecimal(e.end, config.timeZone), config.workDayStartHour, config.workDayEndHour),
      }))
      .filter((i) => i.e > i.s)
      .sort((a, b) => a.s - b.s);

    let cursor = config.workDayStartHour;
    let maxGap = 0;
    for (const iv of intervals) {
      if (iv.s > cursor) maxGap = Math.max(maxGap, iv.s - cursor);
      cursor = Math.max(cursor, iv.e);
    }
    maxGap = Math.max(maxGap, config.workDayEndHour - cursor);
    largestFocusBlockHours = Math.max(largestFocusBlockHours, maxGap);
  }

  return { largestFocusBlockHours, choppyDays };
}

export function computeMetrics(events: NormalizedEvent[], config: Config): Metrics {
  const counted = events.filter(isCounted);
  const businessDays = businessDayList(config.windowStart, config.windowEnd).length;
  const workingHours = businessDays * (config.workDayEndHour - config.workDayStartHour);

  let totalMeetingHours = 0;
  let costPersonHours = 0;
  let attendeesSum = 0;
  let outOfHoursCount = 0;
  let lunchMeetingsCount = 0;
  let recurringHours = 0;
  let organizerCount = 0;
  let organizerHours = 0;

  for (const e of counted) {
    const dur = durationHours(e);
    const startH = localHourDecimal(e.start, config.timeZone);
    const endH = localHourDecimal(e.end, config.timeZone);

    totalMeetingHours += dur;
    costPersonHours += dur * e.attendeeCount;
    attendeesSum += e.attendeeCount;

    if (startH < config.workDayStartHour || endH > config.workDayEndHour || endH <= startH) {
      outOfHoursCount++;
    }
    if (startH < config.lunchEndHour && endH > config.lunchStartHour) {
      lunchMeetingsCount++;
    }
    if (e.isRecurring) recurringHours += dur;
    if (e.isOrganizer) {
      organizerCount++;
      organizerHours += dur;
    }
  }

  const meetingCount = counted.length;
  const fragmentation = computeFragmentation(counted, config);

  return {
    window: { start: config.windowStart, end: config.windowEnd, businessDays, workingHours: round(workingHours) },
    volume: {
      totalMeetingHours: round(totalMeetingHours),
      meetingCount,
      percentOfWorkingTime: workingHours > 0 ? round((totalMeetingHours / workingHours) * 100) : 0,
    },
    size: {
      avgAttendees: meetingCount > 0 ? round(attendeesSum / meetingCount) : 0,
      estimatedCostPersonHours: round(costPersonHours),
    },
    timing: { outOfHoursCount, lunchMeetingsCount },
    fragmentation: {
      largestFocusBlockHours: round(fragmentation.largestFocusBlockHours),
      choppyDays: fragmentation.choppyDays,
    },
    recurrence: {
      recurringHours: round(recurringHours),
      recurringSharePercent: totalMeetingHours > 0 ? round((recurringHours / totalMeetingHours) * 100) : 0,
    },
    load: {
      organizerCount,
      participantCount: meetingCount - organizerCount,
      organizerHours: round(organizerHours),
      participantHours: round(totalMeetingHours - organizerHours),
    },
  };
}
