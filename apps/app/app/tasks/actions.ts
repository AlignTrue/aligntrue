"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  OPS_TASKS_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_DATA_DIR,
  Identity,
  Storage,
} from "@aligntrue/core";
import {
  createJsonlTaskLedger,
  TASK_COMMAND_TYPES,
  type TaskCommandType,
  type TaskCommandPayload,
  type TaskCommandEnvelope,
} from "@aligntrue/pack-tasks";
import * as Suggestions from "@aligntrue/pack-suggestions";

import { getEventStore, getHost } from "@/lib/ops-services";
import {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  DEFAULT_TASKS_EVENTS_PATH,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";
import { Projections } from "@aligntrue/core";

type Bucket = "today" | "week" | "later" | "waiting";

const ACTOR = {
  actor_id: "web-user",
  actor_type: "human",
  display_name: "Web User",
} as const;

function buildCommand<T extends TaskCommandType>(
  command_type: T,
  payload: TaskCommandPayload,
): TaskCommandEnvelope<T> {
  const target =
    "task_id" in payload
      ? `task:${(payload as { task_id: string }).task_id}`
      : "task:unknown";
  const idempotency_key = Identity.generateCommandId({ command_type, payload });
  return {
    command_id: Identity.randomId(),
    idempotency_key,
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: "target",
    correlation_id: Identity.randomId(),
    actor: {
      actor_id: "web-user",
      actor_type: "human",
    },
    requested_at: new Date().toISOString(),
  } as TaskCommandEnvelope<T>;
}

async function execute(command: TaskCommandEnvelope) {
  if (!OPS_TASKS_ENABLED) {
    throw new Error("Tasks are disabled");
  }
  const ledger = createJsonlTaskLedger();
  await ledger.execute(command);
  revalidatePath("/tasks");
}

export async function createTaskAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const task_id = Identity.deterministicId(title);
  await execute(
    buildCommand(TASK_COMMAND_TYPES.Create, {
      task_id,
      title,
      bucket: "today",
      status: "open",
    }),
  );
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function triageTaskAction(formData: FormData) {
  const task_id = String(formData.get("task_id") ?? "");
  const bucket = String(formData.get("bucket") ?? "") as Bucket;
  if (!task_id || !bucket) return;
  await execute(
    buildCommand(TASK_COMMAND_TYPES.Triage, {
      task_id,
      bucket,
    }),
  );
}

export async function completeTaskAction(formData: FormData) {
  const task_id = String(formData.get("task_id") ?? "");
  const completed = formData.get("completed") === "on";
  if (!task_id) return;

  const commandType = completed
    ? TASK_COMMAND_TYPES.Complete
    : TASK_COMMAND_TYPES.Reopen;

  await execute(
    buildCommand(commandType, {
      task_id,
    }),
  );
}

export async function loadPlans() {
  const store = new Storage.JsonlArtifactStore(
    `${OPS_DATA_DIR}/pack-suggestions-query.jsonl`,
    `${OPS_DATA_DIR}/pack-suggestions-derived.jsonl`,
  );
  const derived = await store.listDerivedArtifacts();
  const daily = derived
    .filter((d) => d.output_type === "daily_plan")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  const weekly = derived
    .filter((d) => d.output_type === "weekly_plan")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  return { daily, weekly };
}

export async function generateWeeklyPlanAction(formData: FormData) {
  if (!OPS_PLANS_WEEKLY_ENABLED || !OPS_TASKS_ENABLED) return;

  const force = formData.get("force") === "on";
  await getHost();
  const store = Suggestions.createArtifactStore();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  const hash = hashTasksProjection(projection);
  const memoryProvider = {
    async index(
      items: { entity_type: string; entity_id: string; content: string }[],
    ) {
      return { indexed: 0, skipped: items.length };
    },
    async query(_context: unknown) {
      return [];
    },
    enabled() {
      return false;
    },
  };

  await Suggestions.buildWeeklyPlan({
    actor: ACTOR,
    artifactStore: store,
    tasksProjection: projection,
    tasksProjectionHash: hash,
    correlation_id: crypto.randomUUID(),
    force,
    memoryProvider,
  });

  revalidatePath("/tasks");
}

export async function createDailyPlanAction(formData: FormData) {
  if (!OPS_PLANS_DAILY_ENABLED) return;
  const raw = String(formData.get("task_ids") ?? "");
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!ids.length) return;

  await getHost();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  const hash = hashTasksProjection(projection);
  const artifactStore = Suggestions.createArtifactStore();
  await Suggestions.buildAndStoreDailyPlan({
    task_ids: ids,
    date: new Date().toISOString().slice(0, 10),
    tasks_projection_hash: hash,
    actor: ACTOR,
    artifactStore,
    correlation_id: Identity.randomId(),
  });
  revalidatePath("/tasks");
}
