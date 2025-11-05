/**
 * Override command - Manage overlays for customizing upstream rules
 * Phase 3.5 Session 11: Migrated to CLI framework (no Commander)
 */

import { showStandardHelp } from "../utils/command-utilities.js";
import { overrideAdd } from "./override-add.js";
import { overrideStatus } from "./override-status.js";
import { overrideDiff } from "./override-diff.js";
import { overrideRemove } from "./override-remove.js";

/**
 * Main override command with subcommands
 */
export async function overrideCommand(args: string[]): Promise<void> {
  // Check for help flag
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showStandardHelp({
      name: "override",
      description: "Manage overlays for fork-safe customization",
      usage: "aligntrue override <subcommand> [options]",
      args: [],
      examples: [
        "aligntrue override add --selector 'rule[id=...]' --set severity=error",
        "aligntrue override status",
        "aligntrue override diff",
        "aligntrue override remove",
      ],
      notes: [
        "Overlays allow customizing rules without forking:",
        "  - Selector targets specific rules or properties",
        "  - Set operations modify values",
        "  - Remove operations delete properties",
        "  - Changes are tracked in .aligntrue/config.yaml",
      ],
    });
    return;
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      await overrideAdd(subArgs);
      break;
    case "status":
      await overrideStatus(subArgs);
      break;
    case "diff":
      await overrideDiff(subArgs);
      break;
    case "remove":
      await overrideRemove(subArgs);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue override --help");
      process.exit(1);
  }
}
