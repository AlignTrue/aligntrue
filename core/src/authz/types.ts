/**
 * @experimental Authorization contracts (DR-007)
 *
 * Semantics are public; enforcement is not wired yet.
 * Types/interfaces only; no runtime enforcement.
 */
export interface Redaction {
  field: string;
  reason?: string;
}

export interface RowPolicy {
  entity: string;
  allowedFields?: string[];
  deniedFields?: string[];
  redactions?: Redaction[];
}

export interface FieldPolicy {
  field: string;
  redaction?: Redaction;
}

export interface AuthzContext {
  actorId: string;
  capability?: string;
  scopes?: string[];
}

export interface AuthzDecision {
  allowed: boolean;
  redactedFields?: string[];
  reason?: string;
}
