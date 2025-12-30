import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger } from "./shared.js";

export async function blockWork(args: string[]): Promise<void> {
  const workId = args[0];
  if (!workId) {
    exitWithError(2, "Work ID is required", {
      hint: "Usage: aligntrue work block <id> [reason]",
    });
  }

  const reason = args.slice(1).join(" ") || undefined;
  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("work.block", { work_id: workId, reason }),
  );

  console.log(
    `Block ${workId}: ${outcome.status} (events: ${outcome.produced_events?.length ?? 0})`,
  );
}
