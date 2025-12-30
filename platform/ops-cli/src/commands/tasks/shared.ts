import { Identity, Projections, Contracts } from "@aligntrue/ops-core";
import { createHost, type Host } from "@aligntrue/ops-host";
import {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  type TasksProjection,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";

const { TASK_COMMAND_TYPES } = Contracts;

export interface TasksProjectionResult {
  projection: TasksProjection;
  hash: string;
}

const TASKS_PACK = {
  name: "@aligntrue/pack-tasks",
  version: "0.0.1",
  source: "workspace",
} as const;

let hostPromise: Promise<Host> | null = null;

export const CLI_ACTOR = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human" as const,
  display_name: process.env["USER"] || "CLI User",
};

export function ensureTasksEnabled(): void {
  // No env flag gating in Phase 3 for packs; keep placeholder if needed.
  return;
}

async function getHost(): Promise<Host> {
  if (!hostPromise) {
    hostPromise = createHost({
      manifest: {
        name: "@aligntrue/ops-cli",
        version: "0.0.0",
        packs: [TASKS_PACK],
        capabilities: Object.values(TASK_COMMAND_TYPES),
      },
    });
  }
  return hostPromise;
}

export async function dispatchTaskCommand(
  command_type: (typeof TASK_COMMAND_TYPES)[keyof typeof TASK_COMMAND_TYPES],
  payload: Record<string, unknown>,
) {
  const host = await getHost();
  const target = `task:${
    "task_id" in payload ? (payload as { task_id: string }).task_id : "unknown"
  }`;
  const command = {
    command_id: Identity.randomId(),
    idempotency_key: Identity.deterministicId({
      command_type,
      payload,
      target,
    }),
    dedupe_scope: "target",
    command_type,
    payload,
    target_ref: target,
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
    correlation_id: Identity.randomId(),
  };
  return host.runtime.dispatchCommand(command);
}

export async function readTasksProjection(): Promise<TasksProjectionResult> {
  const host = await getHost();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    host.eventStore,
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  return { projection, hash: hashTasksProjection(projection) };
}
