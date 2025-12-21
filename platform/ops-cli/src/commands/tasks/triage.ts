import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger, ensureTasksEnabled } from "./shared.js";

export async function triageTask(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const taskId = args.at(0);
  if (!taskId) {
    exitWithError(2, "Task ID is required", {
      hint: "Usage: aligntrue task triage <id> [--bucket ...] [--impact ...] [--effort ...] [--due ISO] [--title ...]",
    });
  }

  let bucket: string | undefined;
  let impact: string | undefined;
  let effort: string | undefined;
  let due_at: string | undefined | null;
  let title: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args.at(i);
    if (!arg) continue;
    if (arg === "--bucket") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--bucket requires a value", {
          hint: "Usage: aligntrue task triage <id> --bucket today|week|later|waiting",
        });
      }
      bucket = next;
      i += 1;
      continue;
    }
    if (arg === "--impact") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--impact requires a value", {
          hint: "Usage: aligntrue task triage <id> --impact <value>",
        });
      }
      impact = next;
      i += 1;
      continue;
    }
    if (arg === "--effort") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--effort requires a value", {
          hint: "Usage: aligntrue task triage <id> --effort <value>",
        });
      }
      effort = next;
      i += 1;
      continue;
    }
    if (arg === "--due") {
      const val = args.at(i + 1);
      if (!val) {
        exitWithError(2, "--due requires a value", {
          hint: "Usage: aligntrue task triage <id> --due <ISO timestamp|null>",
        });
      }
      due_at = val === "null" ? null : val;
      i += 1;
      continue;
    }
    if (arg === "--title") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--title requires a value", {
          hint: "Usage: aligntrue task triage <id> --title <text>",
        });
      }
      title = next;
      i += 1;
      continue;
    }
  }

  if (
    bucket === undefined &&
    impact === undefined &&
    effort === undefined &&
    due_at === undefined &&
    title === undefined
  ) {
    exitWithError(2, "No changes provided", {
      hint: "Use --bucket/--impact/--effort/--due/--title to triage",
    });
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("task.triage", {
      task_id: taskId,
      bucket: bucket as never,
      impact: impact as never,
      effort: effort as never,
      due_at: due_at as never,
      title,
    }),
  );

  console.log(
    `Triage ${taskId}: ${outcome.status} (events: ${outcome.produced_events.length})`,
  );
}
