/**
 * Command: aln override diff
 * Show the effect of overlays on IR
 * Phase 3.5, Session 8
 */

import { Command } from "commander";
import { loadConfig, loadIR, applyOverlays } from "@aligntrue/core";
import * as clack from "@clack/prompts";

interface OverrideDiffOptions {
  config?: string;
}

export function createOverrideDiffCommand(): Command {
  const cmd = new Command("diff");

  cmd
    .description("Show the effect of overlays on IR")
    .argument("[selector]", "Optional selector to filter")
    .option("--config <path>", "Custom config file path")
    .action(
      async (selector: string | undefined, options: OverrideDiffOptions) => {
        try {
          await runOverrideDiff(selector, options);
        } catch (error) {
          clack.log.error(
            `Failed to generate overlay diff: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exit(1);
        }
      },
    );

  return cmd;
}

async function runOverrideDiff(
  selectorFilter: string | undefined,
  options: OverrideDiffOptions,
): Promise<void> {
  // Load config
  const configPath = options.config || ".aligntrue/config.yaml";
  const config = await loadConfig(configPath);

  // Check if any overlays exist
  const overlays = config.overlays?.overrides || [];
  if (overlays.length === 0) {
    console.log("No overlays configured");
    console.log("\nAdd an overlay:");
    console.log(
      "  aligntrue override add --selector 'rule[id=...]' --set key=value",
    );
    process.exit(0);
  }

  // Filter overlays if selector provided
  const filteredOverlays = selectorFilter
    ? overlays.filter((o) => o.selector === selectorFilter)
    : overlays;

  if (filteredOverlays.length === 0) {
    clack.log.warn(`No overlays match selector: ${selectorFilter}`);
    process.exit(1);
  }

  // Load IR
  let originalIR: unknown;
  try {
    originalIR = await loadIR(configPath);
  } catch (error) {
    clack.log.error("Could not load IR");
    clack.log.info("Run 'aligntrue sync' to generate IR");
    process.exit(1);
  }

  // Apply overlays
  const result = applyOverlays(originalIR, config.overlays?.overrides || []);

  if (!result.success) {
    clack.log.error("Failed to apply overlays");
    if (result.errors) {
      for (const err of result.errors) {
        console.log(`  ${err}`);
      }
    }
    process.exit(1);
  }

  // Show diff for each overlay
  for (const overlay of filteredOverlays) {
    console.log(`Overlay diff for: ${overlay.selector}`);
    console.log("");
    console.log("━━━ Original (upstream) ━━━");

    // For simplicity, just show the operations
    // A full diff would require deep comparison of IR before/after
    console.log("(IR before overlay)");
    console.log("");

    console.log("━━━ With overlay ━━━");
    if (overlay.set) {
      for (const [key, value] of Object.entries(overlay.set)) {
        console.log(`${key}: ${JSON.stringify(value)}`);
      }
    }
    if (overlay.remove) {
      for (const key of overlay.remove) {
        console.log(`${key}: (removed)`);
      }
    }
    console.log("");

    const operationCount =
      (overlay.set ? Object.keys(overlay.set).length : 0) +
      (overlay.remove ? overlay.remove.length : 0);
    console.log(
      `Changes: ${operationCount} ${operationCount === 1 ? "property" : "properties"} modified`,
    );
    console.log("");
  }

  if (result.appliedCount !== undefined) {
    console.log(
      `✓ ${result.appliedCount} ${result.appliedCount === 1 ? "overlay" : "overlays"} applied successfully`,
    );
  }

  process.exit(0);
}
