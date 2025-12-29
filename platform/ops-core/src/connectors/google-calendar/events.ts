import type { ActorRef } from "../../envelopes/actor.js";
import type { EventEnvelope } from "../../envelopes/event.js";
import { generateEventId } from "../../identity/id.js";
import { hashCanonical } from "../../identity/hash.js";
import { ValidationError } from "../../errors.js";
import type { CalendarEventRecord } from "./types.js";

const CALENDAR_ENVELOPE_VERSION = 1;
const CALENDAR_PAYLOAD_SCHEMA_VERSION = 1;

export const CALENDAR_EVENT_TYPES = {
  CalendarItemIngested: "calendar_item_ingested",
} as const;

export type CalendarEventType =
  (typeof CALENDAR_EVENT_TYPES)[keyof typeof CALENDAR_EVENT_TYPES];

export interface CalendarItemIngestedPayload {
  source_ref: string;
  provider: CalendarEventRecord["provider"];
  calendar_id: string;
  event_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  organizer?: string;
  location?: string;
  attendees?: CalendarEventRecord["attendees"];
  raw_updated_at: string;
}

export type CalendarEventEnvelope = EventEnvelope<
  (typeof CALENDAR_EVENT_TYPES)["CalendarItemIngested"],
  CalendarItemIngestedPayload
>;

export function deriveCalendarSourceRef(input: {
  provider: string;
  calendar_id: string;
  event_id: string;
  updated: string;
}): string {
  return hashCanonical(input);
}

export function buildCalendarIngestEvent(opts: {
  record: CalendarEventRecord;
  correlation_id: string;
  ingested_at: string;
  actor: ActorRef;
  capability_scope?: string[];
  capability_id?: string;
}): CalendarEventEnvelope {
  const { record, correlation_id, ingested_at, actor } = opts;
  const capability_id =
    opts.capability_id ??
    opts.capability_scope?.[0] ??
    "connector:google_calendar";

  if (!record.start_time) {
    throw new ValidationError("start_time is required for calendar events");
  }

  const source_ref = deriveCalendarSourceRef({
    provider: record.provider,
    calendar_id: record.calendar_id,
    event_id: record.event_id,
    updated: record.updated,
  });

  const payload: CalendarItemIngestedPayload = {
    source_ref,
    provider: record.provider,
    calendar_id: record.calendar_id,
    event_id: record.event_id,
    title: record.title,
    start_time: record.start_time,
    raw_updated_at: record.updated,
    ...(record.description ? { description: record.description } : {}),
    ...(record.end_time ? { end_time: record.end_time } : {}),
    ...(record.organizer ? { organizer: record.organizer } : {}),
    ...(record.location ? { location: record.location } : {}),
    ...(record.attendees ? { attendees: record.attendees } : {}),
  };

  const eventBase = {
    event_id: generateEventId({
      event_type: CALENDAR_EVENT_TYPES.CalendarItemIngested,
      source_ref,
      updated: record.updated,
    }),
    event_type: CALENDAR_EVENT_TYPES.CalendarItemIngested,
    payload,
    occurred_at: record.start_time,
    ingested_at,
    correlation_id,
    source_ref,
    actor,
    capability_id,
    envelope_version: CALENDAR_ENVELOPE_VERSION,
    payload_schema_version: CALENDAR_PAYLOAD_SCHEMA_VERSION,
  };

  return eventBase;
}
