/**
 * Override command - Manage overlays for customizing upstream rules
 * Overlays system: Migrated to CLI framework (no Commander)
 */

import { showStandardHelp } from "../utils/command-utilities.js";
import { overrideAdd } from "./override-add.js";
import { overrideStatus } from "./override-status.js";
import { overrideDiff } from "./override-diff.js";
import { overrideRemove } from "./override-remove.js";
import { overrideSelectors } from "./override-selectors.js";

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
        "aligntrue override selectors",
      ],
      notes: [
        "Getting started:",
        "  1. Run 'aligntrue override selectors' to list available selectors for your rules",
        "  2. Copy a selector from the output (e.g., rule[id=...], sections[0])",
        "  3. Use it with 'aligntrue override add --selector <value>'",
        "",
        "Overlays allow customizing rules without forking:",
        "  - Selector targets specific rules or properties",
        "  - Set operations modify values",
        "  - Remove operations delete properties",
        "  - Changes are tracked in .aligntrue/config.yaml",
        "",
        "Selector examples:",
        "  rule[id=8c70b25cbbbe8e79]  Target rule by ID",
        "  sections[0]                Target a section by index",
        "  profile.version            Target a top-level property",
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
    case "selectors":
      await overrideSelectors(subArgs);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue override --help");
      process.exit(1);
  }
}
