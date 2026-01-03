import { type TrajectoryEvent, type OutcomeRecorded } from "@aligntrue/core";

import { getHost, getTrajectoryStore } from "./ops-services";

export interface TrajectorySummary {
  trajectory_id: string;
  step_count: number;
  last_timestamp: string | null;
  outcome_kinds: string[];
}

export async function getTrajectoryList(opts?: {
  entity_ref?: string;
  time_after?: string;
  time_before?: string;
  limit?: number;
  cursor?: string;
}) {
  await getHost();
  const store = getTrajectoryStore();
  const limit = opts?.limit ?? 20;
  const page = await store.listTrajectories({
    filters: {
      entity_ref: opts?.entity_ref,
      time_after: opts?.time_after,
      time_before: opts?.time_before,
    },
    limit,
    cursor: opts?.cursor,
    sort: "time_desc",
  });

  const outcomesPage = await store.listOutcomes({
    filters: {},
    limit: 500,
    sort: "time_desc",
  });

  const summaries: TrajectorySummary[] = [];
  for (const id of page.ids) {
    const steps = await store.readTrajectory(id);
    const last = steps[steps.length - 1];
    const outcome_kinds = outcomesPage.outcomes
      .filter((o) => o.attaches_to?.trajectory_id === id)
      .map((o) => o.kind);
    summaries.push({
      trajectory_id: id,
      step_count: steps.length,
      last_timestamp: last?.timestamp ?? null,
      outcome_kinds,
    });
  }

  return { trajectories: summaries, next_cursor: page.next_cursor };
}

export async function getTrajectoryDetail(trajectory_id: string): Promise<{
  steps: TrajectoryEvent[];
  outcomes: OutcomeRecorded[];
  entity_refs: string[];
}> {
  await getHost();
  const store = getTrajectoryStore();
  const steps = await store.readTrajectory(trajectory_id);
  const outcomesPage = await store.listOutcomes({
    filters: {},
    limit: 500,
    sort: "time_desc",
  });
  const outcomes = outcomesPage.outcomes.filter(
    (o) => o.attaches_to?.trajectory_id === trajectory_id,
  );

  const entitySet = new Set<string>();
  for (const step of steps) {
    for (const ref of step.refs.entity_refs) entitySet.add(ref.ref);
  }
  for (const outcome of outcomes) {
    for (const ref of outcome.refs.entity_refs) entitySet.add(ref.ref);
  }

  return {
    steps,
    outcomes,
    entity_refs: Array.from(entitySet).sort(),
  };
}
