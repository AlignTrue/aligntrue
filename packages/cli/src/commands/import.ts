/**
 * Import command - not implemented for sections-only format
 *
 * Users should author AGENTS.md directly in natural markdown.
 * Import adds complexity without clear value for the sections format.
 */

import * as clack from "@clack/prompts";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [];

/**
 * Import command entry point
 */
export async function importCommand(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "import",
      description: "Import rules from agent formats (NOT IMPLEMENTED)",
      usage: "aligntrue import <agent>",
      args: ARG_DEFINITIONS,
      examples: [],
      notes: [
        "Import is not implemented for sections-only format.",
        "",
        "Instead, author rules directly in AGENTS.md:",
        "  1. Create AGENTS.md with natural markdown sections",
        "  2. Run: aligntrue sync",
        "",
        "Example AGENTS.md:",
        "  ## Testing Guidelines",
        "  ",
        "  All features must have tests to ensure reliability.",
        "  Write tests alongside your code, not as an afterthought.",
      ],
    });
    return;
  }

  // Show error message with helpful guidance
  clack.log.error(
    "Import command is not implemented for sections-only format.",
  );
  console.log("");
  console.log("Instead, author rules directly in AGENTS.md:");
  console.log("  1. Create AGENTS.md with natural markdown sections");
  console.log("  2. Run: aligntrue sync");
  console.log("");
  console.log("Example AGENTS.md:");
  console.log("  ## Testing Guidelines");
  console.log("  ");
  console.log("  All features must have tests to ensure reliability.");
  console.log("  Write tests alongside your code, not as an afterthought.");
  console.log("");

  process.exit(1);
}
