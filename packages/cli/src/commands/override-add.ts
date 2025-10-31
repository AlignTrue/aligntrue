/**
 * Command: aln override add
 * Add an overlay to customize rules without forking
 * Phase 3.5, Session 8
 */

import { Command } from "commander";
import {
  parseSelector,
  validateSelector,
} from "@aligntrue/core/overlays/selector-parser";
import { loadConfig, saveConfig } from "../utils/config-loader.js";
import { logger } from "../utils/logger.js";
import { ExitCode } from "../utils/exit-codes.js";

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
        logger.error(
          `Failed to add overlay: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(ExitCode.ERROR);
      }
    });

  return cmd;
}

async function runOverrideAdd(options: OverrideAddOptions): Promise<void> {
  // Validate selector syntax
  const validation = validateSelector(options.selector);
  if (!validation.valid) {
    logger.error(`Invalid selector: ${validation.error}`);
    logger.info("Valid formats:");
    logger.info("  - rule[id=value]");
    logger.info("  - property.path");
    logger.info("  - array[0]");
    process.exit(ExitCode.VALIDATION_ERROR);
  }

  // Parse selector to verify it's well-formed
  const parsed = parseSelector(options.selector);
  if (!parsed) {
    logger.error(`Could not parse selector: ${options.selector}`);
    process.exit(ExitCode.VALIDATION_ERROR);
  }

  // At least one operation required
  if (!options.set && !options.remove) {
    logger.error("At least one of --set or --remove is required");
    logger.info("Examples:");
    logger.info("  --set severity=error");
    logger.info("  --remove autofix");
    logger.info("  --set severity=warn --remove autofix");
    process.exit(ExitCode.VALIDATION_ERROR);
  }

  // Parse set operations
  const setOperations: Record<string, unknown> = {};
  if (options.set) {
    for (const item of options.set) {
      const match = item.match(/^([^=]+)=(.+)$/);
      if (!match) {
        logger.error(`Invalid --set format: ${item}`);
        logger.info("Expected format: key=value");
        logger.info("Examples:");
        logger.info("  --set severity=error");
        logger.info("  --set check.inputs.threshold=15");
        process.exit(ExitCode.VALIDATION_ERROR);
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
  const configPath = options.config;
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
  await saveConfig(configPath || ".aligntrue.yaml", config);

  // Success output
  logger.success("Overlay added to config");
  logger.info("");
  logger.info(`Selector: ${options.selector}`);
  if (overlay.set) {
    logger.info(
      `  Set: ${Object.entries(overlay.set)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ")}`,
    );
  }
  if (overlay.remove) {
    logger.info(`  Remove: ${overlay.remove.join(", ")}`);
  }
  logger.info("");
  logger.info("Next step:");
  logger.info("  Run: aligntrue sync");

  process.exit(ExitCode.SUCCESS);
}
