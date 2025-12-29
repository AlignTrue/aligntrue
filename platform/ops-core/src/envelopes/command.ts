import { ValidationError } from "../errors.js";
import { ActorRef } from "./actor.js";
import type { CommandCausationType } from "../contracts/envelopes.js";

export interface CommandEnvelope<T extends string = string, P = unknown> {
  readonly command_id: string; // idempotency key (deterministic)
  readonly command_type: T; // namespaced
  readonly payload: P;

  readonly target_ref: string;
  readonly dedupe_scope: string; // typed scope string

  readonly expected_version?: number;
  readonly state_predicate?: string;

  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;

  readonly actor: ActorRef;
  readonly requested_at: string;
  readonly capability_id?: string;
}

export interface CommandOutcome {
  readonly command_id: string;
  readonly status: "accepted" | "rejected" | "already_processed";
  readonly reason?: string;
  readonly produced_events: string[];
  readonly completed_at: string;
}

const REQUIRED_COMMAND_FIELDS: (keyof CommandEnvelope)[] = [
  "command_id",
  "command_type",
  "payload",
  "target_ref",
  "dedupe_scope",
  "correlation_id",
  "actor",
  "requested_at",
];

export function validateCommandEnvelope(
  candidate: Partial<CommandEnvelope>,
): CommandEnvelope {
  for (const field of REQUIRED_COMMAND_FIELDS) {
    if (candidate[field] === undefined) {
      throw new ValidationError(`Missing required command field: ${field}`);
    }
  }

  return candidate as CommandEnvelope;
}
