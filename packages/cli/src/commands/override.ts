/**
 * Override command - Manage overlays for customizing upstream rules
 * Overlays system: Migrated to CLI framework (no Commander)
 */

import { showStandardHelp, exitWithError } from "../utils/command-utilities.js";
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
      description: "Experimental: manage overlays for fork-safe customization",
      usage: "aligntrue override <subcommand> [options]",
      args: [],
      examples: [
        "aligntrue override selectors  # List selectors first",
        "aligntrue override add --selector 'sections[0]' --set priority=high",
        "aligntrue override add --selector 'rule[id=8c70b25cbbbe8e79]' --set severity=error",
        "aligntrue override add --selector 'sections[heading=Security]' --set enabled=false",
        "aligntrue override status  # View overlays",
        "aligntrue override diff  # Preview changes",
        "aligntrue override remove  # Remove overlays",
      ],
      notes: [
        "Recommended workflow:",
        "  1. Run 'aligntrue override selectors' to see available targets",
        "  2. Copy a selector from the output (e.g., rule[id=...], sections[0])",
        "  3. Run 'aligntrue override add --selector <value> --set <property>=<value>'",
        "  4. Verify with 'aligntrue override status' or 'aligntrue override diff'",
        "",
        "Common use cases:",
        "  - Disable a section: --set enabled=false",
        "  - Change severity: --set severity=error",
        "  - Add metadata: --set priority=high",
        "",
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
    case "selectors":
      await overrideSelectors(subArgs);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue override --help");
      exitWithError(1, `Unknown subcommand: ${subcommand}`, {
        hint: "Run: aligntrue override --help",
      });
  }
}
