export interface EvidenceEntry {
  trajectory_id: string;
  weight: number;
  matched_features: string[];
}

export interface ConfidenceBreakdown {
  n: number; // sample size
  recency_weight: number; // decay factor applied
  variance: number; // outcome variance in sample
}

export interface SimulationResult {
  predicted_outcomes: Array<{ outcome: string; probability: number }>;
  confidence: number; // 0-1 composite score
  confidence_breakdown: ConfidenceBreakdown;
  sample_size: number;
  evidence: EvidenceEntry[];
  contributing_features: string[];
  algorithm_version: string; // e.g., "v1.0.0"
  feature_schema_version: string; // e.g., "v1"
}

// Feature schema v1 reference (kept here for central traceability)
export const FEATURE_SCHEMA_V1 = [
  "entity_type_match",
  "cooccurrence_weight",
  "transition_ngram_match",
  "structural_signature_similarity",
  "outcome_correlation_prior",
  "recency_decay",
] as const;

export type FeatureNameV1 = (typeof FEATURE_SCHEMA_V1)[number];
