/**
 * Canonical ordering tuple for deterministic projection application.
 */

export interface CanonicalOrdering {
  readonly occurred_at: string;
  readonly source_ref?: string;
  readonly source_sequence?: number;
  readonly event_id: string;
}
