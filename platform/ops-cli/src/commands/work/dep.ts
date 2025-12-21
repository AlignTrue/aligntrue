import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger } from "./shared.js";

export async function manageDependency(args: string[]): Promise<void> {
  const action = args[0];
  const workId = args[1];
  const blockerId = args[2];

  if (!action || !workId || !blockerId) {
    exitWithError(2, "Usage: aligntrue work dep <add|rm> <item> <blocker>", {
      hint: "Example: aligntrue work dep add task-b task-a",
    });
  }

  if (action !== "add" && action !== "rm") {
    exitWithError(2, `Unknown dep action: ${action}`, {
      hint: "Use add or rm",
    });
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand(action === "add" ? "work.dep.add" : "work.dep.remove", {
      work_id: workId,
      depends_on: blockerId,
    }),
  );

  console.log(
    `Dependency ${action} ${workId} -> ${blockerId}: ${outcome.status} (events: ${outcome.produced_events.length})`,
  );
}
