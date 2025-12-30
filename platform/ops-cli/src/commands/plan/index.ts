import {
  OPS_CORE_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_TASKS_ENABLED,
  Suggestions,
  Identity,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";
import { readTasksProjection } from "../tasks/shared.js";

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

async function handleWeekly(args: string[]): Promise<void> {
  ensureWeeklyEnabled();
  const force = args.includes("--force");
  const json = args.includes("--json");

  const { projection, hash } = await readTasksProjection();
  const artifactStore = Suggestions.createArtifactStore();
  const correlation_id = Identity.randomId();

  const result = await Suggestions.buildWeeklyPlan({
    actor: CLI_ACTOR,
    artifactStore,
    tasksProjection: projection,
    tasksProjectionHash: hash,
    correlation_id,
    force,
  });

  if (json) {
    console.log(
      JSON.stringify({
        outcome: result.outcome,
        reason: result.reason,
        artifact_id: result.artifact?.artifact_id,
        week_start: (
          result.artifact?.output_data as Suggestions.WeeklyPlanData | undefined
        )?.week_start,
      }),
    );
    return;
  }

  const week =
    (result.artifact?.output_data as Suggestions.WeeklyPlanData | undefined)
      ?.week_start ?? "<unknown-week>";

  if (result.outcome === "generated" && result.artifact) {
    console.log(`Weekly plan for ${week}`);
    console.log(`  Outcome: generated`);
    console.log(`  Artifact: ${result.artifact.artifact_id}`);
    console.log(
      `  Tasks: ${
        (result.artifact.output_data as Suggestions.WeeklyPlanData).task_refs
          .length
      }`,
    );
    return;
  }

  if (result.outcome === "unchanged") {
    console.log(`Weekly plan for ${week}`);
    console.log(`  Outcome: unchanged`);
    if (result.artifact) {
      console.log(`  Artifact: ${result.artifact.artifact_id}`);
    }
    return;
  }

  console.log(`Weekly plan for ${week}`);
  console.log(
    `  Outcome: rejected${result.reason ? ` (${result.reason})` : ""}`,
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
