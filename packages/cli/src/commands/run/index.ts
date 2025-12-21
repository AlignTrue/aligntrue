import { exitWithError } from "../../utils/command-utilities.js";
import { ensureHybridEnabled } from "./shared.js";
import { startRun } from "./start.js";
import { showRuns } from "./show.js";
import { attemptStep } from "./step.js";

const HELP_TEXT = `
Usage: aligntrue run <subcommand> [options]

Subcommands:
  start --kind <kind> [--id <run_id>]     Start a run
  show [run_id]                           Show all runs or a single run
  step <run_id> --kind <kind> [--id <step_id>]  Record a step attempt
`;

export async function run(args: string[]): Promise<void> {
  ensureHybridEnabled();
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help" || sub === "-h") {
    console.log(HELP_TEXT.trim());
    return;
  }

  switch (sub) {
    case "start":
      await startRun(rest);
      break;
    case "show":
      await showRuns(rest);
      break;
    case "step":
      await attemptStep(rest);
      break;
    default:
      exitWithError(2, `Unknown subcommand: ${sub}`, {
        hint: "Run aligntrue run --help",
      });
  }
}
