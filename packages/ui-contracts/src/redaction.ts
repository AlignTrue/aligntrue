export type RedactionStrategy = "allow" | "warn" | "hash" | "omit";

export interface RedactionPolicy {
  readonly default_for_unannotated: RedactionStrategy;
  readonly require_annotation_for_strings: boolean;
}

/**
 * Custom JSON Schema annotations expected on sensitive fields.
 */
export interface RedactionAnnotations {
  readonly ["x-sensitive"]?: boolean;
  readonly ["x-redaction"]?: RedactionStrategy;
}
