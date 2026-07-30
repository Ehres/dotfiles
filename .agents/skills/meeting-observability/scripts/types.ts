export type NormalizedEvent = {
  summary: string;
  start: string; // ISO 8601 with offset, e.g. "2026-06-01T10:00:00+02:00"
  end: string; // ISO 8601 with offset
  attendeeCount: number;
  isOrganizer: boolean;
  responseStatus: "accepted" | "tentative" | "needsAction" | "declined" | "none";
  isRecurring: boolean;
  isAllDay: boolean;
};

export type Config = {
  windowStart: string; // "YYYY-MM-DD" inclusive
  windowEnd: string; // "YYYY-MM-DD" inclusive
  workDayStartHour: number;
  workDayEndHour: number;
  lunchStartHour: number;
  lunchEndHour: number;
  choppyDayThreshold: number;
  timeZone: string;
};

export const DEFAULT_CONFIG: Omit<Config, "windowStart" | "windowEnd"> = {
  workDayStartHour: 9,
  workDayEndHour: 18,
  lunchStartHour: 12,
  lunchEndHour: 14,
  choppyDayThreshold: 4,
  timeZone: "Europe/Paris",
};

export type Metrics = {
  window: { start: string; end: string; businessDays: number; workingHours: number };
  volume: { totalMeetingHours: number; meetingCount: number; percentOfWorkingTime: number };
  size: { avgAttendees: number; estimatedCostPersonHours: number };
  timing: { outOfHoursCount: number; lunchMeetingsCount: number };
  fragmentation: { largestFocusBlockHours: number; choppyDays: number };
  recurrence: { recurringHours: number; recurringSharePercent: number };
  load: { organizerCount: number; participantCount: number; organizerHours: number; participantHours: number };
};
