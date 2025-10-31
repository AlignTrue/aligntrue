/**
 * Command: aln override add
 * Add an overlay to customize rules without forking
 * Phase 3.5, Session 8
 */

import { Command } from "commander";
import {
  parseSelector,
  validateSelector,
} from "@aligntrue/core/overlays/selector-parser.js";
import { loadConfig, saveConfig } from "@aligntrue/core/config/index.js";
import * as clack from "@clack/prompts";

interface OverrideAddOptions {
  selector: string;
  set?: string[];
  remove?: string[];
  config?: string;
}

export function createOverrideAddCommand(): Command {
  const cmd = new Command("add");

  cmd
    .description("Add an overlay to customize rules")
    .requiredOption(
      "--selector <string>",
      "Selector string (rule[id=...], property.path, array[0])",
    )
    .option(
      "--set <key=value...>",
      "Set property (repeatable, supports dot notation)",
    )
    .option("--remove <key...>", "Remove property (repeatable)")
    .option("--config <path>", "Custom config file path")
    .action(async (options: OverrideAddOptions) => {
      try {
        await runOverrideAdd(options);
      } catch (error) {
        clack.log.error(
          `Failed to add overlay: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function runOverrideAdd(options: OverrideAddOptions): Promise<void> {
  // Validate selector syntax
  const validation = validateSelector(options.selector);
  if (!validation.valid) {
    clack.log.error(`Invalid selector: ${validation.error}`);
    console.log("\nValid formats:");
    console.log("  - rule[id=value]");
    console.log("  - property.path");
    console.log("  - array[0]");
    process.exit(1);
  }

  // Parse selector to verify it's well-formed
  const parsed = parseSelector(options.selector);
  if (!parsed) {
    clack.log.error(`Could not parse selector: ${options.selector}`);
    process.exit(1);
  }

  // At least one operation required
  if (!options.set && !options.remove) {
    clack.log.error("At least one of --set or --remove is required");
    console.log("\nExamples:");
    console.log("  --set severity=error");
    console.log("  --remove autofix");
    console.log("  --set severity=warn --remove autofix");
    process.exit(1);
  }

  // Parse set operations
  const setOperations: Record<string, unknown> = {};
  if (options.set) {
    for (const item of options.set) {
      const match = item.match(/^([^=]+)=(.+)$/);
      if (!match) {
        clack.log.error(`Invalid --set format: ${item}`);
        console.log("\nExpected format: key=value");
        console.log("Examples:");
        console.log("  --set severity=error");
        console.log("  --set check.inputs.threshold=15");
        process.exit(1);
      }
      const [, key, value] = match;
      // Try to parse value as JSON, fallback to string
      try {
        setOperations[key] = JSON.parse(value);
      } catch {
        setOperations[key] = value;
      }
    }
  }

  // Parse remove operations
  const removeOperations: string[] = options.remove || [];

  // Load config
  const configPath = options.config || ".aligntrue/config.yaml";
  const config = await loadConfig(configPath);

  // Ensure overlays.overrides array exists
  if (!config.overlays) {
    config.overlays = {};
  }
  if (!config.overlays.overrides) {
    config.overlays.overrides = [];
  }

  // Build overlay definition
  const overlay: {
    selector: string;
    set?: Record<string, unknown>;
    remove?: string[];
  } = {
    selector: options.selector,
  };

  if (Object.keys(setOperations).length > 0) {
    overlay.set = setOperations;
  }

  if (removeOperations.length > 0) {
    overlay.remove = removeOperations;
  }

  // Add to config
  config.overlays.overrides.push(overlay);

  // Save config
  await saveConfig(config, configPath);

  // Success output
  clack.log.success("Overlay added to config");
  console.log("");
  console.log(`Selector: ${options.selector}`);
  if (overlay.set) {
    console.log(
      `  Set: ${Object.entries(overlay.set)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ")}`,
    );
  }
  if (overlay.remove) {
    console.log(`  Remove: ${overlay.remove.join(", ")}`);
  }
  console.log("");
  console.log("Next step:");
  console.log("  Run: aligntrue sync");

  process.exit(0);
}
