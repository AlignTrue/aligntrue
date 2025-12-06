/**
 * Override command - Manage overlays for customizing upstream rules
 * Overlays system: Migrated to CLI framework (no Commander)
 */

import { showStandardHelp, exitWithError } from "../utils/command-utilities.js";
import { overrideAdd } from "./override-add.js";
import { overrideDiff } from "./override-diff.js";
import { overrideSelectors } from "./override-selectors.js";

/**
 * Main override command with subcommands
 */
export async function overrideCommand(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showStandardHelp({
      name: "override",
      description: "Experimental: manage overlays for fork-safe customization",
      usage: "aligntrue override [add|selectors|diff] [options]",
      args: [],
      examples: [
        "aligntrue override             # Show overlays status and diff",
        "aligntrue override selectors   # List selectors first",
        "aligntrue override add --selector 'sections[0]' --set priority=high",
        "aligntrue override add --selector 'rule[id=8c70b25cbbbe8e79]' --set severity=error",
        "aligntrue override add --selector 'sections[0]' --set enabled=false",
      ],
      notes: [
        "Recommended workflow:",
        "  1. Run 'aligntrue override selectors' to see available targets",
        "  2. Copy a selector from the output (e.g., rule[id=...], sections[0])",
        "  3. Run 'aligntrue override add --selector <value> --set <property>=<value>'",
        "  4. Verify with 'aligntrue override' (status + diff)",
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

  if (args.length === 0) {
    await overrideDiff([]);
    return;
  }

  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      await overrideAdd(subArgs);
      break;
    case "selectors":
      await overrideSelectors(subArgs);
      break;
    case "diff":
      await overrideDiff(subArgs);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run: aligntrue override --help");
      exitWithError(1, `Unknown subcommand: ${subcommand}`, {
        hint: "Run: aligntrue override --help",
      });
  }
}
