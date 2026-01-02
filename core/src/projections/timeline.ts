import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/index.js";
import { hashCanonical } from "../identity/hash.js";
import {
  CALENDAR_EVENT_TYPES,
  type CalendarEventEnvelope,
} from "../calendar/google-contracts.js";
import {
  EMAIL_EVENT_TYPES,
  type EmailEventEnvelope,
} from "../emails/gmail-contracts.js";
import { OPS_CONTACTS_ENABLED } from "../config.js";
import { extractContactIdsFromEvent } from "./contacts.js";
import type { DocRef } from "../docrefs/index.js";
import { ValidationError } from "../errors.js";

export type TimelineItemType = "calendar_event" | "email_message";

export interface TimelineItem {
  id: string; // source_ref
  type: TimelineItemType;
  title: string;
  occurred_at: string;
  source_ref: string;
  summary?: string;
  entity_refs: string[];
  provider: string;
  calendar_id?: string;
  event_id?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  organizer?: string;
  attendees?: CalendarEventEnvelope["payload"]["attendees"];
  message_id?: string;
  thread_id?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  label_ids?: string[];
  doc_refs?: DocRef[];
  last_ingested_at: string;
  raw_updated_at: string;
}

export interface TimelineProjection {
  items: TimelineItem[];
}

export interface TimelineProjectionState extends ProjectionFreshness {
  timeline: Map<string, TimelineItem>;
}

export const TimelineProjectionDef: ProjectionDefinition<TimelineProjectionState> =
  {
    name: "timeline",
    version: "1.0.0",
    init(): TimelineProjectionState {
      return {
        timeline: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: TimelineProjectionState,
      event: EventEnvelope,
    ): TimelineProjectionState {
      switch (event.event_type) {
        case CALENDAR_EVENT_TYPES.CalendarItemIngested: {
          const calendarEvent = event as CalendarEventEnvelope;
          const item = toCalendarTimelineItem(calendarEvent);
          const next = new Map(state.timeline);
          next.set(item.id, item);
          return {
            timeline: next,
            last_event_id: event.event_id,
            last_ingested_at: event.ingested_at,
          };
        }
        case EMAIL_EVENT_TYPES.EmailMessageIngested: {
          const emailEvent = event as EmailEventEnvelope;
          const item = toEmailTimelineItem(emailEvent);
          const next = new Map(state.timeline);
          next.set(item.id, item);
          return {
            timeline: next,
            last_event_id: event.event_id,
            last_ingested_at: event.ingested_at,
          };
        }
        default:
          return state;
      }
    },
    getFreshness(state: TimelineProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildTimelineProjectionFromState(
  state: TimelineProjectionState,
): TimelineProjection {
  const items = Array.from(state.timeline.values()).sort((a, b) => {
    if (a.occurred_at === b.occurred_at) {
      return a.id.localeCompare(b.id);
    }
    return a.occurred_at > b.occurred_at ? -1 : 1;
  });

  return { items };
}

export function replayTimeline(
  events: AsyncIterable<EventEnvelope>,
): Promise<TimelineProjection> {
  let state: TimelineProjectionState = TimelineProjectionDef.init();
  return (async () => {
    for await (const event of events) {
      state = TimelineProjectionDef.apply(state, event);
    }
    return buildTimelineProjectionFromState(state);
  })();
}

export function hashTimelineProjection(projection: TimelineProjection): string {
  return hashCanonical(projection);
}

function toCalendarTimelineItem(event: CalendarEventEnvelope): TimelineItem {
  const payload = event.payload;
  const source_ref = payload.source_ref ?? event.source_ref;
  if (!source_ref) {
    throw new ValidationError(
      `Calendar event ${event.event_id} missing source_ref`,
      { event_id: event.event_id },
    );
  }
  const contactRefs = OPS_CONTACTS_ENABLED
    ? extractContactIdsFromEvent(event)
    : [];
  return {
    id: source_ref,
    type: "calendar_event",
    title: payload.title,
    occurred_at: payload.start_time,
    source_ref,
    entity_refs: contactRefs,
    provider: payload.provider,
    calendar_id: payload.calendar_id,
    event_id: payload.event_id,
    start_time: payload.start_time,
    last_ingested_at: event.ingested_at,
    raw_updated_at: payload.raw_updated_at,
    ...(payload.description ? { summary: payload.description } : {}),
    ...(payload.end_time ? { end_time: payload.end_time } : {}),
    ...(payload.location ? { location: payload.location } : {}),
    ...(payload.organizer ? { organizer: payload.organizer } : {}),
    ...(payload.attendees ? { attendees: payload.attendees } : {}),
    ...(payload.doc_refs?.length ? { doc_refs: payload.doc_refs } : {}),
  };
}

function toEmailTimelineItem(event: EmailEventEnvelope): TimelineItem {
  const payload = event.payload;
  const source_ref = payload.source_ref ?? event.source_ref;
  if (!source_ref) {
    throw new ValidationError(
      `Email event ${event.event_id} missing source_ref`,
      { event_id: event.event_id },
    );
  }
  const title = payload.subject ?? "(no subject)";
  return {
    id: source_ref,
    type: "email_message",
    title,
    occurred_at: payload.internal_date,
    source_ref,
    entity_refs: [],
    provider: payload.provider,
    message_id: payload.message_id,
    thread_id: payload.thread_id,
    last_ingested_at: event.ingested_at,
    raw_updated_at: payload.internal_date,
    ...(payload.snippet ? { summary: payload.snippet } : {}),
    ...(payload.from ? { from: payload.from } : {}),
    ...(payload.to?.length ? { to: payload.to } : {}),
    ...(payload.cc?.length ? { cc: payload.cc } : {}),
    ...(payload.label_ids?.length ? { label_ids: payload.label_ids } : {}),
    ...(payload.doc_refs?.length ? { doc_refs: payload.doc_refs } : {}),
  };
}
