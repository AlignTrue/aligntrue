import { exitWithError } from "../../utils/command-utilities.js";
import { dispatchTaskCommand, ensureTasksEnabled } from "./shared.js";
import { Contracts } from "@aligntrue/ops-core";

const { TASK_COMMAND_TYPES } = Contracts;

export async function completeTask(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const taskId = args[0];
  if (!taskId) {
    exitWithError(2, "Task ID is required", {
      hint: "Usage: aligntrue task complete <id>",
    });
  }

  const outcome = await dispatchTaskCommand(TASK_COMMAND_TYPES.Complete, {
    task_id: taskId,
  });

  console.log(
    `Complete ${taskId}: ${outcome.status} (events: ${outcome.produced_events?.length ?? 0})`,
  );
}
