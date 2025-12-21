import {
  OPS_CORE_ENABLED,
  OPS_TASKS_ENABLED,
  Identity,
  Storage,
  Tasks,
  Projections,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

export const CLI_ACTOR: Tasks.TaskCommandEnvelope["actor"] = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human",
  display_name: process.env["USER"] || "CLI User",
};

export function ensureTasksEnabled(): void {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable ops-core commands",
    });
  }
  if (!OPS_TASKS_ENABLED) {
    exitWithError(1, "Tasks are disabled", {
      hint: "Set OPS_TASKS_ENABLED=1 to enable tasks",
    });
  }
}

export function createLedger(): Tasks.TaskLedger {
  const eventStore = new Storage.JsonlEventStore();
  const commandLog = new Storage.JsonlCommandLog();
  return new Tasks.TaskLedger(eventStore, commandLog);
}

export function buildCommand<T extends Tasks.TaskCommandType>(
  command_type: T,
  payload: Tasks.TaskCommandPayload,
): Tasks.TaskCommandEnvelope<T> {
  const target = `task:${"task_id" in payload ? (payload as { task_id: string }).task_id : "unknown"}`;
  return {
    command_id: Identity.generateCommandId({ command_type, payload }),
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: target,
    correlation_id: Identity.randomId(),
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } as Tasks.TaskCommandEnvelope<T>;
}

export async function readTasksProjection() {
  const rebuilt = await Projections.rebuildOne(
    Projections.TasksProjectionDef,
    new Storage.JsonlEventStore(),
  );
  return Projections.buildTasksProjectionFromState(
    rebuilt.data as Projections.TasksProjectionState,
  );
}
