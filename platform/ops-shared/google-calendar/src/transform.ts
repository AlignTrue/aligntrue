import { ValidationError } from "@aligntrue/ops-core";
import type { CalendarAttendee, CalendarEventRecord } from "./types.js";
import type { GoogleCalendarEvent } from "./fetch.js";

export function transformCalendarEvent(
  raw: GoogleCalendarEvent,
): CalendarEventRecord {
  const start = raw.start?.dateTime ?? raw.start?.date;
  if (!start) {
    throw new ValidationError("calendar event missing start time", {
      event_id: raw.id,
    });
  }

  const attendees: CalendarAttendee[] | undefined = raw.attendees?.map(
    (attendee) => ({
      ...(attendee.email !== undefined && { email: attendee.email }),
      ...(attendee.displayName !== undefined && {
        display_name: attendee.displayName,
      }),
      ...(attendee.responseStatus !== undefined && {
        response_status: attendee.responseStatus,
      }),
    }),
  );

  return {
    provider: "google_calendar",
    calendar_id: "primary", // default; caller may override per calendar
    event_id: raw.id,
    updated: raw.updated,
    title: raw.summary ?? "(no title)",
    ...(raw.description !== undefined && { description: raw.description }),
    start_time: start,
    ...(raw.end?.dateTime !== undefined && { end_time: raw.end.dateTime }),
    ...(raw.end?.date !== undefined && { end_time: raw.end.date }),
    ...(raw.organizer?.displayName !== undefined && {
      organizer: raw.organizer.displayName,
    }),
    ...(raw.organizer?.displayName === undefined &&
      raw.organizer?.email !== undefined && { organizer: raw.organizer.email }),
    ...(raw.location !== undefined && { location: raw.location }),
    ...(attendees !== undefined && { attendees }),
  };
}

export function transformCalendarEvents(
  raw: GoogleCalendarEvent[],
): CalendarEventRecord[] {
  return raw.map(transformCalendarEvent);
}
