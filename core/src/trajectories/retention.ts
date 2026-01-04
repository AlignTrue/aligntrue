import { parseISO, subDays } from "date-fns";

import type { TrajectoryStepType } from "./steps.js";
import type { TrajectoryStore } from "../storage/trajectory-store.js";

export interface RetentionPolicy {
  max_age_days: number;
  max_trajectories: number;
  step_types_to_prune: TrajectoryStepType[];
  outcome_protection_days: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  max_age_days: 90,
  max_trajectories: 10000,
  step_types_to_prune: ["entity_read"],
  outcome_protection_days: 365,
};

interface TrajectoryMeta {
  id: string;
  first_ts: number | null;
  last_ts: number | null;
  has_protected_outcome: boolean;
  only_prunable_steps: boolean;
}

function toEpoch(ts: string | undefined): number | null {
  if (!ts) return null;
  const parsed = parseISO(ts);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
}

async function collectTrajectoryMeta(
  store: TrajectoryStore,
  trajId: string,
  policy: RetentionPolicy,
  protectedAfter: number,
): Promise<TrajectoryMeta> {
  const steps = await store.readTrajectory(trajId);
  let first_ts: number | null = null;
  let last_ts: number | null = null;
  let only_prunable = steps.length > 0;

  for (const step of steps) {
    const ts = toEpoch(step.timestamp);
    if (ts !== null) {
      first_ts = first_ts === null ? ts : Math.min(first_ts, ts);
      last_ts = last_ts === null ? ts : Math.max(last_ts, ts);
    }
    if (!policy.step_types_to_prune.includes(step.step_type)) {
      only_prunable = false;
    }
  }

  const outcomes = (
    await store.listOutcomes({
      filters: {},
      limit: 1000,
      sort: "time_desc",
    })
  ).outcomes.filter((o) => o.attaches_to?.trajectory_id === trajId);

  let has_protected_outcome = false;
  for (const outcome of outcomes) {
    const ts = toEpoch(outcome.timestamp);
    if (ts !== null && ts >= protectedAfter) {
      has_protected_outcome = true;
      break;
    }
  }

  return {
    id: trajId,
    first_ts,
    last_ts,
    has_protected_outcome,
    only_prunable_steps: only_prunable,
  };
}

export async function identifyPrunableTrajectories(
  store: TrajectoryStore,
  policy: RetentionPolicy = DEFAULT_RETENTION,
): Promise<string[]> {
  const ageCutoff = subDays(Date.now(), policy.max_age_days).valueOf();
  const outcomeProtectCutoff = subDays(
    Date.now(),
    policy.outcome_protection_days,
  ).valueOf();

  const page = await store.listTrajectories({
    filters: {},
    limit: policy.max_trajectories * 2, // safety upper bound
    sort: "time_desc",
  });

  const metas: TrajectoryMeta[] = [];
  for (const id of page.ids) {
    metas.push(
      await collectTrajectoryMeta(store, id, policy, outcomeProtectCutoff),
    );
  }

  // Age-based pruning (no protected outcomes)
  const prunableByAge = metas
    .filter(
      (m) =>
        m.last_ts !== null &&
        m.last_ts < ageCutoff &&
        !m.has_protected_outcome &&
        m.only_prunable_steps,
    )
    .map((m) => m.id);

  // Cap-based pruning (oldest beyond max_trajectories, skip protected)
  const sortedByLast = [...metas].sort((a, b) => {
    const av = a.last_ts ?? 0;
    const bv = b.last_ts ?? 0;
    return av - bv;
  });
  const overLimit =
    sortedByLast.length > policy.max_trajectories
      ? sortedByLast
          .slice(0, sortedByLast.length - policy.max_trajectories)
          .filter((m) => !m.has_protected_outcome)
          .map((m) => m.id)
      : [];

  // Deduplicate
  return Array.from(new Set([...prunableByAge, ...overLimit]));
}
