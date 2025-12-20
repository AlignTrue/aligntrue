/**
 * DR-007 RowField-Auth-Projection-Strategy contract stubs.
 * Defines row/field authorization envelopes without runtime enforcement.
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
