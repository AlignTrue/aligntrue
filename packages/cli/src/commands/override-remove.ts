/**
 * Command: aln override remove
 * Remove an overlay
 * Phase 3.5, Session 8
 */

import { Command } from "commander";
import { loadConfig, saveConfig } from "@aligntrue/core";
import * as clack from "@clack/prompts";

interface OverrideRemoveOptions {
  force?: boolean;
  config?: string;
}

export function createOverrideRemoveCommand(): Command {
  const cmd = new Command("remove");

  cmd
    .description("Remove an overlay")
    .argument(
      "[selector]",
      "Optional selector string (if omitted, interactive mode)",
    )
    .option("--force", "Skip confirmation")
    .option("--config <path>", "Custom config file path")
    .action(
      async (selector: string | undefined, options: OverrideRemoveOptions) => {
        try {
          await runOverrideRemove(selector, options);
        } catch (error) {
          clack.log.error(
            `Failed to remove overlay: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      },
    );

  return cmd;
}

async function runOverrideRemove(
  selectorArg: string | undefined,
  options: OverrideRemoveOptions,
): Promise<void> {
  // Load config
  const configPath = options.config || ".aligntrue/config.yaml";
  const config = await loadConfig(configPath);

  // Check if any overlays exist
  const overlays = config.overlays?.overrides || [];
  if (overlays.length === 0) {
    console.log("No overlays configured");
    process.exit(0);
  }

  // Interactive mode if no selector provided
  let selectorToRemove: string;

  if (!selectorArg) {
    // Show interactive list
    const choices = overlays.map((o, idx) => {
      const ops: string[] = [];
      if (o.set) {
        const setPairs = Object.entries(o.set)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ");
        ops.push(`Set: ${setPairs}`);
      }
      if (o.remove) {
        ops.push(`Remove: ${o.remove.join(", ")}`);
      }
      return {
        value: o.selector,
        label: o.selector,
        hint: ops.join("; "),
      };
    });

    const selected = await clack.select({
      message: "Select overlay to remove",
      options: choices,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    selectorToRemove = selected as string;
  } else {
    selectorToRemove = selectorArg;
  }

  // Find matching overlay
  const matchIndex = overlays.findIndex((o) => o.selector === selectorToRemove);

  if (matchIndex === -1) {
    clack.log.error(`No overlay found with selector: ${selectorToRemove}`);
    process.exit(1);
  }

  const overlayToRemove = overlays[matchIndex];

  // Confirm removal (unless --force)
  if (!options.force) {
    console.log("\nRemove overlay: " + overlayToRemove.selector + "?");
    if (overlayToRemove.set) {
      const setPairs = Object.entries(overlayToRemove.set)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ");
      console.log(`  Set: ${setPairs}`);
    }
    if (overlayToRemove.remove) {
      console.log(`  Remove: ${overlayToRemove.remove.join(", ")}`);
    }

    const confirmed = await clack.confirm({
      message: "Proceed?",
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }
  }

  // Remove overlay
  config.overlays!.overrides!.splice(matchIndex, 1);

  // Save config
  await saveConfig(config, configPath);

  // Success output
  clack.log.success("Overlay removed");
  console.log("");
  console.log("Next step:");
  console.log("  Run: aligntrue sync");

  process.exit(0);
}
