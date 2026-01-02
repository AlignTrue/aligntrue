import { OPS_TASKS_ENABLED, Identity, Contracts } from "@aligntrue/core";
import { createPackHost } from "../../utils/pack-host.js";
import {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  type TasksProjection,
  type TasksProjectionState,
} from "@aligntrue/pack-tasks";
import { CLI_ACTOR } from "../../utils/cli-actor.js";

const { TASK_COMMAND_TYPES } = Contracts;

export interface TasksProjectionResult {
  projection: TasksProjection;
  hash: string;
}

const TASKS_PACK = {
  name: "@aligntrue/pack-tasks",
  version: "0.9.3",
  source: "workspace",
} as const;

const packHost = createPackHost<TasksProjectionState, TasksProjection>({
  pack: TASKS_PACK,
  capabilities: Object.values(TASK_COMMAND_TYPES),
  domainEnabled: OPS_TASKS_ENABLED,
  domainName: "tasks",
  projection: {
    def: TasksProjectionDef,
    build: buildTasksProjectionFromState,
    hash: hashTasksProjection,
  },
});

export const ensureTasksEnabled = packHost.ensureEnabled;

export async function dispatchTaskCommand(
  command_type: (typeof TASK_COMMAND_TYPES)[keyof typeof TASK_COMMAND_TYPES],
  payload: Record<string, unknown>,
) {
  const host = await packHost.getHost();
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
  const result = await packHost.readProjection();
  return { projection: result.projection, hash: result.hash ?? "" };
}
