import { exitWithError } from "../../utils/command-utilities.js";
import { dispatchTaskCommand, ensureTasksEnabled } from "./shared.js";
import { Contracts } from "@aligntrue/core";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";

const { TASK_COMMAND_TYPES } = Contracts;

export async function triageTask(args: string[]): Promise<void> {
  ensureTasksEnabled();

  const spec: ArgDefinition[] = [
    {
      flag: "bucket",
      type: "string",
      choices: ["today", "week", "later", "waiting"],
    },
    { flag: "impact", type: "string", choices: ["L", "M", "H"] },
    { flag: "effort", type: "string", choices: ["S", "M", "L"] },
    { flag: "due", type: "string" },
    { flag: "title", type: "string" },
  ];

  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue task triage <id> [--bucket ...] [--impact ...] [--effort ...] [--due ISO] [--title ...]",
    });
  }

  const taskId = parsed.positional[0];
  if (!taskId) {
    exitWithError(2, "Task ID is required", {
      hint: "Usage: aligntrue task triage <id> [--bucket ...] [--impact ...] [--effort ...] [--due ISO] [--title ...]",
    });
  }

  const rawDue = parsed.flags.due as string | undefined;
  const lowered = rawDue?.toLowerCase();
  const due_at =
    lowered && ["null", "none", "clear"].includes(lowered) ? null : rawDue;

  if (
    parsed.flags.bucket === undefined &&
    parsed.flags.impact === undefined &&
    parsed.flags.effort === undefined &&
    rawDue === undefined &&
    parsed.flags.title === undefined
  ) {
    exitWithError(2, "No changes provided", {
      hint: "Use --bucket/--impact/--effort/--due/--title to triage",
    });
  }

  const outcome = await dispatchTaskCommand(TASK_COMMAND_TYPES.Triage, {
    task_id: taskId,
    ...(parsed.flags.bucket ? { bucket: parsed.flags.bucket } : {}),
    ...(parsed.flags.impact ? { impact: parsed.flags.impact } : {}),
    ...(parsed.flags.effort ? { effort: parsed.flags.effort } : {}),
    ...(rawDue !== undefined ? { due_at } : {}),
    ...(parsed.flags.title ? { title: parsed.flags.title } : {}),
  });

  console.log(
    `Triage ${taskId}: ${outcome.status} (events: ${outcome.produced_events?.length ?? 0})`,
  );
}
