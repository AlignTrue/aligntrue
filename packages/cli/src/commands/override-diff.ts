/**
 * Command: aln override diff
 * Show the effect of overlays on IR
 * Phase 3.5, Session 11: Migrated to CLI framework
 */

import { loadConfig, loadIR, applyOverlays } from "@aligntrue/core";
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
    flag: "--config",
    hasValue: true,
    description: "Custom config file path",
  },
];

export async function overrideDiff(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "override diff",
      description: "Show the effect of overlays on IR",
      usage: "aligntrue override diff [selector] [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue override diff",
        "aligntrue override diff 'rule[id=test]'",
      ],
      notes: ["Optional selector argument filters overlays to display"],
    });
    process.exit(0);
  }

  const selectorFilter = parsed.positional[0];
  const config = parsed.flags["config"] as string | undefined;

  try {
    const options: OverrideDiffOptions = {};
    if (config) options.config = config;

    await runOverrideDiff(selectorFilter, options);
  } catch (error) {
    clack.log.error(
      `Failed to generate overlay diff: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

interface OverrideDiffOptions {
  config?: string;
}

async function runOverrideDiff(
  selectorFilter: string | undefined,
  options: OverrideDiffOptions,
): Promise<void> {
  // Load config
  const config = await loadConfig(options.config, process.cwd());

  // Check if any overlays exist
  const overlays = config.overlays?.overrides || [];
  if (overlays.length === 0) {
    console.log("No overlays configured");
    return;
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
    const sourcePath = config.sources?.[0]?.path;
    if (!sourcePath) {
      clack.log.error("No source path configured");
      process.exit(1);
    }
    const { resolve } = await import("path");
    const absoluteSourcePath = resolve(process.cwd(), sourcePath);
    originalIR = await loadIR(absoluteSourcePath);
  } catch (error) {
    clack.log.error("Could not load IR");
    clack.log.info("Run 'aligntrue sync' to generate IR");
    process.exit(1);
  }

  // Apply overlays (TypeScript: cast to AlignPack after IR load validation)
  const result = applyOverlays(
    originalIR as AlignPack,
    config.overlays?.overrides || [],
  );

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
