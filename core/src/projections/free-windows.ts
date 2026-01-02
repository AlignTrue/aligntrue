import type { CalendarEventRecord } from "../calendar/google-contracts.js";
import { hashCanonical } from "../identity/hash.js";

export interface FreeWindow {
  start: string;
  end: string;
  duration_minutes: number;
}

export interface FreeWindowsProjection {
  date: string;
  workday_start: string;
  workday_end: string;
  windows: FreeWindow[];
  total_free_minutes: number;
}

export function computeFreeWindows(
  events: CalendarEventRecord[],
  date: string,
  opts?: { workdayStart?: string; workdayEnd?: string },
): FreeWindowsProjection {
  const workdayStart = opts?.workdayStart ?? "09:00";
  const workdayEnd = opts?.workdayEnd ?? "18:00";
  const dayStart = new Date(`${date}T${workdayStart}:00Z`).getTime();
  const dayEnd = new Date(`${date}T${workdayEnd}:00Z`).getTime();

  const sameDayEvents = events
    .filter((e) => e.start_time.startsWith(date))
    .map((e) => ({
      start: Date.parse(e.start_time),
      end: e.end_time ? Date.parse(e.end_time) : Date.parse(e.start_time),
    }))
    .filter((e) => !Number.isNaN(e.start) && !Number.isNaN(e.end))
    .sort((a, b) => a.start - b.start);

  const windows: FreeWindow[] = [];
  let cursor = dayStart;

  for (const ev of sameDayEvents) {
    if (ev.start > cursor) {
      windows.push(buildWindow(cursor, ev.start));
    }
    cursor = Math.max(cursor, ev.end);
  }

  if (cursor < dayEnd) {
    windows.push(buildWindow(cursor, dayEnd));
  }

  const total_free_minutes = windows.reduce(
    (sum, w) => sum + w.duration_minutes,
    0,
  );

  return {
    date,
    workday_start: workdayStart,
    workday_end: workdayEnd,
    windows,
    total_free_minutes,
  };
}

export function hashFreeWindowsProjection(
  projection: FreeWindowsProjection,
): string {
  return hashCanonical(projection);
}

function buildWindow(startMs: number, endMs: number): FreeWindow {
  const duration_minutes = Math.max(0, Math.round((endMs - startMs) / 60000));
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    duration_minutes,
  };
}
