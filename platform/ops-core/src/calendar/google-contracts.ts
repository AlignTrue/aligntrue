import type { EventEnvelope } from "../envelopes/event.js";

export const CALENDAR_EVENT_TYPES = {
  CalendarItemIngested: "calendar_item_ingested",
} as const;

export interface CalendarAttendee {
  email?: string;
  display_name?: string;
  response_status?: string;
}

export interface CalendarEventRecord {
  provider: string;
  calendar_id: string;
  event_id: string;
  updated: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  organizer?: string;
  location?: string;
  attendees?: CalendarAttendee[];
}

export type CalendarEventEnvelope = EventEnvelope<
  (typeof CALENDAR_EVENT_TYPES)["CalendarItemIngested"],
  CalendarEventRecord & {
    raw_updated_at: string;
  }
>;
