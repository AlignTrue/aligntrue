import { Identity } from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger, ensureTasksEnabled } from "./shared.js";

export async function createTask(args: string[]): Promise<void> {
  ensureTasksEnabled();
  let customId: string | undefined;
  let bucket: "today" | "week" | "later" | "waiting" | undefined;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i);
    if (!arg) continue;
    if (arg === "--id") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--id requires a value", {
          hint: "Usage: aligntrue task create <title> [--id <id>] [--bucket today|week|later|waiting]",
        });
      }
      customId = next;
      i += 1;
      continue;
    }
    if (arg === "--bucket") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--bucket requires a value", {
          hint: "Usage: aligntrue task create <title> [--id <id>] [--bucket today|week|later|waiting]",
        });
      }
      bucket = next as typeof bucket;
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  const title = positional[0];
  if (!title) {
    exitWithError(2, "Title is required", {
      hint: "Usage: aligntrue task create <title> [--id <id>] [--bucket today|week|later|waiting]",
    });
  }

  const safeTitle: string = title;
  const task_id: string = customId ?? Identity.deterministicId(safeTitle);
  const payload = {
    task_id,
    title: safeTitle,
    bucket: bucket ?? "today",
    status: "open" as const,
  };

  const ledger = createLedger();
  const outcome = await ledger.execute(buildCommand("task.create", payload));

  console.log(
    `Task ${task_id} created (${outcome.status}, events: ${outcome.produced_events?.length ?? 0})`,
  );
}
