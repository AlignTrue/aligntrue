import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";
import type {
  TrajectoryProjectionDefinition,
  TrajectoryProjectionFreshness,
} from "./trajectory-definition.js";

type NGram = string;

export interface TransitionState {
  step_ngrams: Map<NGram, number>;
  outcome_conditioned: Map<NGram, Map<string, number>>;
  entity_type_patterns: Map<string, Map<NGram, number>>;
  trajectory_outcomes: Map<string, string[]>; // trajectory_id -> outcome kinds
  freshness: TrajectoryProjectionFreshness;
  // Temporary storage during rebuilding
  _temp_trajectory_steps: Map<string, string[]>;
  _temp_trajectory_refs: Map<string, string[]>;
}

function emptyState(): TransitionState {
  return {
    step_ngrams: new Map(),
    outcome_conditioned: new Map(),
    entity_type_patterns: new Map(),
    trajectory_outcomes: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
    _temp_trajectory_steps: new Map(),
    _temp_trajectory_refs: new Map(),
  };
}

const NG_VALUES = [2, 3];

export const TransitionProjectionDef: TrajectoryProjectionDefinition<TransitionState> =
  {
    name: "trajectory_transitions",
    version: "1.0.0",
    init: emptyState,
    applyStep(state, step) {
      const seq = step.step_type;
      const bucket = perTrajectory(state, step.trajectory_id);
      bucket.push(seq);

      const refs = perTrajectoryRefs(state, step.trajectory_id);
      for (const r of step.refs?.entity_refs ?? []) {
        refs.push(r.ref);
      }

      state.freshness.last_trajectory_id = step.trajectory_id;
      state.freshness.last_step_id = step.step_id;
      return state;
    },
    applyOutcome(state, outcome) {
      const tid = outcome.attaches_to.trajectory_id;
      if (tid) {
        const list = state.trajectory_outcomes.get(tid) ?? [];
        list.push(outcome.kind);
        state.trajectory_outcomes.set(tid, list);
      }
      state.freshness.last_outcome_id = outcome.outcome_id;
      return state;
    },
    getFreshness(state) {
      return state.freshness;
    },
  };

function perTrajectory(
  state: TransitionState,
  trajectory_id: string,
): string[] {
  let steps = state._temp_trajectory_steps.get(trajectory_id);
  if (!steps) {
    steps = [];
    state._temp_trajectory_steps.set(trajectory_id, steps);
  }
  return steps;
}

function perTrajectoryRefs(
  state: TransitionState,
  trajectory_id: string,
): string[] {
  let refs = state._temp_trajectory_refs.get(trajectory_id);
  if (!refs) {
    refs = [];
    state._temp_trajectory_refs.set(trajectory_id, refs);
  }
  return refs;
}

export function finalizeTransitions(state: TransitionState): TransitionState {
  // Build n-grams
  const trajectoryIds = Array.from(state._temp_trajectory_steps.keys()).sort();

  for (const tid of trajectoryIds) {
    const steps = state._temp_trajectory_steps.get(tid) ?? [];
    const refs = state._temp_trajectory_refs.get(tid) ?? [];
    const entityTypes = collectEntityTypesFromSteps(refs);
    const grams = ngrams(steps, NG_VALUES);
    const outcomeKinds = state.trajectory_outcomes.get(tid) ?? [];

    for (const gram of grams) {
      incrementMap(state.step_ngrams, gram, 1);
      if (outcomeKinds.length) {
        const inner =
          state.outcome_conditioned.get(gram) ?? new Map<string, number>();
        for (const kind of outcomeKinds) {
          incrementMap(inner, kind, 1);
        }
        state.outcome_conditioned.set(gram, inner);
      }
      for (const type of entityTypes) {
        const m =
          state.entity_type_patterns.get(type) ?? new Map<NGram, number>();
        incrementMap(m, gram, 1);
        state.entity_type_patterns.set(type, m);
      }
    }
  }

  // Cleanup temporary storage
  state._temp_trajectory_steps.clear();
  state._temp_trajectory_refs.clear();

  return state;
}

function collectEntityTypesFromSteps(refs: string[]): string[] {
  const types = new Set<string>();
  for (const ref of refs) {
    const idx = ref.indexOf(":");
    if (idx > 0) types.add(ref.slice(0, idx));
  }
  return Array.from(types).sort();
}

function ngrams(seq: string[], ns: number[]): NGram[] {
  const grams: NGram[] = [];
  for (const n of ns) {
    if (seq.length < n) continue;
    for (let i = 0; i <= seq.length - n; i += 1) {
      grams.push(seq.slice(i, i + n).join("->"));
    }
  }
  return grams;
}

function incrementMap(map: Map<string, number>, key: string, delta: number) {
  map.set(key, (map.get(key) ?? 0) + delta);
}

export function transitionsHash(state: TransitionState): string {
  const normalize = (m: Map<string, number>) =>
    Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v]);
  const outcomeNorm = Array.from(state.outcome_conditioned.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, normalize(v)]);
  const entityTypeNorm = Array.from(state.entity_type_patterns.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, normalize(v)]);
  return deterministicId(
    canonicalize({
      step_ngrams: normalize(state.step_ngrams),
      outcome_conditioned: outcomeNorm,
      entity_type_patterns: entityTypeNorm,
    }),
  );
}

export type { TrajectoryEvent, OutcomeRecorded };
