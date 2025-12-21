import { exitWithError } from "../../utils/command-utilities.js";
import { ensureTasksEnabled, readTasksProjection } from "./shared.js";
import { Projections } from "@aligntrue/ops-core";

export async function listTasks(args: string[]): Promise<void> {
  ensureTasksEnabled();
  let bucketFilter: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i);
    if (!arg) continue;
    if (arg === "--bucket") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--bucket requires a value", {
          hint: "Usage: aligntrue task list [--bucket today|week|later|waiting]",
        });
      }
      bucketFilter = next;
      i += 1;
    }
  }

  const projection = await readTasksProjection();
  const tasks = bucketFilter
    ? projection.tasks.filter(
        (t: Projections.TaskLatest) => t.bucket === bucketFilter,
      )
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
