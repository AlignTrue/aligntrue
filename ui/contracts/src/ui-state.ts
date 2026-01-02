export interface UIState {
  // Identity
  readonly plan_id: string; // stable stream ID
  readonly version: number; // monotonic, primary ordering

  // Content
  readonly selections: Record<string, unknown>;
  readonly form_values: Record<string, unknown>;
  readonly expanded_sections: string[];

  // Verification
  readonly content_hash: string; // hash of content fields
}
