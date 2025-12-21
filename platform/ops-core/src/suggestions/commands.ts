import type { CommandEnvelope, CommandOutcome } from "../envelopes/command.js";
import type { ActorRef } from "../envelopes/actor.js";
import { Identity } from "../identity/index.js";

export type SuggestionCommandType =
  | "suggestion.approve"
  | "suggestion.reject"
  | "suggestion.snooze";

export interface ApproveSuggestionPayload {
  readonly suggestion_id: string;
  readonly expected_hash: string;
}

export interface RejectSuggestionPayload {
  readonly suggestion_id: string;
}

export interface SnoozeSuggestionPayload {
  readonly suggestion_id: string;
}

export type SuggestionCommandPayload =
  | ApproveSuggestionPayload
  | RejectSuggestionPayload
  | SnoozeSuggestionPayload;

export type SuggestionCommandEnvelope<
  T extends SuggestionCommandType = SuggestionCommandType,
> = CommandEnvelope<T, SuggestionCommandPayload>;

export function buildSuggestionCommand<T extends SuggestionCommandType>(
  command_type: T,
  payload: SuggestionCommandPayload,
  actor: ActorRef,
): SuggestionCommandEnvelope<T> {
  const target = `suggestion:${"suggestion_id" in payload ? payload.suggestion_id : "unknown"}`;
  const command_id = Identity.generateCommandId({ command_type, target });
  return {
    command_id,
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: target,
    correlation_id: Identity.randomId(),
    actor,
    requested_at: new Date().toISOString(),
  } as SuggestionCommandEnvelope<T>;
}

export type { CommandOutcome };
