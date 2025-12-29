/**
 * Eval artifact contract used for promotion gates.
 */

export interface EvalArtifact {
  readonly eval_id: string; // content-addressed
  readonly inputs_hash: string; // dataset/fixture IDs hash
  readonly policy_version: string;
  readonly tool_versions: string[];
  readonly model_config: {
    readonly model_id: string;
    readonly temperature?: number;
    readonly [key: string]: unknown;
  };
  readonly metrics: Record<string, number>;
  readonly thresholds: Record<string, { min?: number; max?: number }>;
  readonly passed: boolean;
  readonly run_at: string;
  readonly environment: {
    readonly runtime_version: string;
    readonly node_version: string;
    readonly [key: string]: unknown;
  };
  readonly correlation_id: string;
}
