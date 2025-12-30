import {
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_WEEKLY_PLAN_MAX_PER_WEEK,
  OPS_WEEKLY_PLAN_MIN_HOURS,
} from "../config.js";
import * as Artifacts from "../artifacts/index.js";
import type { ActorRef } from "../envelopes/actor.js";
import { ValidationError } from "../errors.js";
import type { ArtifactStore } from "../storage/interfaces.js";
import type {
  MemoryProvider,
  MemoryReference,
  QueryContext,
} from "../memory/types.js";
import { NoOpMemoryProvider } from "../memory/index.js";
import type {
  TaskBucket,
  TaskStatus,
  TaskImpact,
  TaskEffort,
} from "../contracts/tasks.js";

type TaskLatest = {
  id: string;
  title: string;
  bucket: TaskBucket;
  status: TaskStatus;
  impact?: TaskImpact;
  effort?: TaskEffort;
  due_at?: string | null;
  source_ref?: string;
  created_at: string;
  updated_at: string;
};

type TasksProjection = {
  tasks: TaskLatest[];
};

export interface WeeklyPlanData {
  readonly week_start: string; // YYYY-MM-DD (Monday UTC)
  readonly task_refs: string[];
  readonly memory_refs: string[];
  readonly themes: string[];
  readonly commitments: string[];
  readonly top_risks: string[];
}

export interface WeeklyPlanResult {
  readonly outcome: "generated" | "unchanged" | "rejected";
  // Allow explicit undefined when callers pass through optional values
  readonly artifact?: Artifacts.DerivedArtifact | undefined;
  readonly reason?: string | undefined;
}

export interface WeeklyPlanInput {
  readonly week_start?: string; // Defaults to current week (Monday UTC)
  readonly force?: boolean; // Bypass stability; still respects interval
  readonly actor: ActorRef;
  readonly artifactStore: ArtifactStore<
    Artifacts.QueryArtifact,
    Artifacts.DerivedArtifact
  >;
  readonly memoryProvider?: MemoryProvider;
  readonly tasksProjection: TasksProjection;
  readonly tasksProjectionHash: string;
  readonly correlation_id: string;
  readonly now?: () => string;
}

export async function buildWeeklyPlan(
  input: WeeklyPlanInput,
): Promise<WeeklyPlanResult> {
  if (!OPS_PLANS_WEEKLY_ENABLED) {
    throw new ValidationError("Weekly plans are disabled");
  }

  const nowFn = input.now ?? (() => new Date().toISOString());
  const weekStart = input.week_start ?? startOfWeekUtc(nowFn());
  const memoryProvider =
    input.memoryProvider && input.memoryProvider.enabled()
      ? input.memoryProvider
      : new NoOpMemoryProvider();

  const stability = await checkStability(
    weekStart,
    input.force ?? false,
    input.artifactStore,
  );
  if (!stability.proceed) {
    if (stability.reason === "plan_exists") {
      return { outcome: "unchanged", artifact: stability.existing };
    }
    return {
      outcome: "rejected",
      artifact: stability.existing,
      reason: stability.reason,
    };
  }

  const budget = await checkBudget(weekStart, input.artifactStore);
  if (!budget.allowed) {
    return { outcome: "rejected", reason: budget.reason };
  }

  const created_at = nowFn();
  const tasks = selectWeeklyTasks(input.tasksProjection.tasks);
  const task_refs = tasks.map((t) => `task:${t.id}`);

  const memoryRefs = await getMemoryRefs(memoryProvider, {
    week_start: weekStart,
    task_ids: task_refs,
  });

  const query = Artifacts.buildQueryArtifact({
    referenced_entities: ["task"],
    referenced_fields: ["id", "bucket", "status", "due_at"],
    filters: {
      week_start: weekStart,
      buckets: ["today", "week"],
      status: "open",
    },
    created_at,
    created_by: input.actor,
    correlation_id: input.correlation_id,
  });
  await input.artifactStore.putQueryArtifact(query);

  const output_data: WeeklyPlanData = {
    week_start: weekStart,
    task_refs,
    memory_refs: memoryRefs.map((m) => `${m.entity_type}:${m.entity_id}`),
    themes: [],
    commitments: [],
    top_risks: [],
  };

  const derived = Artifacts.buildDerivedArtifact({
    input_query_ids: [query.artifact_id],
    input_hashes: [query.content_hash, input.tasksProjectionHash],
    policy_version: "weekly_plan@0.0.1",
    output_type: "weekly_plan",
    output_data,
    created_at,
    created_by: input.actor,
    correlation_id: input.correlation_id,
  });

  await input.artifactStore.putDerivedArtifact(derived);

  return { outcome: "generated", artifact: derived };
}

function selectWeeklyTasks(tasks: readonly TaskLatest[]): TaskLatest[] {
  return tasks.filter(
    (task) =>
      (task.bucket === "today" || task.bucket === "week") &&
      task.status === "open",
  );
}

async function getMemoryRefs(
  provider: MemoryProvider,
  context: QueryContext,
): Promise<MemoryReference[]> {
  if (!provider.enabled()) return [];
  try {
    return await provider.query(context);
  } catch (error) {
    console.warn(
      "Memory provider query failed; continuing without memory",
      error,
    );
    return [];
  }
}

async function findExistingPlan(
  weekStart: string,
  store: ArtifactStore<Artifacts.QueryArtifact, Artifacts.DerivedArtifact>,
): Promise<Artifacts.DerivedArtifact | undefined> {
  const derived = await store.listDerivedArtifacts();
  return derived.find(
    (artifact) =>
      artifact.output_type === "weekly_plan" &&
      (artifact.output_data as WeeklyPlanData | undefined)?.week_start ===
        weekStart,
  );
}

async function countPlansThisWeek(
  weekStart: string,
  store: ArtifactStore<Artifacts.QueryArtifact, Artifacts.DerivedArtifact>,
): Promise<number> {
  const derived = await store.listDerivedArtifacts();
  return derived.filter(
    (artifact) =>
      artifact.output_type === "weekly_plan" &&
      (artifact.output_data as WeeklyPlanData | undefined)?.week_start ===
        weekStart,
  ).length;
}

async function checkStability(
  weekStart: string,
  force: boolean,
  store: ArtifactStore<Artifacts.QueryArtifact, Artifacts.DerivedArtifact>,
): Promise<{
  proceed: boolean;
  existing?: Artifacts.DerivedArtifact;
  reason?: string;
}> {
  const existing = await findExistingPlan(weekStart, store);
  if (!existing) return { proceed: true };

  if (!force) {
    return { proceed: false, existing, reason: "plan_exists" };
  }

  const hoursSince = hoursSinceArtifact(existing);
  if (hoursSince < OPS_WEEKLY_PLAN_MIN_HOURS) {
    return { proceed: false, existing, reason: "interval_not_met" };
  }

  return { proceed: true, existing };
}

async function checkBudget(
  weekStart: string,
  store: ArtifactStore<Artifacts.QueryArtifact, Artifacts.DerivedArtifact>,
): Promise<{ allowed: boolean; reason?: string }> {
  const count = await countPlansThisWeek(weekStart, store);
  if (count >= OPS_WEEKLY_PLAN_MAX_PER_WEEK) {
    return { allowed: false, reason: "budget_exceeded" };
  }
  return { allowed: true };
}

function startOfWeekUtc(iso: string): string {
  const date = new Date(iso);
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return utcDate.toISOString().slice(0, 10);
}

function hoursSinceArtifact(artifact: Artifacts.DerivedArtifact): number {
  const created = Date.parse(artifact.created_at);
  if (Number.isNaN(created)) return Number.POSITIVE_INFINITY;
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60);
}
