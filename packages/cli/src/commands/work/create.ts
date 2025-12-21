import { Identity } from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger } from "./shared.js";

export async function createWork(args: string[]): Promise<void> {
  let customId: string | undefined;
  let description: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg === "--id") {
      customId = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--desc" || arg === "--description") {
      description = args[i + 1];
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  const title = positional[0];
  if (!title) {
    exitWithError(2, "Title is required", {
      hint: "Usage: aligntrue work create <title> [--id <id>] [--desc <text>]",
    });
    return;
  }

  const safeTitle: string = title;
  const work_id: string = customId ?? Identity.deterministicId(safeTitle);
  const payload =
    description === undefined
      ? { work_id, title: safeTitle }
      : { work_id, title: safeTitle, description };
  const ledger = createLedger();
  const outcome = await ledger.execute(buildCommand("work.create", payload));

  console.log(
    `Work item ${work_id} created (${outcome.status}, events: ${outcome.produced_events.length})`,
  );
}
