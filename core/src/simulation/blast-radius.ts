import { type CooccurrenceState } from "../projections/cooccurrence.js";
import {
  type OutcomeCorrelationState,
  probabilityOutcomeGivenEntity,
} from "../projections/outcome-correlations.js";
import { deterministicId } from "../identity/id.js";
import { canonicalize } from "../identity/canonicalize.js";
import type { SimulationResult } from "./types.js";

export interface BlastRadiusQuery {
  entity_ref: string;
  depth?: number; // currently only depth 1 supported
  min_weight?: number;
  include_outcomes?: string[];
}

export interface BlastRadiusResult extends SimulationResult {
  affected_entities: Array<{
    entity_ref: string;
    impact_score: number;
    path: string[];
  }>;
}

const DEFAULT_MIN_WEIGHT = 1;
const ALGO_VERSION = "v1.0.0";
const FEATURE_SCHEMA_VERSION = "v1";

export function blastRadius(
  cooccurrence: CooccurrenceState,
  outcomeCorrelations: OutcomeCorrelationState,
  query: BlastRadiusQuery,
): BlastRadiusResult {
  const minWeight = query.min_weight ?? DEFAULT_MIN_WEIGHT;
  const depth = query.depth ?? 1;
  if (depth !== 1) {
    // v1 only supports direct neighbors; deterministic rejection
    throw new Error("blastRadius depth>1 not supported in v1");
  }

  const neighbors = cooccurrence.edges.get(query.entity_ref);
  const affected: BlastRadiusResult["affected_entities"] = [];
  const evidence = [];

  if (neighbors) {
    for (const [entity, edge] of neighbors.entries()) {
      if (edge.weight < minWeight) continue;
      const corr = aggregateOutcomeCorrelation(
        outcomeCorrelations,
        entity,
        query.include_outcomes,
      );
      const impact = edge.weight + corr;
      affected.push({
        entity_ref: entity,
        impact_score: impact,
        path: [query.entity_ref, entity],
      });
      evidence.push({
        trajectory_id: deterministicId(
          canonicalize([query.entity_ref, entity, edge.trajectory_ids]),
        ),
        weight: edge.weight,
        matched_features: [
          "cooccurrence_weight",
          ...(corr > 0 ? ["outcome_correlation_prior"] : []),
        ],
      });
    }
  }

  affected.sort((a, b) => {
    if (b.impact_score === a.impact_score) {
      return a.entity_ref.localeCompare(b.entity_ref);
    }
    return b.impact_score - a.impact_score;
  });

  const sampleSize = affected.length;
  const confidence = computeConfidence(sampleSize, affected);
  const predicted_outcomes =
    query.include_outcomes?.map((o) => ({ outcome: o, probability: 0 })) ?? [];

  const result: BlastRadiusResult = {
    predicted_outcomes,
    confidence,
    confidence_breakdown: {
      n: sampleSize,
      recency_weight: 1,
      variance: variance(affected.map((a) => a.impact_score)),
    },
    sample_size: sampleSize,
    evidence,
    contributing_features: ["cooccurrence_weight", "outcome_correlation_prior"],
    algorithm_version: ALGO_VERSION,
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    affected_entities: affected,
  };

  return result;
}

function aggregateOutcomeCorrelation(
  state: OutcomeCorrelationState,
  entity_ref: string,
  includeOutcomes?: string[],
): number {
  if (!includeOutcomes || includeOutcomes.length === 0) return 0;
  let total = 0;
  for (const outcome of includeOutcomes) {
    const p = probabilityOutcomeGivenEntity(state, entity_ref, outcome);
    if (p !== null) total += p;
  }
  return total;
}

function computeConfidence(
  n: number,
  affected: { impact_score: number }[],
): number {
  if (n === 0) return 0;
  const base = n / (n + 10);
  const varPenalty = 1 - variance(affected.map((a) => a.impact_score));
  const recency = 1; // no recency in co-occurrence edges v1
  return clamp(base * recency * Math.max(varPenalty, 0), 0, 1);
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
