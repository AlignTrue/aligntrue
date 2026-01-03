import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";
import type {
  TrajectoryProjectionDefinition,
  TrajectoryProjectionFreshness,
} from "./trajectory-definition.js";

export interface OutcomeCorrelationState {
  entity_outcomes: Map<string, Map<string, number>>;
  entity_totals: Map<string, number>;
  pattern_outcomes: Map<string, Map<string, number>>;
  pattern_totals: Map<string, number>;
  freshness: TrajectoryProjectionFreshness;
}

function emptyState(): OutcomeCorrelationState {
  return {
    entity_outcomes: new Map(),
    entity_totals: new Map(),
    pattern_outcomes: new Map(),
    pattern_totals: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
  };
}

export const OutcomeCorrelationProjectionDef: TrajectoryProjectionDefinition<OutcomeCorrelationState> =
  {
    name: "trajectory_outcome_correlations",
    version: "1.0.0",
    init: emptyState,
    applyStep(state, step) {
      state.freshness.last_trajectory_id = step.trajectory_id;
      state.freshness.last_step_id = step.step_id;
      return state;
    },
    applyOutcome(state, outcome) {
      state.freshness.last_outcome_id = outcome.outcome_id;
      const entities = (outcome.refs?.entity_refs ?? []).map((r) => r.ref);
      const uniq = Array.from(new Set(entities)).sort();
      for (const ref of uniq) {
        const totals = state.entity_totals.get(ref) ?? 0;
        state.entity_totals.set(ref, totals + 1);
        const byKind =
          state.entity_outcomes.get(ref) ?? new Map<string, number>();
        byKind.set(outcome.kind, (byKind.get(outcome.kind) ?? 0) + 1);
        state.entity_outcomes.set(ref, byKind);
      }
      // Patterns: derive simple n-grams of outcome kind (singleton)
      const pattern = outcome.kind;
      const pTotals = state.pattern_totals.get(pattern) ?? 0;
      state.pattern_totals.set(pattern, pTotals + 1);
      const pByKind =
        state.pattern_outcomes.get(pattern) ?? new Map<string, number>();
      pByKind.set(outcome.kind, (pByKind.get(outcome.kind) ?? 0) + 1);
      state.pattern_outcomes.set(pattern, pByKind);
      return state;
    },
    getFreshness(state) {
      return state.freshness;
    },
  };

export function outcomeCorrelationHash(state: OutcomeCorrelationState): string {
  const normMap = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  const normNested = (m: Map<string, Map<string, number>>) =>
    Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, normMap(v)]);
  return deterministicId(
    canonicalize({
      entity_outcomes: normNested(state.entity_outcomes),
      entity_totals: normMap(state.entity_totals),
      pattern_outcomes: normNested(state.pattern_outcomes),
      pattern_totals: normMap(state.pattern_totals),
    }),
  );
}

export function probabilityOutcomeGivenEntity(
  state: OutcomeCorrelationState,
  entity_ref: string,
  outcome_kind: string,
): number | null {
  const total = state.entity_totals.get(entity_ref);
  if (!total || total === 0) return null;
  const count = state.entity_outcomes.get(entity_ref)?.get(outcome_kind) ?? 0;
  return count / total;
}

export type { TrajectoryEvent, OutcomeRecorded };
