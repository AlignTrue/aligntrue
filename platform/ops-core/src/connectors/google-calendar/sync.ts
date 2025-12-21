import type { EventStore } from "../../storage/interfaces.js";
import { ValidationError } from "../../errors.js";
import { randomId } from "../../identity/id.js";
import type { ActorRef } from "../../envelopes/actor.js";
import { OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED } from "../../config.js";
import type { CalendarEventRecord } from "./types.js";
import { buildCalendarIngestEvent, deriveCalendarSourceRef } from "./events.js";

export interface IngestCalendarResult {
  written: number;
  skipped: number;
  disabled: boolean;
}

export interface IngestCalendarOptions {
  eventStore: EventStore;
  events: CalendarEventRecord[];
  correlation_id?: string;
  actor?: ActorRef;
  now?: () => string;
  flagEnabled?: boolean;
}

const CONNECTOR_ACTOR: ActorRef = {
  actor_id: "google-calendar-connector",
  actor_type: "service",
  display_name: "Google Calendar Connector",
};

/**
 * Ingest calendar events into the event store with idempotent upsert semantics.
 * - Flag-gated via OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED (default OFF)
 * - Deterministic source_ref derived from provider + calendarId + eventId + updated
 * - Skips duplicates by event_id (same source_ref + updated)
 */
export async function ingestCalendarEvents(
  options: IngestCalendarOptions,
): Promise<IngestCalendarResult> {
  const {
    eventStore,
    events,
    correlation_id = randomId(),
    actor = CONNECTOR_ACTOR,
    now = () => new Date().toISOString(),
  } = options;
  const flagEnabled =
    options.flagEnabled ?? OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED;

  if (!flagEnabled) {
    return { written: 0, skipped: events.length, disabled: true };
  }

  let written = 0;
  let skipped = 0;

  for (const record of events) {
    validateRecord(record);
    const ingested_at = now();
    const event = buildCalendarIngestEvent({
      record,
      correlation_id,
      ingested_at,
      actor,
    });

    const existing = await eventStore.getById(event.event_id);
    if (existing) {
      skipped += 1;
      continue;
    }

    await eventStore.append(event);
    written += 1;
  }

  return { written, skipped, disabled: false };
}

function validateRecord(record: CalendarEventRecord): void {
  if (!record.provider) {
    throw new ValidationError("provider is required");
  }
  if (!record.calendar_id) {
    throw new ValidationError("calendar_id is required");
  }
  if (!record.event_id) {
    throw new ValidationError("event_id is required");
  }
  if (!record.updated) {
    throw new ValidationError("updated timestamp is required");
  }
  if (!record.title) {
    throw new ValidationError("title is required");
  }
  if (!record.start_time) {
    throw new ValidationError("start_time is required");
  }
}

export { deriveCalendarSourceRef };
