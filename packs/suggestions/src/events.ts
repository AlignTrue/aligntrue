import type { EventEnvelope } from "@aligntrue/core";
import type { ActorRef } from "@aligntrue/core";
import { Contracts, Identity } from "@aligntrue/core";
import type { SuggestionAction, SuggestionType } from "./types.js";

const SUGGESTION_EVENTS_ENVELOPE_VERSION = 1;
export const SUGGESTION_EVENTS_SCHEMA_VERSION = 1;

export interface SuggestionGeneratedPayload {
  readonly suggestion_id: string;
  readonly suggestion_type: SuggestionType;
  readonly target_refs: string[];
}

export type SuggestionGeneratedEvent = EventEnvelope<
  (typeof Contracts.SUGGESTION_EVENT_TYPES)["Generated"],
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
  readonly capability_id?: string;
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

  const event_id = Identity.generateEventId({
    suggestion_id: payload.suggestion_id,
    suggestion_type: payload.suggestion_type,
    target_refs: payload.target_refs,
  });

  const capability_id = input.capability_id ?? input.capability_scope?.[0];
  return {
    event_id,
    event_type: Contracts.SUGGESTION_EVENT_TYPES.Generated,
    payload,
    occurred_at: input.occurred_at,
    ingested_at: input.ingested_at ?? input.occurred_at,
    correlation_id: input.correlation_id,
    actor: input.actor,
    ...(capability_id !== undefined ? { capability_id } : {}),
    envelope_version: SUGGESTION_EVENTS_ENVELOPE_VERSION,
    payload_schema_version: SUGGESTION_EVENTS_SCHEMA_VERSION,
    ...(input.causation_id !== undefined && {
      causation_id: input.causation_id,
    }),
    ...(input.source_ref !== undefined && { source_ref: input.source_ref }),
  };
}

export interface SuggestionFeedbackPayload {
  readonly suggestion_id: string;
  readonly conversation_id: string;
  readonly channel: string;
  readonly suggested_action: SuggestionAction;
  readonly actual_action: SuggestionAction;
  readonly time_to_action_ms?: number;
  readonly was_expanded?: boolean;
  readonly context?: {
    sender_email?: string;
    sender_domain?: string;
    is_first_contact?: boolean;
    thread_length?: number;
    has_attachments?: boolean;
    subject_keywords?: string[];
  };
}

export type SuggestionFeedbackEvent = EventEnvelope<
  (typeof Contracts.SUGGESTION_EVENT_TYPES)["FeedbackReceived"],
  SuggestionFeedbackPayload
>;

export interface SuggestionFeedbackInput {
  readonly suggestion_id: string;
  readonly conversation_id: string;
  readonly channel: string;
  readonly suggested_action: SuggestionAction;
  readonly actual_action: SuggestionAction;
  readonly correlation_id: string;
  readonly actor: ActorRef;
  readonly occurred_at: string;
  readonly time_to_action_ms?: number;
  readonly was_expanded?: boolean;
  readonly context?: SuggestionFeedbackPayload["context"];
  readonly ingested_at?: string;
  readonly capability_scope?: string[];
  readonly capability_id?: string;
  readonly causation_id?: string;
  readonly source_ref?: string;
}

export function buildSuggestionFeedbackEvent(
  input: SuggestionFeedbackInput,
): SuggestionFeedbackEvent {
  const normalizedContext = normalizeContext(input.context);

  const payload: SuggestionFeedbackPayload = {
    suggestion_id: input.suggestion_id,
    conversation_id: input.conversation_id,
    channel: input.channel,
    suggested_action: input.suggested_action,
    actual_action: input.actual_action,
    ...(input.time_to_action_ms !== undefined && {
      time_to_action_ms: input.time_to_action_ms,
    }),
    ...(input.was_expanded !== undefined && {
      was_expanded: input.was_expanded,
    }),
    ...(normalizedContext !== undefined && { context: normalizedContext }),
  };

  const event_id = Identity.generateEventId({
    suggestion_id: payload.suggestion_id,
    suggested_action: payload.suggested_action,
    actual_action: payload.actual_action,
    occurred_at: input.occurred_at,
  });

  const capability_id = input.capability_id ?? input.capability_scope?.[0];
  return {
    event_id,
    event_type: Contracts.SUGGESTION_EVENT_TYPES.FeedbackReceived,
    payload,
    occurred_at: input.occurred_at,
    ingested_at: input.ingested_at ?? input.occurred_at,
    correlation_id: input.correlation_id,
    actor: input.actor,
    ...(capability_id !== undefined ? { capability_id } : {}),
    envelope_version: SUGGESTION_EVENTS_ENVELOPE_VERSION,
    payload_schema_version: SUGGESTION_EVENTS_SCHEMA_VERSION,
    ...(input.causation_id !== undefined && {
      causation_id: input.causation_id,
    }),
    ...(input.source_ref !== undefined && { source_ref: input.source_ref }),
  };
}

function normalizeContext(
  ctx: SuggestionFeedbackPayload["context"],
): SuggestionFeedbackPayload["context"] {
  if (!ctx) return undefined;
  const normalized = {
    ...(ctx.sender_email ? { sender_email: ctx.sender_email } : {}),
    ...(ctx.sender_domain ? { sender_domain: ctx.sender_domain } : {}),
    ...(ctx.is_first_contact !== undefined && {
      is_first_contact: ctx.is_first_contact,
    }),
    ...(ctx.thread_length !== undefined && {
      thread_length: ctx.thread_length,
    }),
    ...(ctx.has_attachments !== undefined && {
      has_attachments: ctx.has_attachments,
    }),
    ...(ctx.subject_keywords?.length
      ? { subject_keywords: Array.from(new Set(ctx.subject_keywords)).sort() }
      : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}

function dedupeAndSort(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
