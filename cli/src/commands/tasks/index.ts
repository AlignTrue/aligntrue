import { exitWithError } from "../../utils/command-utilities.js";
import { completeTask } from "./complete.js";
import { createTask } from "./create.js";
import { listTasks } from "./list.js";
import { reopenTask } from "./reopen.js";
import { triageTask } from "./triage.js";
import { ensureTasksEnabled } from "./shared.js";

const HELP_TEXT = `
Usage: aligntrue task <subcommand> [options]

Subcommands:
  create <title> [--id <id>] [--bucket today|week|later|waiting]   Create a task
  list [--bucket <bucket>]                                         List tasks
  triage <id> [--bucket ...] [--impact ...] [--effort ...] [--due ...] [--title ...]  Triage a task
  complete <id>                                                   Mark task completed
  reopen <id>                                                     Reopen a completed task
`;

export async function task(args: string[]): Promise<void> {
  ensureTasksEnabled();
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help" || sub === "-h") {
    console.log(HELP_TEXT.trim());
    return;
  }

  switch (sub) {
    case "create":
      await createTask(rest);
      break;
    case "list":
      await listTasks(rest);
      break;
    case "triage":
      await triageTask(rest);
      break;
    case "complete":
      await completeTask(rest);
      break;
    case "reopen":
      await reopenTask(rest);
      break;
    default:
      exitWithError(2, `Unknown subcommand: ${sub}`, {
        hint: "Run aligntrue task --help",
      });
  }
}
