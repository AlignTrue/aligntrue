import { exitWithError } from "../../utils/command-utilities.js";
import { dispatchTaskCommand, ensureTasksEnabled } from "./shared.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";
import { Identity, Contracts } from "@aligntrue/ops-core";

const { TASK_COMMAND_TYPES } = Contracts;

export async function createTask(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const spec: ArgDefinition[] = [
    { flag: "id", type: "string" },
    {
      flag: "bucket",
      type: "string",
      choices: ["today", "week", "later", "waiting"],
    },
  ];

  const parsed = parseArgs(args, spec);

  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue task create <title> [--id <id>] [--bucket today|week|later|waiting]",
    });
  }

  const title = parsed.positional[0];
  if (!title) {
    exitWithError(2, "Title is required", {
      hint: "Usage: aligntrue task create <title> [--id <id>] [--bucket today|week|later|waiting]",
    });
  }

  const safeTitle: string = title;
  const task_id: string =
    (parsed.flags.id as string | undefined) ?? Identity.randomId();
  const bucket = parsed.flags.bucket as
    | "today"
    | "week"
    | "later"
    | "waiting"
    | undefined;
  const payload = {
    task_id,
    title: safeTitle,
    bucket: bucket ?? "today",
    status: "open" as const,
  };

  const outcome = await dispatchTaskCommand(TASK_COMMAND_TYPES.Create, payload);

  console.log(
    `Task ${task_id} created (${outcome.status}, events: ${outcome.produced_events?.length ?? 0})`,
  );
}
