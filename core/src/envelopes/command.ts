import { ValidationError } from "../errors.js";
import { ActorRef } from "./actor.js";
import type { CommandCausationType } from "../contracts/envelopes.js";

export type DedupeScope = string;

/**
 * Required fields per dedupe scope.
 * Runtime MUST reject commands missing required fields.
 */
export const DEDUPE_SCOPE_REQUIREMENTS: Record<string, string[]> = {
  actor: ["actor.actor_id"], // Scope key: actor_id
  target: ["target_ref"], // Scope key: target_ref
  app: [], // Scope key: app_name (from manifest)
  global: [], // Scope key: constant
};

export interface CommandEnvelope<T extends string = string, P = unknown> {
  // Identity
  readonly command_id: string; // unique per attempt
  readonly idempotency_key: string; // dedupe key (separate from command_id)
  readonly dedupe_scope: string;

  // Command semantics
  readonly command_type: T;
  readonly payload: P;
  readonly target_ref?: string; // required when dedupe_scope === "target"
  readonly preconditions?: Record<string, unknown>;

  // Actor + capability
  readonly actor: ActorRef;
  readonly capability_id?: string; // defaults to command_type if absent
  /**
   * Nested dispatch provenance. Set by runtime when a pack dispatches a child
   * command. Handlers SHOULD NOT set directly.
   */
  readonly invoked_by?: { pack_id: string; command_id: string };

  // Time + causality
  readonly requested_at: string;
  readonly correlation_id: string;
  readonly causation_id?: string;
  readonly causation_type?: CommandCausationType;
  readonly metadata?: Record<string, unknown>;
}

export interface PackIdentity {
  readonly pack_id: string;
  readonly pack_version: string;
  readonly pack_integrity: string;
}

export interface CommandOutcome {
  readonly command_id: string;
  readonly status:
    | "accepted"
    | "rejected"
    | "already_processed"
    | "already_processing"
    | "failed";
  readonly reason?: string;
  readonly produced_events?: string[];
  readonly completed_at?: string;
  /**
   * IDs of commands dispatched during handling (nested dispatch).
   */
  readonly child_commands?: string[];
  /**
   * Set by runtime to record which pack handled the command.
   * Handlers MUST NOT set this directly.
   */
  readonly handled_by?: PackIdentity;
}

const REQUIRED_COMMAND_FIELDS: (keyof CommandEnvelope)[] = [
  "command_id",
  "idempotency_key",
  "command_type",
  "payload",
  "dedupe_scope",
  "correlation_id",
  "actor",
  "requested_at",
];

/**
 * Validate presence of required fields. Per-scope requirements validated separately.
 */
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

/**
 * Validate dedupe_scope-specific requirements.
 * Returns an error string if invalid, otherwise undefined.
 */
export function validateDedupeScope(
  command: CommandEnvelope,
): string | undefined {
  const required = DEDUPE_SCOPE_REQUIREMENTS[command.dedupe_scope];
  if (!required) {
    return undefined;
  }
  for (const field of required) {
    if (field === "target_ref" && !command.target_ref) {
      return `dedupe_scope="${command.dedupe_scope}" requires target_ref`;
    }
    if (field === "actor.actor_id" && !command.actor?.actor_id) {
      return `dedupe_scope="${command.dedupe_scope}" requires actor.actor_id`;
    }
  }
  return undefined;
}

/**
 * Compute the scope key for a command based on its dedupe scope.
 */
export function computeScopeKey(
  scope: string,
  command: CommandEnvelope,
  appName?: string,
): string {
  const actualAppName = appName ?? "unknown";
  switch (scope) {
    case "actor":
      return command.actor.actor_id;
    case "target":
      return command.target_ref ?? "__missing_target__";
    case "app":
      return actualAppName;
    case "global":
    default:
      return scope ? `${scope}` : "__global__";
  }
}
