import type { ActorRef, CommandOutcome } from "@aligntrue/core";
import type { SafetyClasses } from "@aligntrue/core";
import type { JSONSchema7 } from "./json-schema.js";

export type SafetyClass = SafetyClasses.SafetyClass;

export interface BlockActionSchema {
  readonly action_type: string; // e.g., "form.submitted"
  readonly payload_schema: JSONSchema7;
  readonly safety_class: SafetyClass;
  readonly requires_approval?: boolean;
  readonly required_capability?: string;
  readonly triggers?: {
    readonly ui_state: boolean;
    readonly plan_regen: boolean;
  };
}

export interface BlockAction {
  readonly action_id: string; // client-generated
  readonly idempotency_key: string; // = hash(plan_id, action_type, client_sequence)
  readonly action_type: string;
  readonly block_instance_id: string;
  readonly block_type: string;
  readonly payload: unknown;

  readonly plan_id: string;
  readonly client_sequence: number; // monotonic per (plan_id, actor)
  readonly correlation_id: string;
  readonly actor: ActorRef;
}

export interface ActionIntent {
  readonly block_instance_id: string;
  readonly action_type: string;
  readonly payload: unknown;
  readonly idempotency_key?: string;
}

export interface ActionResult {
  readonly outcome: CommandOutcome;
}

export interface ActionSequenceState {
  readonly plan_id: string;
  readonly actor_id: string;
  readonly last_processed_sequence: number;
  readonly processed_keys: Set<string>;
}
