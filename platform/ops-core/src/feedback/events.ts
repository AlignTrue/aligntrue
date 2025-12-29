import type { EventEnvelope } from "../envelopes/event.js";
import type { ActorRef } from "../envelopes/actor.js";
import { generateEventId } from "../identity/id.js";

const FEEDBACK_ENVELOPE_VERSION = 1;

export const FEEDBACK_SCHEMA_VERSION = 1;

export const FEEDBACK_TYPES = {
  Accepted: "accepted",
  Rejected: "rejected",
  Edited: "edited",
  Overridden: "overridden",
  Snoozed: "snoozed",
} as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[keyof typeof FEEDBACK_TYPES];

export interface FeedbackEventPayload {
  readonly artifact_id: string;
  readonly feedback_type: FeedbackType;
  readonly comment?: string;
  readonly tags?: string[];
  readonly edits?: unknown;
}

export type FeedbackEvent = EventEnvelope<FeedbackType, FeedbackEventPayload>;

export interface FeedbackEventInput {
  readonly artifact_id: string;
  readonly feedback_type: FeedbackType;
  readonly comment?: string;
  readonly tags?: string[];
  readonly edits?: unknown;
  readonly correlation_id: string;
  readonly actor: ActorRef;
  readonly occurred_at: string;
  readonly ingested_at?: string;
  readonly capability_scope?: string[];
  readonly capability_id?: string;
  readonly causation_id?: string;
  readonly source_ref?: string;
}

export function buildFeedbackEvent(input: FeedbackEventInput): FeedbackEvent {
  const payload: FeedbackEventPayload = {
    artifact_id: input.artifact_id,
    feedback_type: input.feedback_type,
    ...(input.comment !== undefined && { comment: input.comment }),
    ...(input.tags !== undefined && { tags: dedupeAndSort(input.tags) }),
    ...(input.edits !== undefined && { edits: input.edits }),
  };

  const capability_id = input.capability_id ?? input.capability_scope?.[0];
  const base = {
    payload,
    correlation_id: input.correlation_id,
    actor: input.actor,
    occurred_at: input.occurred_at,
    ingested_at: input.ingested_at ?? input.occurred_at,
    envelope_version: FEEDBACK_ENVELOPE_VERSION,
    payload_schema_version: FEEDBACK_SCHEMA_VERSION,
    event_type: input.feedback_type,
    ...(capability_id !== undefined ? { capability_id } : {}),
    ...(input.causation_id !== undefined && {
      causation_id: input.causation_id,
    }),
    ...(input.source_ref !== undefined && { source_ref: input.source_ref }),
  };

  const event_id = generateEventId({
    payload,
    correlation_id: input.correlation_id,
    occurred_at: input.occurred_at,
    actor: input.actor,
  });

  return {
    ...base,
    event_id,
  };
}

export function isFeedbackEvent(event: EventEnvelope): event is FeedbackEvent {
  return (
    typeof event.event_type === "string" &&
    Object.values(FEEDBACK_TYPES).includes(event.event_type as FeedbackType)
  );
}

export async function feedbackByArtifactId(
  events: AsyncIterable<EventEnvelope>,
  artifactId: string,
): Promise<FeedbackEvent[]> {
  const matches: FeedbackEvent[] = [];
  for await (const event of events) {
    if (!isFeedbackEvent(event)) continue;
    if (event.payload.artifact_id === artifactId) {
      matches.push(event);
    }
  }
  return matches;
}

function dedupeAndSort(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
