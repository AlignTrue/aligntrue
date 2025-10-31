/**
 * Command: aln override status
 * View dashboard of all overlays with health status
 * Phase 3.5, Session 8
 */

import { Command } from "commander";
import { loadConfig, evaluateSelector, loadIR } from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import * as clack from "@clack/prompts";

interface OverrideStatusOptions {
  json?: boolean;
  config?: string;
}

interface OverlayHealth {
  selector: string;
  health: "healthy" | "stale";
  operations: {
    set?: Record<string, unknown>;
    remove?: string[];
  };
}

export function createOverrideStatusCommand(): Command {
  const cmd = new Command("status");

  cmd
    .description("View dashboard of all overlays with health status")
    .option("--json", "Output in JSON format")
    .option("--config <path>", "Custom config file path")
    .action(async (options: OverrideStatusOptions) => {
      try {
        await runOverrideStatus(options);
      } catch (error) {
        clack.log.error(
          `Failed to get overlay status: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function runOverrideStatus(
  options: OverrideStatusOptions,
): Promise<void> {
  // Load config
  const configPath = options.config || ".aligntrue/config.yaml";
  const config = await loadConfig(configPath);

  // Check if any overlays exist
  const overlays = config.overlays?.overrides || [];
  if (overlays.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify(
          { total: 0, healthy: 0, stale: 0, overlays: [] },
          null,
          2,
        ),
      );
    } else {
      console.log("No overlays configured");
      console.log("\nAdd an overlay:");
      console.log(
        "  aligntrue override add --selector 'rule[id=...]' --set key=value",
      );
    }
    process.exit(0);
  }

  // Load IR to evaluate selectors
  let ir: unknown;
  try {
    ir = await loadIR(configPath);
  } catch (error) {
    clack.log.warn("Could not load IR - health status will be unavailable");
    clack.log.info("Run 'aligntrue sync' to generate IR");
    ir = null;
  }

  // Evaluate each overlay
  const results: OverlayHealth[] = [];
  let healthyCount = 0;
  let staleCount = 0;

  for (const overlay of overlays) {
    let health: "healthy" | "stale" = "stale";

    // TypeScript strict mode: type guard for IR
    if (ir && typeof ir === "object" && "rules" in ir) {
      try {
        const match = evaluateSelector(overlay.selector, ir as AlignPack);
        if (match.success) {
          health = "healthy";
          healthyCount++;
        } else {
          staleCount++;
        }
      } catch {
        staleCount++;
      }
    }

    // TypeScript strict mode: explicitly handle optional properties
    const operations: { set?: Record<string, unknown>; remove?: string[] } = {};
    if (overlay.set) {
      operations.set = overlay.set;
    }
    if (overlay.remove) {
      operations.remove = overlay.remove;
    }

    results.push({
      selector: overlay.selector,
      health,
      operations,
    });
  }

  // Output results
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          total: overlays.length,
          healthy: healthyCount,
          stale: staleCount,
          overlays: results,
        },
        null,
        2,
      ),
    );
  } else {
    // Human-readable output
    console.log(
      `Overlays (${overlays.length} active${staleCount > 0 ? `, ${staleCount} stale` : ""})`,
    );
    console.log("");

    for (const result of results) {
      const icon = result.health === "healthy" ? "✓" : "❌";
      console.log(`${icon} ${result.selector}`);

      if (result.operations.set) {
        const setPairs = Object.entries(result.operations.set)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ");
        console.log(`  Set: ${setPairs}`);
      }

      if (result.operations.remove) {
        console.log(`  Remove: ${result.operations.remove.join(", ")}`);
      }

      console.log(
        `  Healthy: ${result.health === "healthy" ? "yes" : "stale (no match in IR)"}`,
      );
      console.log("");
    }

    if (staleCount > 0) {
      console.log(
        "💡 Tip: Run 'aligntrue override remove' to clean up stale overlays",
      );
    }
  }

  process.exit(0);
}
