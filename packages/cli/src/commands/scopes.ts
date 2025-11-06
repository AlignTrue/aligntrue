/**
 * Scopes listing command
 */

import { loadConfig } from "@aligntrue/core";
import { existsSync } from "fs";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [];

export async function scopes(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "scopes",
      description: "List configured scopes from .aligntrue/config.yaml",
      usage: "aligntrue scopes",
      args: ARG_DEFINITIONS,
      examples: ["aligntrue scopes"],
      notes: [
        "Scopes define path-based rule application in monorepos.",
        "Each scope can specify include/exclude patterns and rule overrides.",
        "",
        "Example output:",
        "  Scopes configured in .aligntrue/config.yaml:",
        "",
        "    packages/frontend",
        "      Include: *.ts, *.tsx",
        "      Exclude: **/*.test.ts",
        "",
        "    packages/backend",
        "      Include: *.ts",
        "      Exclude: **/*.spec.ts",
      ],
    });
    return;
  }

  const configPath = ".aligntrue/config.yaml";

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error("✗ Config file not found: .aligntrue/config.yaml");
    console.error("  Run: aligntrue init");
    process.exit(1);
  }

  try {
    // Load config
    const config = await loadConfig(configPath);

    // Check if scopes are defined
    if (!config.scopes || config.scopes.length === 0) {
      console.log("No scopes configured (applies rules to entire workspace)");
      console.log("\nTo add scopes, edit .aligntrue/config.yaml:");
      console.log("");
      console.log("scopes:");
      console.log("  - path: packages/frontend");
      console.log("    include:");
      console.log('      - "*.ts"');
      console.log('      - "*.tsx"');
      console.log("    exclude:");
      console.log('      - "**/*.test.ts"');
      console.log("");
      console.log("Learn more: https://aligntrue.ai/docs/concepts/scopes");
      return;
    }

    // Display scopes
    console.log("Scopes configured in .aligntrue/config.yaml:\n");

    for (const scope of config.scopes) {
      console.log(`  ${scope.path}`);

      if (scope.include && scope.include.length > 0) {
        console.log(`    Include: ${scope.include.join(", ")}`);
      }

      if (scope.exclude && scope.exclude.length > 0) {
        console.log(`    Exclude: ${scope.exclude.join(", ")}`);
      }

      if (scope.rulesets && scope.rulesets.length > 0) {
        console.log(`    Rulesets: ${scope.rulesets.join(", ")}`);
      }

      console.log("");
    }

    console.log(
      `Total: ${config.scopes.length} scope${config.scopes.length === 1 ? "" : "s"}`,
    );

    // Record telemetry event
    recordEvent({ command_name: "scopes", align_hashes_used: [] });
  } catch (err) {
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith("process.exit")) {
      throw err;
    }
    console.error("✗ Failed to load scopes");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
