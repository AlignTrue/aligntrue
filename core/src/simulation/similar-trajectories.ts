import type { CooccurrenceState } from "../projections/cooccurrence.js";
import type { SignatureState } from "../projections/signatures.js";
import type { SimulationResult } from "./types.js";

export interface SimilarTrajectoriesQuery {
  entity_refs: string[];
  step_pattern?: string[]; // unused in v1, reserved
  limit?: number;
  min_similarity?: number; // 0-1
}

export interface SimilarTrajectoriesResult extends SimulationResult {
  trajectories: Array<{
    trajectory_id: string;
    similarity_score: number;
    matched_entities: string[];
    outcome?: string | undefined;
  }>;
}

const ALGO_VERSION = "v1.0.0";
const FEATURE_SCHEMA_VERSION = "v1";

export function similarTrajectories(
  signatures: SignatureState,
  cooccurrence: CooccurrenceState,
  query: SimilarTrajectoriesQuery,
): SimilarTrajectoriesResult {
  const limit = query.limit ?? 10;
  const minSim = query.min_similarity ?? 0;

  const targetEntities = Array.from(new Set(query.entity_refs)).sort();
  const targetSigs = targetEntities
    .map((e) => signatures.entity_signatures.get(e))
    .filter((s): s is string => Boolean(s));

  const trajectoryScores = new Map<
    string,
    { score: number; matched: Set<string>; outcome?: string | undefined }
  >();

  for (const sig of targetSigs) {
    const peers = signatures.signature_index.get(sig) ?? [];
    for (const entity of peers) {
      const trajs = cooccurrence.entity_trajectories.get(entity) ?? [];
      for (const tid of trajs) {
        const entry = trajectoryScores.get(tid) ?? {
          score: 0,
          matched: new Set<string>(),
          outcome: signatures.trajectory_outcomes?.get?.(tid),
        };
        entry.score += 1; // increment per matched entity with same signature
        entry.matched.add(entity);
        trajectoryScores.set(tid, entry);
      }
    }
  }

  const results: SimilarTrajectoriesResult["trajectories"] = Array.from(
    trajectoryScores.entries(),
  )
    .map(([tid, data]) => ({
      trajectory_id: tid,
      similarity_score: data.score,
      matched_entities: Array.from(data.matched).sort(),
      outcome: data.outcome,
    }))
    .filter((r) => r.similarity_score >= minSim)
    .sort((a, b) => {
      if (b.similarity_score === a.similarity_score) {
        return a.trajectory_id.localeCompare(b.trajectory_id);
      }
      return b.similarity_score - a.similarity_score;
    })
    .slice(0, limit);

  const sampleSize = results.length;
  const confidence = computeConfidence(sampleSize);

  const evidence = results.map((r) => ({
    trajectory_id: r.trajectory_id,
    weight: r.similarity_score,
    matched_features: ["structural_signature_similarity"],
  }));

  return {
    predicted_outcomes: [],
    confidence,
    confidence_breakdown: {
      n: sampleSize,
      recency_weight: 1,
      variance: variance(results.map((r) => r.similarity_score)),
    },
    sample_size: sampleSize,
    evidence,
    contributing_features: ["structural_signature_similarity"],
    algorithm_version: ALGO_VERSION,
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    trajectories: results,
  };
}

function computeConfidence(n: number): number {
  if (n === 0) return 0;
  const base = n / (n + 10);
  return clamp(base, 0, 1);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v =
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return v;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
