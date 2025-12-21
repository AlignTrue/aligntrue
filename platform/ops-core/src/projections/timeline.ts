import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/index.js";
import { hashCanonical } from "../identity/hash.js";
import {
  CALENDAR_EVENT_TYPES,
  type CalendarEventEnvelope,
  type CalendarItemIngestedPayload,
} from "../connectors/google-calendar/events.js";

export type TimelineItemType = "calendar_event";

export interface TimelineItem {
  id: string; // source_ref
  type: TimelineItemType;
  title: string;
  occurred_at: string;
  source_ref: string;
  summary?: string;
  entity_refs: string[];
  provider: string;
  calendar_id: string;
  event_id: string;
  start_time: string;
  end_time?: string;
  location?: string;
  organizer?: string;
  attendees?: CalendarItemIngestedPayload["attendees"];
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
      if (event.event_type !== CALENDAR_EVENT_TYPES.CalendarItemIngested) {
        return state;
      }

      const calendarEvent = event as CalendarEventEnvelope;
      const item = toTimelineItem(calendarEvent);
      const next = new Map(state.timeline);
      next.set(item.id, item);

      return {
        timeline: next,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
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

function toTimelineItem(event: CalendarEventEnvelope): TimelineItem {
  const payload = event.payload;
  return {
    id: payload.source_ref,
    type: "calendar_event",
    title: payload.title,
    occurred_at: payload.start_time,
    source_ref: payload.source_ref,
    entity_refs: [],
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
  };
}
