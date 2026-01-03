import type { TransitionState } from "../projections/transitions.js";
import { type OutcomeCorrelationState } from "../projections/outcome-correlations.js";
import type { SimulationResult } from "./types.js";

export interface ChangeSimulationQuery {
  affected_entities: string[];
  step_pattern?: string[];
  context?: Record<string, unknown>;
}

export interface ChangeSimulationResult extends SimulationResult {
  risk_factors: Array<{
    factor: string;
    contribution: number;
    entity_ref?: string;
  }>;
}

const ALGO_VERSION = "v1.0.0";
const FEATURE_SCHEMA_VERSION = "v1";

export function simulateChange(
  transitions: TransitionState,
  outcomeCorrelations: OutcomeCorrelationState,
  query: ChangeSimulationQuery,
): ChangeSimulationResult {
  const entities = Array.from(new Set(query.affected_entities)).sort();
  const patternProbs = probabilitiesFromPattern(
    transitions,
    query.step_pattern,
  );
  const entityProbs = probabilitiesFromEntities(outcomeCorrelations, entities);

  const outcomes = Array.from(
    new Set([...patternProbs.keys(), ...entityProbs.keys()]),
  ).sort();

  const predicted_outcomes = outcomes.map((outcome) => {
    const p1 = patternProbs.get(outcome);
    const p2 = entityProbs.get(outcome);
    const parts = [p1, p2].filter((p): p is number => p !== undefined);
    const probability =
      parts.length === 0 ? 0 : parts.reduce((a, b) => a + b, 0) / parts.length;
    return { outcome, probability };
  });

  const sampleSize =
    (query.step_pattern?.length ?? 0) + entities.length || outcomes.length;
  const confidence = computeConfidence(sampleSize, predicted_outcomes);

  const evidence = outcomes.map((outcome) => ({
    trajectory_id: `outcome-${outcome}`,
    weight: (patternProbs.get(outcome) ?? 0) + (entityProbs.get(outcome) ?? 0),
    matched_features: [
      ...(patternProbs.has(outcome) ? ["transition_ngram_match"] : []),
      ...(entityProbs.has(outcome) ? ["outcome_correlation_prior"] : []),
    ],
  }));

  const risk_factors = buildRiskFactors(patternProbs, entityProbs, entities);

  return {
    predicted_outcomes,
    confidence,
    confidence_breakdown: {
      n: sampleSize,
      recency_weight: 1, // v1 no recency on transitions state
      variance: variance(predicted_outcomes.map((o) => o.probability)),
    },
    sample_size: sampleSize,
    evidence,
    contributing_features: [
      "transition_ngram_match",
      "outcome_correlation_prior",
    ],
    algorithm_version: ALGO_VERSION,
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    risk_factors,
  };
}

function probabilitiesFromPattern(
  transitions: TransitionState,
  step_pattern?: string[],
): Map<string, number> {
  const probs = new Map<string, number>();
  if (!step_pattern || step_pattern.length === 0) return probs;
  const gram = step_pattern.join("->");
  const conditioned = transitions.outcome_conditioned.get(gram);
  if (!conditioned) return probs;
  const total = Array.from(conditioned.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return probs;
  for (const [kind, count] of conditioned.entries()) {
    probs.set(kind, count / total);
  }
  return probs;
}

function probabilitiesFromEntities(
  outcomeCorrelations: OutcomeCorrelationState,
  entities: string[],
): Map<string, number> {
  const probs = new Map<string, number>();
  for (const entity of entities) {
    const outcomes = outcomeCorrelations.entity_outcomes.get(entity);
    if (!outcomes) continue;
    const total = outcomeCorrelations.entity_totals.get(entity) ?? 0;
    if (total === 0) continue;
    for (const [outcome, count] of outcomes.entries()) {
      const p = count / total;
      probs.set(outcome, (probs.get(outcome) ?? 0) + p);
    }
  }
  // average across entities
  for (const outcome of Array.from(probs.keys())) {
    probs.set(outcome, probs.get(outcome)! / entities.length);
  }
  return probs;
}

function computeConfidence(
  n: number,
  predicted: Array<{ probability: number }>,
): number {
  if (n === 0) return 0;
  const base = n / (n + 10);
  const varPenalty = 1 - variance(predicted.map((p) => p.probability));
  return clamp(base * Math.max(varPenalty, 0), 0, 1);
}

function buildRiskFactors(
  patternProbs: Map<string, number>,
  entityProbs: Map<string, number>,
  entities: string[],
) {
  const factors: ChangeSimulationResult["risk_factors"] = [];
  for (const [outcome, p] of entityProbs.entries()) {
    factors.push({
      factor: `entity_outcome:${outcome}`,
      contribution: p,
      entity_ref: entities.join(","),
    });
  }
  for (const [outcome, p] of patternProbs.entries()) {
    factors.push({
      factor: `pattern:${outcome}`,
      contribution: p,
    });
  }
  factors.sort((a, b) => b.contribution - a.contribution);
  return factors;
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
