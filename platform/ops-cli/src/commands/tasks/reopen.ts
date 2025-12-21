import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger, ensureTasksEnabled } from "./shared.js";

export async function reopenTask(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const taskId = args[0];
  if (!taskId) {
    exitWithError(2, "Task ID is required", {
      hint: "Usage: aligntrue task reopen <id>",
    });
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("task.reopen", { task_id: taskId }),
  );

  console.log(
    `Reopen ${taskId}: ${outcome.status} (events: ${outcome.produced_events.length})`,
  );
}
