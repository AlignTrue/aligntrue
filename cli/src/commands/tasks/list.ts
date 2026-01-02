import { exitWithError } from "../../utils/command-utilities.js";
import { ensureTasksEnabled, readTasksProjection } from "./shared.js";
import type { TaskLatest } from "@aligntrue/pack-tasks";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";

export async function listTasks(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const spec: ArgDefinition[] = [
    {
      flag: "bucket",
      type: "string",
      choices: ["today", "week", "later", "waiting"],
    },
  ];
  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue task list [--bucket today|week|later|waiting]",
    });
  }

  const bucketFilter = parsed.flags.bucket as string | undefined;
  const { projection } = await readTasksProjection();
  const tasks = bucketFilter
    ? projection.tasks.filter((t: TaskLatest) => t.bucket === bucketFilter)
    : projection.tasks;

  if (!tasks.length) {
    console.log("No tasks found");
    return;
  }

  for (const task of tasks) {
    const triage = [
      task.bucket,
      task.impact ? `impact:${task.impact}` : null,
      task.effort ? `effort:${task.effort}` : null,
      task.due_at ? `due:${task.due_at}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(
      `- ${task.id} [${task.status}] ${task.title} ${triage ? `(${triage})` : ""}`,
    );
  }
}
