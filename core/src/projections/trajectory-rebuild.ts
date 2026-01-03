import { canonicalize } from "../identity/canonicalize.js";
import { deterministicId } from "../identity/id.js";
import type { TrajectoryStore } from "../storage/trajectory-store.js";
import type {
  TrajectoryProjectionDefinition,
  TrajectoryProjectionOutput,
  TrajectoryProjectionFreshness,
} from "./trajectory-definition.js";
import type { OutcomeRecorded } from "../trajectories/outcome.js";

async function listAllTrajectoryIds(store: TrajectoryStore): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.listTrajectories({
      filters: {},
      limit: 100,
      sort: "time_asc",
      cursor,
    });
    ids.push(...page.ids);
    cursor = page.next_cursor;
  } while (cursor);
  ids.sort();
  return Array.from(new Set(ids));
}

async function listAllOutcomes(store: TrajectoryStore) {
  const outcomes: {
    raw: OutcomeRecorded;
    outcome_id: string;
    trajectory_id: string | undefined;
    timestamp: string;
  }[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.listOutcomes({
      filters: {},
      limit: 100,
      sort: "time_asc",
      cursor,
    });
    outcomes.push(
      ...page.outcomes.map((o) => ({
        raw: o,
        outcome_id: o.outcome_id,
        trajectory_id: o.attaches_to?.trajectory_id,
        timestamp: o.timestamp,
      })),
    );
    cursor = page.next_cursor;
  } while (cursor);
  outcomes.sort((a, b) => {
    if (a.timestamp === b.timestamp)
      return a.outcome_id.localeCompare(b.outcome_id);
    return a.timestamp.localeCompare(b.timestamp);
  });
  return outcomes;
}

export async function rebuildTrajectoryProjection<TState>(
  def: TrajectoryProjectionDefinition<TState>,
  store: TrajectoryStore,
): Promise<TrajectoryProjectionOutput<TState>> {
  let state = def.init();
  const ids = await listAllTrajectoryIds(store);

  let lastTrajectoryId: string | null = null;
  let lastStepId: string | null = null;
  let lastOutcomeId: string | null = null;

  for (const trajectory_id of ids) {
    const steps = await store.readTrajectory(trajectory_id);
    for (const step of steps) {
      state = def.applyStep(state, step);
      lastTrajectoryId = trajectory_id;
      lastStepId = step.step_id;
    }
  }

  const outcomes = await listAllOutcomes(store);
  for (const outcome of outcomes) {
    state = def.applyOutcome(state, outcome.raw);
    lastOutcomeId = outcome.outcome_id;
  }

  const freshness = def.getFreshness(state);
  const combinedFreshness: TrajectoryProjectionFreshness = {
    ...freshness,
    last_trajectory_id: freshness.last_trajectory_id ?? lastTrajectoryId,
    last_step_id: freshness.last_step_id ?? lastStepId,
    last_outcome_id: freshness.last_outcome_id ?? lastOutcomeId,
    rebuilt_at: freshness.rebuilt_at,
  };

  const hash = deterministicId(
    canonicalize({
      name: def.name,
      version: def.version,
      data: state,
      freshness: combinedFreshness,
    }),
  );

  return {
    name: def.name,
    version: def.version,
    data: state,
    freshness: combinedFreshness,
    hash,
  };
}
