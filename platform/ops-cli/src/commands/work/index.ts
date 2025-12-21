import { exitWithError } from "../../utils/command-utilities.js";
import { blockWork } from "./block.js";
import { completeWork } from "./complete.js";
import { manageDependency } from "./dep.js";
import { createWork } from "./create.js";
import { showReady } from "./ready.js";
import { ensureOpsCoreEnabled } from "./shared.js";
import { showWork } from "./show.js";
import { unblockWork } from "./unblock.js";

const HELP_TEXT = `
Usage: aligntrue work <subcommand> [options]

Subcommands:
  create <title> [--id <id>] [--desc <text>]   Create a work item
  show [id]                                    Show all work items or a single item
  ready                                        List ready (unblocked, deps met) work items
  complete <id>                                Mark item completed
  block <id> [reason]                          Block a work item
  unblock <id>                                 Unblock a work item
  dep <add|rm> <item> <blocker>                Manage dependencies
`;

export async function work(args: string[]): Promise<void> {
  ensureOpsCoreEnabled();
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help" || sub === "-h") {
    console.log(HELP_TEXT.trim());
    return;
  }

  switch (sub) {
    case "create":
      await createWork(rest);
      break;
    case "show":
      await showWork(rest);
      break;
    case "ready":
      await showReady();
      break;
    case "complete":
      await completeWork(rest);
      break;
    case "block":
      await blockWork(rest);
      break;
    case "unblock":
      await unblockWork(rest);
      break;
    case "dep":
      await manageDependency(rest);
      break;
    default:
      exitWithError(2, `Unknown subcommand: ${sub}`, {
        hint: "Run aligntrue work --help",
      });
  }
}
