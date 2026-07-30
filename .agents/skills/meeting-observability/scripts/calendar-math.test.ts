import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDayList, durationHours, localDate, localHourDecimal, round, clamp } from "./calendar-math.ts";

test("durationHours returns fractional hours", () => {
  assert.equal(durationHours({ start: "2026-06-01T10:00:00+02:00", end: "2026-06-01T11:30:00+02:00" }), 1.5);
});

test("localHourDecimal converts to the configured timezone", () => {
  assert.equal(localHourDecimal("2026-06-01T10:30:00+02:00", "Europe/Paris"), 10.5);
});

test("localDate returns the calendar date in the configured timezone", () => {
  assert.equal(localDate("2026-06-01T23:30:00+02:00", "Europe/Paris"), "2026-06-01");
});

test("businessDayList excludes weekends and is inclusive of both ends", () => {
  const days = businessDayList("2026-06-01", "2026-06-07");
  assert.deepEqual(days, ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"]);
});

test("round keeps one decimal", () => {
  assert.equal(round(4.4444), 4.4);
});

test("clamp bounds a value", () => {
  assert.equal(clamp(8, 9, 18), 9);
  assert.equal(clamp(20, 9, 18), 18);
  assert.equal(clamp(12, 9, 18), 12);
});
