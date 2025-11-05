/**
 * Command: aln override status
 * View dashboard of all overlays with health status
 * Phase 3.5, Session 11: Migrated to CLI framework
 */

import {
  loadConfig,
  evaluateSelector,
  loadIR,
  getAlignTruePaths,
} from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import * as clack from "@clack/prompts";
import { resolve } from "path";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--json",
    hasValue: false,
    description: "Output in JSON format",
  },
  {
    flag: "--config",
    hasValue: true,
    description: "Custom config file path",
  },
];

interface OverlayHealth {
  selector: string;
  health: "healthy" | "stale";
  operations: {
    set?: Record<string, unknown>;
    remove?: string[];
  };
}

export async function overrideStatus(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "override status",
      description: "View dashboard of all overlays with health status",
      usage: "aligntrue override status [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue override status",
        "aligntrue override status --json",
      ],
    });
    process.exit(0);
  }

  const json = (parsed.flags["json"] as boolean | undefined) || false;
  const config = parsed.flags["config"] as string | undefined;

  try {
    const options: OverrideStatusOptions = { json };
    if (config) options.config = config;

    await runOverrideStatus(options);
  } catch (_error) {
    clack.log.error(
      `Failed to get overlay status: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }
}

interface OverrideStatusOptions {
  json?: boolean;
  config?: string;
}

async function runOverrideStatus(
  options: OverrideStatusOptions,
): Promise<void> {
  // Load config
  const config = await loadConfig(options.config, process.cwd());

  // Check if any overlays exist
  const overlays = config.overlays?.overrides || [];
  if (overlays.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            total: 0,
            healthy: 0,
            stale: 0,
            overlays: [],
          },
          null,
          2,
        ),
      );
    } else {
      console.log("No overlays configured");
    }
    process.exit(0);
  }

  // Load IR to evaluate selectors
  let ir: unknown;
  try {
    const paths = getAlignTruePaths(process.cwd());
    const sourcePath = config.sources?.[0]?.path || paths.rules;
    const absoluteSourcePath = resolve(process.cwd(), sourcePath);
    ir = await loadIR(absoluteSourcePath);
  } catch {
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
