import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { TrajectoryEvent } from "../trajectories/envelope.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";
import type {
  TrajectoryProjectionDefinition,
  TrajectoryProjectionFreshness,
} from "./trajectory-definition.js";

const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_TOP_K = 50;

export interface CooccurrenceEdge {
  weight: number;
  trajectory_ids: string[];
  last_seen: string;
}

export interface CooccurrenceState {
  edges: Map<string, Map<string, CooccurrenceEdge>>;
  entity_trajectories: Map<string, string[]>;
  freshness: TrajectoryProjectionFreshness;
}

function cloneState(): CooccurrenceState {
  return {
    edges: new Map(),
    entity_trajectories: new Map(),
    freshness: {
      last_trajectory_id: null,
      last_step_id: null,
      last_outcome_id: null,
      rebuilt_at: new Date().toISOString(),
    },
  };
}

export const CooccurrenceProjectionDef: TrajectoryProjectionDefinition<CooccurrenceState> =
  {
    name: "trajectory_cooccurrence",
    version: "1.0.0",
    init: cloneState,
    applyStep(state, step) {
      const entities = (step.refs?.entity_refs ?? []).map((r) => r.ref);
      if (!entities.length) return state;
      const uniq = Array.from(new Set(entities)).sort();

      for (let i = 0; i < uniq.length; i += 1) {
        const entityA = uniq[i];
        if (entityA === undefined) continue;
        for (let j = i + 1; j < uniq.length; j += 1) {
          const entityB = uniq[j];
          if (entityB === undefined) continue;
          addEdge(state, entityA, entityB, step.trajectory_id, step.timestamp);
          addEdge(state, entityB, entityA, step.trajectory_id, step.timestamp);
        }
      }

      for (const ref of uniq) {
        const list = state.entity_trajectories.get(ref) ?? [];
        if (!list.includes(step.trajectory_id)) {
          list.push(step.trajectory_id);
          if (list.length > DEFAULT_TOP_K) {
            list.splice(0, list.length - DEFAULT_TOP_K);
          }
        }
        state.entity_trajectories.set(ref, list);
      }

      state.freshness.last_trajectory_id = step.trajectory_id;
      state.freshness.last_step_id = step.step_id;
      return state;
    },
    applyOutcome(state, outcome) {
      state.freshness.last_outcome_id = outcome.outcome_id;
      return state;
    },
    getFreshness(state) {
      return state.freshness;
    },
  };

function addEdge(
  state: CooccurrenceState,
  a: string,
  b: string,
  trajectory_id: string,
  timestamp: string,
) {
  const neighbors = state.edges.get(a) ?? new Map<string, CooccurrenceEdge>();
  const existing = neighbors.get(b) ?? {
    weight: 0,
    trajectory_ids: [],
    last_seen: timestamp,
  };
  existing.weight += 1;
  if (!existing.trajectory_ids.includes(trajectory_id)) {
    existing.trajectory_ids.push(trajectory_id);
    if (existing.trajectory_ids.length > DEFAULT_TOP_K) {
      existing.trajectory_ids.splice(
        0,
        existing.trajectory_ids.length - DEFAULT_TOP_K,
      );
    }
  }
  existing.last_seen = timestamp;
  neighbors.set(b, existing);
  state.edges.set(a, neighbors);
}

export function pruneCooccurrence(
  state: CooccurrenceState,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): CooccurrenceState {
  let latest = 0;
  for (const neighbors of state.edges.values()) {
    for (const edge of neighbors.values()) {
      const ts = Date.parse(edge.last_seen);
      if (!Number.isNaN(ts)) {
        latest = Math.max(latest, ts);
      }
    }
  }
  if (!latest) return state;
  const cutoff = latest - windowDays * 24 * 60 * 60 * 1000;
  for (const [a, neighbors] of state.edges) {
    for (const [b, edge] of neighbors) {
      const ts = Date.parse(edge.last_seen);
      if (Number.isNaN(ts) || ts < cutoff) {
        neighbors.delete(b);
      }
    }
    if (neighbors.size === 0) {
      state.edges.delete(a);
    }
  }
  return state;
}

export function cooccurrenceHash(state: CooccurrenceState): string {
  const normalized: Record<string, Record<string, CooccurrenceEdge>> = {};
  const entities = Array.from(state.edges.keys()).sort();
  for (const a of entities) {
    const map = state.edges.get(a)!;
    normalized[a] = {};
    for (const b of Array.from(map.keys()).sort()) {
      normalized[a][b] = {
        weight: map.get(b)!.weight,
        trajectory_ids: [...map.get(b)!.trajectory_ids],
        last_seen: map.get(b)!.last_seen,
      };
    }
  }
  return deterministicId(
    canonicalize({
      edges: normalized,
      entity_trajectories: Array.from(
        state.entity_trajectories.entries(),
      ).sort(),
    }),
  );
}

// OutcomeRecorded is unused in co-occurrence but kept for signature parity
export type { OutcomeRecorded, TrajectoryEvent };
