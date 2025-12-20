import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger } from "./shared.js";

export async function completeWork(args: string[]): Promise<void> {
  const workId = args[0];
  if (!workId) {
    exitWithError(2, "Work ID is required", {
      hint: "Usage: aligntrue work complete <id>",
    });
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("work.complete", { work_id: workId }),
  );

  console.log(
    `Complete ${workId}: ${outcome.status} (events: ${outcome.produced_events.length})`,
  );
}
