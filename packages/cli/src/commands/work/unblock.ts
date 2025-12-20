import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger } from "./shared.js";

export async function unblockWork(args: string[]): Promise<void> {
  const workId = args[0];
  if (!workId) {
    exitWithError(2, "Work ID is required", {
      hint: "Usage: aligntrue work unblock <id>",
    });
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("work.unblock", { work_id: workId }),
  );

  console.log(
    `Unblock ${workId}: ${outcome.status} (events: ${outcome.produced_events.length})`,
  );
}
