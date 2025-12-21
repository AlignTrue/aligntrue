import {
  OPS_CORE_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_TASKS_ENABLED,
  Suggestions,
  Storage,
  Projections,
  Tasks,
  Identity,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

const CLI_ACTOR = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human",
  display_name: process.env["USER"] || "CLI User",
} as const;

export async function plan(args: string[]): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "daily":
      return handleDaily(args.slice(1));
    default:
      return exitWithError(2, "Usage: aligntrue plan daily <task_id...>");
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
  const artifactStore = Suggestions.createArtifactStore();
  const correlation_id = Identity.randomId();

  const artifact = await Suggestions.buildAndStoreDailyPlan({
    task_ids: taskIds,
    date: new Date().toISOString().slice(0, 10),
    tasks_projection_hash: hash,
    actor: CLI_ACTOR,
    artifactStore,
    correlation_id,
    auto_generated: false,
  });

  console.log(`Daily plan created: ${artifact.artifact_id}`);
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

async function readTasksProjection() {
  const store = new Storage.JsonlEventStore(Tasks.DEFAULT_TASKS_EVENTS_PATH);
  const rebuilt = await Projections.rebuildOne(
    Projections.TasksProjectionDef,
    store,
  );
  const projection = Projections.buildTasksProjectionFromState(
    rebuilt.data as Projections.TasksProjectionState,
  );
  return { projection, hash: Projections.hashTasksProjection(projection) };
}
