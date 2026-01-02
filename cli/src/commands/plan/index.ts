import {
  OPS_CORE_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_TASKS_ENABLED,
  Contracts,
  Identity,
} from "@aligntrue/core";
import type { TasksProjection } from "@aligntrue/pack-tasks";
import { createHost, type Host } from "@aligntrue/host";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const manifestJson = require("../../../cli.manifest.json");
import { exitWithError } from "../../utils/command-utilities.js";
import { readTasksProjection } from "../tasks/shared.js";
import { CLI_ACTOR } from "../../utils/cli-actor.js";

const manifest = manifestJson as unknown as Contracts.AppManifest;
let hostInstance: Host | null = null;

export async function plan(args: string[]): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "daily":
      return handleDaily(args.slice(1));
    case "weekly":
      return handleWeekly(args.slice(1));
    default:
      return exitWithError(
        2,
        "Usage: aligntrue plan daily <task_id...> | plan weekly [--force] [--json]",
      );
  }
}

async function handleDaily(taskIds: string[]): Promise<void> {
  ensureEnabled();
  if (!taskIds.length) {
    return exitWithError(2, "Provide 1-3 task ids for daily plan");
  }
  if (taskIds.length > 3) {
    return exitWithError(2, "Daily plan supports up to 3 task ids");
  }

  const { hash } = await readTasksProjection();
  const host = await getHost();
  const command = buildDailyPlanCommand(taskIds, hash);
  const outcome = await host.runtime.dispatchCommand(command);
  console.log(
    `Daily plan command dispatched (${command.command_id}): ${outcome.status}`,
  );
}

async function handleWeekly(args: string[]): Promise<void> {
  ensureWeeklyEnabled();
  const force = args.includes("--force");
  const json = args.includes("--json");

  const { projection, hash } = await readTasksProjection();
  const host = await getHost();
  const command = buildWeeklyPlanCommand(projection, hash, { force });
  const outcome = await host.runtime.dispatchCommand(command);

  if (json) {
    console.log(
      JSON.stringify({
        outcome: outcome.status,
        child_commands: outcome.child_commands,
      }),
    );
    return;
  }

  console.log(
    `Weekly plan command dispatched (${command.command_id}): ${outcome.status}`,
  );
}

function ensureEnabled() {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable ops-core commands",
    });
  }
  if (!OPS_TASKS_ENABLED) {
    exitWithError(1, "Tasks are disabled", {
      hint: "Set OPS_TASKS_ENABLED=1 to enable tasks commands",
    });
  }
  if (!OPS_PLANS_DAILY_ENABLED) {
    exitWithError(1, "Daily plans are disabled", {
      hint: "Set OPS_PLANS_DAILY_ENABLED=1",
    });
  }
}

async function getHost(): Promise<Host> {
  if (!hostInstance) {
    hostInstance = await createHost({ manifest });
  }
  return hostInstance;
}

function buildDailyPlanCommand(taskIds: string[], tasksHash: string) {
  const date = new Date().toISOString().slice(0, 10);
  const command_id = Identity.randomId();
  const idempotency_key = Identity.deterministicId({
    command_type: Contracts.SUGGESTION_COMMAND_TYPES.BuildDailyPlan,
    date,
    task_ids: taskIds.join(","),
  });
  return {
    command_id,
    idempotency_key,
    command_type: Contracts.SUGGESTION_COMMAND_TYPES.BuildDailyPlan,
    payload: {
      task_ids: taskIds,
      date,
      tasks_projection_hash: tasksHash,
    },
    target_ref: `daily_plan:${date}`,
    dedupe_scope: "target",
    correlation_id: command_id,
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } satisfies Contracts.CommandEnvelope;
}

function buildWeeklyPlanCommand(
  tasksProjection: TasksProjection,
  tasksProjectionHash: string,
  opts: { force?: boolean },
) {
  const week_start = startOfWeekUtc(new Date().toISOString());
  const command_id = Identity.randomId();
  const idempotency_key = Identity.deterministicId({
    command_type: Contracts.SUGGESTION_COMMAND_TYPES.BuildWeeklyPlan,
    week_start,
  });
  return {
    command_id,
    idempotency_key,
    command_type: Contracts.SUGGESTION_COMMAND_TYPES.BuildWeeklyPlan,
    payload: {
      week_start,
      force: opts.force,
      tasks_projection: tasksProjection,
      tasks_projection_hash: tasksProjectionHash,
    },
    target_ref: `weekly_plan:${week_start}`,
    dedupe_scope: "target",
    correlation_id: command_id,
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } satisfies Contracts.CommandEnvelope;
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

function ensureWeeklyEnabled() {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable ops-core commands",
    });
  }
  if (!OPS_TASKS_ENABLED) {
    exitWithError(1, "Tasks are disabled", {
      hint: "Set OPS_TASKS_ENABLED=1 to enable tasks commands",
    });
  }
  if (!OPS_PLANS_WEEKLY_ENABLED) {
    exitWithError(1, "Weekly plans are disabled", {
      hint: "Set OPS_PLANS_WEEKLY_ENABLED=1",
    });
  }
}
