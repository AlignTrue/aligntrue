import type { EventEnvelope } from "../envelopes/event.js";
import type { ActorRef } from "../envelopes/actor.js";
import { generateEventId } from "../identity/id.js";
import type { SuggestionType } from "./types.js";

export const SUGGESTION_EVENTS_SCHEMA_VERSION = 1;

export const SUGGESTION_EVENT_TYPES = {
  SuggestionGenerated: "suggestion.generated",
} as const;

export interface SuggestionGeneratedPayload {
  readonly suggestion_id: string;
  readonly suggestion_type: SuggestionType;
  readonly target_refs: string[];
}

export type SuggestionGeneratedEvent = EventEnvelope<
  (typeof SUGGESTION_EVENT_TYPES)["SuggestionGenerated"],
  SuggestionGeneratedPayload
>;

export interface SuggestionGeneratedInput {
  readonly suggestion_id: string;
  readonly suggestion_type: SuggestionType;
  readonly target_refs: string[];
  readonly correlation_id: string;
  readonly actor: ActorRef;
  readonly occurred_at: string;
  readonly ingested_at?: string;
  readonly capability_scope?: string[];
  readonly causation_id?: string;
  readonly source_ref?: string;
}

export function buildSuggestionGeneratedEvent(
  input: SuggestionGeneratedInput,
): SuggestionGeneratedEvent {
  const payload: SuggestionGeneratedPayload = {
    suggestion_id: input.suggestion_id,
    suggestion_type: input.suggestion_type,
    target_refs: dedupeAndSort(input.target_refs),
  };

  const event_id = generateEventId({
    suggestion_id: payload.suggestion_id,
    suggestion_type: payload.suggestion_type,
    target_refs: payload.target_refs,
  });

  return {
    event_id,
    event_type: SUGGESTION_EVENT_TYPES.SuggestionGenerated,
    payload,
    occurred_at: input.occurred_at,
    ingested_at: input.ingested_at ?? input.occurred_at,
    correlation_id: input.correlation_id,
    actor: input.actor,
    capability_scope: input.capability_scope ?? [],
    schema_version: SUGGESTION_EVENTS_SCHEMA_VERSION,
    ...(input.causation_id !== undefined && {
      causation_id: input.causation_id,
    }),
    ...(input.source_ref !== undefined && { source_ref: input.source_ref }),
  };
}

function dedupeAndSort(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
