import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger, ensureTasksEnabled } from "./shared.js";

export async function completeTask(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const taskId = args[0];
  if (!taskId) {
    exitWithError(2, "Task ID is required", {
      hint: "Usage: aligntrue task complete <id>",
    });
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("task.complete", { task_id: taskId }),
  );

  console.log(
    `Complete ${taskId}: ${outcome.status} (events: ${outcome.produced_events?.length ?? 0})`,
  );
}
